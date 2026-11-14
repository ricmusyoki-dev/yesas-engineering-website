import unicodedata
from dataclasses import dataclass
from pathlib import PurePath

from django.conf import settings
from django.core.exceptions import ValidationError

IMAGE_SIGNATURES = {
    b"\xff\xd8\xff": ("image", "image/jpeg", (".jpg", ".jpeg")),
    b"\x89PNG\r\n\x1a\n": ("image", "image/png", (".png",)),
}
MIME_ALIASES = {"image/jpg": "image/jpeg"}


@dataclass(frozen=True)
class UploadInspection:
    original_filename: str
    media_type: str
    mime_type: str
    extension: str


def sanitize_filename(filename: str) -> str:
    basename = filename.replace("\\", "/").rsplit("/", 1)[-1]
    normalized = unicodedata.normalize("NFC", basename)
    safe = "".join(
        character
        for character in normalized
        if character.isprintable() and character not in "/\\"
    ).strip(" .")
    if not safe:
        safe = "upload"
    return safe[:255]


def _detect_type(header: bytes) -> tuple[str, str, tuple[str, ...]]:
    for signature, result in IMAGE_SIGNATURES.items():
        if header.startswith(signature):
            return result
    if len(header) >= 12 and header[8:12] == b"WEBP" and header[:4] == b"RIFF":
        return "image", "image/webp", (".webp",)
    if (
        len(header) >= 12
        and header[4:8] == b"ftyp"
        and header[8:12] in (b"isom", b"iso2", b"mp41", b"mp42", b"M4V ", b"avc1")
    ):
        return "video", "video/mp4", (".mp4",)
    if header.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in header.lower():
        return "video", "video/webm", (".webm",)
    raise ValidationError({"file": "The uploaded file has an unsupported signature."})


def inspect_upload(upload) -> UploadInspection:
    if not upload or not getattr(upload, "size", 0):
        raise ValidationError({"file": "Choose a non-empty file to upload."})

    original_filename = sanitize_filename(getattr(upload, "name", "upload"))
    extension = PurePath(original_filename).suffix.lower()
    try:
        upload.seek(0)
        header = upload.read(4096)
    finally:
        upload.seek(0)

    media_type, mime_type, extensions = _detect_type(header)
    if extension not in extensions:
        raise ValidationError(
            {"file": "The filename extension does not match the detected file type."}
        )

    supplied_mime = (getattr(upload, "content_type", "") or "").split(";", 1)[0].lower()
    supplied_mime = MIME_ALIASES.get(supplied_mime, supplied_mime)
    if supplied_mime not in ("", "application/octet-stream", mime_type):
        raise ValidationError(
            {"file": "The supplied MIME type does not match the detected file type."}
        )

    max_size = (
        settings.MEDIA_IMAGE_MAX_BYTES
        if media_type == "image"
        else settings.MEDIA_VIDEO_MAX_BYTES
    )
    if upload.size > max_size:
        raise ValidationError(
            {"file": f"The {media_type} exceeds the {max_size}-byte upload limit."}
        )

    return UploadInspection(
        original_filename=original_filename,
        media_type=media_type,
        mime_type=mime_type,
        extension=extension.removeprefix("."),
    )
