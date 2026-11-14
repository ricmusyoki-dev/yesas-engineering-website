import struct
import zlib
from io import BytesIO
from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image


class TemporaryMediaStorageMixin:
    def setUp(self):
        super().setUp()
        self.media_directory = TemporaryDirectory()
        self.settings_override = override_settings(
            MEDIA_PRIVATE_ROOT=self.media_directory.name,
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.addCleanup(self.media_directory.cleanup)


def image_upload(
    image_format="JPEG",
    *,
    name=None,
    size=(8, 6),
    content_type=None,
    exif=None,
):
    buffer = BytesIO()
    mode = "RGBA" if image_format == "PNG" else "RGB"
    image = Image.new(
        mode,
        size,
        color=(20, 40, 60, 120) if mode == "RGBA" else (20, 40, 60),
    )
    save_options = {"format": image_format}
    if exif is not None:
        save_options["exif"] = exif
    image.save(buffer, **save_options)
    extension, mime = {
        "JPEG": ("jpg", "image/jpeg"),
        "PNG": ("png", "image/png"),
        "WEBP": ("webp", "image/webp"),
    }[image_format]
    return SimpleUploadedFile(
        name or f"sample.{extension}",
        buffer.getvalue(),
        content_type or mime,
    )


def mp4_upload(name="sample.mp4", content_type="video/mp4", padding=b""):
    file_type_box = (
        (24 + len(padding)).to_bytes(4, "big")
        + b"ftypisom"
        + b"\x00\x00\x02\x00"
        + b"isomiso2"
        + padding
    )
    return SimpleUploadedFile(name, file_type_box, content_type)


def webm_upload(name="sample.webm", content_type="video/webm"):
    return SimpleUploadedFile(
        name,
        b"\x1a\x45\xdf\xa3\x93\x42\x82\x88webm\x42\xf7\x81\x01",
        content_type,
    )


def png_with_dimensions(width, height):
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    compressor = zlib.compressobj()
    row = b"\x00" + b"\x00" * (width * 3)
    image_data = b"".join(compressor.compress(row) for _ in range(height))
    image_data += compressor.flush()

    def chunk(kind, data):
        checksum = zlib.crc32(kind + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(
        b"IDAT",
        image_data,
    ) + chunk(b"IEND", b"")
