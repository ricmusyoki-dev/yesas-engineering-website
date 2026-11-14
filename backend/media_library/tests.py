import hashlib
import stat
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from media_library.models import MediaAsset, MediaType
from media_library.serializers import MediaAssetUploadSerializer
from media_library.test_utils import (
    TemporaryMediaStorageMixin,
    image_upload,
    mp4_upload,
    png_with_dimensions,
    webm_upload,
)


class MediaUploadTests(TemporaryMediaStorageMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(
            email="editor@example.com",
            password="test-password",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.upload_url = reverse("media-assets")

    def upload(self, file, **data):
        return self.client.post(
            self.upload_url,
            {"file": file, **data},
            format="multipart",
        )

    def test_supported_images_are_sanitized_and_have_thumbnails(self):
        for image_format in ("JPEG", "PNG", "WEBP"):
            with self.subTest(image_format=image_format):
                response = self.upload(image_upload(image_format))

                self.assertEqual(response.status_code, 201, response.data)
                asset = MediaAsset.objects.get(pk=response.data["id"])
                self.assertEqual(asset.width, 8)
                self.assertEqual(asset.height, 6)
                self.assertEqual(
                    asset.verified_mime_type,
                    f"image/{image_format.lower()}",
                )
                self.assertEqual(
                    asset.sha256,
                    hashlib.sha256(asset.file.read()).hexdigest(),
                )
                self.assertTrue(asset.thumbnail.storage.exists(asset.thumbnail.name))
                with Image.open(asset.file.path) as stored:
                    self.assertEqual(stored.format, image_format)
                    self.assertEqual(stored.size, (8, 6))
                self.assertNotIn("sample", asset.file.name)

    def test_jpeg_exif_orientation_is_applied_and_metadata_is_removed(self):
        exif = Image.Exif()
        exif[274] = 6
        exif[315] = "Private author metadata"

        response = self.upload(image_upload("JPEG", size=(10, 4), exif=exif))

        self.assertEqual(response.status_code, 201, response.data)
        asset = MediaAsset.objects.get(pk=response.data["id"])
        self.assertEqual((asset.width, asset.height), (4, 10))
        with Image.open(asset.file.path) as stored:
            self.assertNotIn(315, stored.getexif())

    def test_rejects_mime_extension_and_signature_mismatches(self):
        cases = (
            image_upload("PNG", name="photo.jpg"),
            image_upload("PNG", content_type="image/jpeg"),
        )
        for uploaded in cases:
            with self.subTest(name=uploaded.name, mime=uploaded.content_type):
                response = self.upload(uploaded)
                self.assertEqual(response.status_code, 400)
                self.assertFalse(MediaAsset.objects.exists())

    def test_traversal_filename_is_sanitized_and_never_used_as_storage_path(self):
        response = self.upload(image_upload("PNG", name="../../unsafe.png"))

        self.assertEqual(response.status_code, 201, response.data)
        asset = MediaAsset.objects.get(pk=response.data["id"])
        self.assertEqual(asset.display_filename, "unsafe.png")
        self.assertNotIn("unsafe", asset.file.name)
        self.assertNotIn("..", asset.file.name)

    def test_rejects_corrupt_images_and_unknown_formats(self):
        cases = (
            ("broken.jpg", "image/jpeg", b"\xff\xd8\xffnot-an-image"),
            ("vector.svg", "image/svg+xml", b"<svg></svg>"),
        )
        for name, content_type, payload in cases:
            with self.subTest(name=name):
                response = self.upload(
                    SimpleUploadedFile(name, payload, content_type)
                )
                self.assertEqual(response.status_code, 400)
                self.assertFalse(MediaAsset.objects.exists())

    @override_settings(MEDIA_IMAGE_MAX_BYTES=10)
    def test_enforces_image_upload_size_limit(self):
        response = self.upload(image_upload())

        self.assertEqual(response.status_code, 400)
        self.assertIn("upload limit", str(response.data).lower())
        self.assertFalse(MediaAsset.objects.exists())

    @override_settings(MEDIA_IMAGE_MAX_DIMENSION=4)
    def test_enforces_image_dimension_limit(self):
        response = self.upload(image_upload(size=(8, 6)))

        self.assertEqual(response.status_code, 400)
        self.assertIn("dimension", str(response.data).lower())
        self.assertFalse(MediaAsset.objects.exists())

    @override_settings(
        MEDIA_IMAGE_MAX_DIMENSION=6000,
        MEDIA_IMAGE_MAX_PIXELS=20_000_000,
    )
    def test_enforces_image_pixel_limit_before_decoding(self):
        response = self.upload(
            type(image_upload())(
                "oversized.png",
                png_with_dimensions(5000, 5000),
                "image/png",
            )
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("pixel", str(response.data).lower())
        self.assertFalse(MediaAsset.objects.exists())

    def test_accepts_mp4_and_webm_signatures_without_claiming_decode_validation(self):
        for file in (mp4_upload(), webm_upload()):
            with self.subTest(name=file.name):
                response = self.upload(file)

                self.assertEqual(response.status_code, 201, response.data)
                asset = MediaAsset.objects.get(pk=response.data["id"])
                self.assertIsNone(asset.width)
                self.assertIsNone(asset.height)
                self.assertIsNone(asset.duration_seconds)
                self.assertEqual(Path(asset.file.name).suffix, f".{file.name.rsplit('.', 1)[1]}")

    def test_rejects_video_mime_extension_and_signature_mismatches(self):
        cases = (
            mp4_upload(name="video.webm"),
            mp4_upload(content_type="video/webm"),
            webm_upload(name="video.mp4"),
            webm_upload(content_type="video/mp4"),
        )
        for uploaded in cases:
            with self.subTest(name=uploaded.name, mime=uploaded.content_type):
                response = self.upload(uploaded)
                self.assertEqual(response.status_code, 400)
        self.assertFalse(MediaAsset.objects.exists())

    def test_upload_file_is_removed_when_database_save_fails(self):
        with (
            patch.object(MediaAsset, "save", side_effect=IntegrityError("test failure")),
            self.assertRaises(IntegrityError),
        ):
            self.upload(image_upload())

        stored_files = list(Path(self.media_directory.name).rglob("*"))
        self.assertFalse([path for path in stored_files if path.is_file()])
        self.assertFalse(MediaAsset.objects.exists())

    def test_asset_file_metadata_is_immutable(self):
        asset = MediaAsset.objects.create(
            original_filename="original.jpg",
            file="assets/original.jpg",
            display_filename="original.jpg",
            uploader=self.user,
            media_type=MediaType.IMAGE,
            verified_mime_type="image/jpeg",
            file_size=1,
            sha256="a" * 64,
        )
        asset.sha256 = "b" * 64

        with self.assertRaises(ValidationError):
            asset.save()

    def test_private_asset_storage_does_not_expose_a_public_url(self):
        response = self.upload(image_upload())

        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn("file", response.data)
        self.assertNotIn("thumbnail", response.data)

    def test_private_storage_sets_restrictive_file_and_directory_modes(self):
        response = self.upload(image_upload())
        asset = MediaAsset.objects.get(pk=response.data["id"])
        stored_file = Path(asset.file.path)

        self.assertEqual(stat.S_IMODE(stored_file.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(stored_file.parent.stat().st_mode), 0o700)

    @override_settings(MEDIA_IMAGE_MAX_BYTES=10, MEDIA_VIDEO_MAX_BYTES=10)
    def test_upload_handler_rejects_oversized_request_body(self):
        response = self.upload(image_upload())

        self.assertEqual(response.status_code, 413)
        self.assertFalse(MediaAsset.objects.exists())


class MediaAssetInputTests(TemporaryMediaStorageMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(
            email="editor@example.com",
            password="test-password",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.upload_url = reverse("media-assets")

    def test_unknown_upload_fields_are_rejected(self):
        response = self.client.post(
            self.upload_url,
            {"file": image_upload(), "storage_path": "assets/unsafe.jpg"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("storage_path", str(response.data))
        self.assertFalse(MediaAsset.objects.exists())

    def test_non_object_input_returns_a_validation_error(self):
        serializer = MediaAssetUploadSerializer(data=[])

        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)
