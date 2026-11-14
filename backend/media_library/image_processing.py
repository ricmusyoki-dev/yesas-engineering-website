import tempfile
import warnings

from django.conf import settings
from django.core.exceptions import ValidationError
from PIL import Image, ImageOps, UnidentifiedImageError

PIL_FORMATS = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


def sanitize_image(upload, mime_type: str):
    if mime_type not in PIL_FORMATS:
        raise ValidationError({"file": "Unsupported image format."})

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            upload.seek(0)
            with Image.open(upload) as source:
                _validate_image(source, mime_type)
                source.verify()

            upload.seek(0)
            with Image.open(upload) as source:
                _validate_image(source, mime_type)
                if getattr(source, "n_frames", 1) != 1:
                    raise ValidationError(
                        {"file": "Animated images are not supported."}
                    )
                source.load()
                image = ImageOps.exif_transpose(source)
                image.info.clear()
                if mime_type == "image/jpeg" and image.mode not in ("RGB", "L"):
                    image = image.convert("RGB")
                elif image.mode not in (
                    "1",
                    "L",
                    "LA",
                    "P",
                    "RGB",
                    "RGBA",
                    "I",
                    "I;16",
                ):
                    image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

                width, height = image.size
                _validate_dimensions(width, height)
                # The caller owns and closes these temporary processing streams.
                output = tempfile.TemporaryFile(mode="w+b")  # noqa: SIM115
                thumbnail = tempfile.TemporaryFile(mode="w+b")  # noqa: SIM115
                try:
                    save_options = {"exif": b""}
                    if mime_type == "image/jpeg":
                        save_options["quality"] = 88
                    elif mime_type == "image/webp":
                        save_options.update(quality=85, method=4)
                    image.save(
                        output,
                        format=PIL_FORMATS[mime_type],
                        **save_options,
                    )
                    sanitized_size = output.tell()
                    maximum = settings.MEDIA_IMAGE_MAX_BYTES
                    if sanitized_size > maximum:
                        raise ValidationError(
                            {
                                "file": (
                                    "The sanitized image exceeds the "
                                    f"{maximum}-byte upload limit."
                                )
                            }
                        )

                    image.thumbnail(
                        (settings.MEDIA_THUMBNAIL_MAX_DIMENSION,) * 2,
                        Image.Resampling.LANCZOS,
                    )
                    image.save(thumbnail, format="WEBP", quality=82, method=4)
                    output.seek(0)
                    thumbnail.seek(0)
                    return output, thumbnail, width, height, sanitized_size
                except Exception:
                    output.close()
                    thumbnail.close()
                    raise
    except ValidationError:
        raise
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
        ValueError,
    ) as error:
        raise ValidationError(
            {"file": "The uploaded image is malformed or exceeds image limits."}
        ) from error
    finally:
        upload.seek(0)


def _validate_image(image: Image.Image, expected_mime_type: str) -> None:
    if PIL_FORMATS.get(expected_mime_type) != image.format:
        raise ValidationError(
            {"file": "The decoded image format does not match its signature."}
        )
    width, height = image.size
    _validate_dimensions(width, height)


def _validate_dimensions(width: int, height: int) -> None:
    if (
        width <= 0
        or height <= 0
        or width > settings.MEDIA_IMAGE_MAX_DIMENSION
        or height > settings.MEDIA_IMAGE_MAX_DIMENSION
        or width * height > settings.MEDIA_IMAGE_MAX_PIXELS
    ):
        raise ValidationError(
            {"file": "The image dimensions or decoded pixel count exceed limits."}
        )
