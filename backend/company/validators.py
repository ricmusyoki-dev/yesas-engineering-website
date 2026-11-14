from urllib.parse import SplitResult, urlsplit

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

SOCIAL_DOMAINS = {
    "linkedin": ("linkedin.com",),
    "instagram": ("instagram.com",),
    "facebook": ("facebook.com",),
    "tiktok": ("tiktok.com",),
    "youtube": ("youtube.com", "youtu.be"),
}


def _validate_https_url(value: str) -> SplitResult:
    try:
        if "\\" in value or any(
            character.isspace() or ord(character) < 32 for character in value
        ):
            raise ValidationError("Enter a safe HTTPS URL.")
        URLValidator(schemes=("https",))(value)
        parsed = urlsplit(value)
        hostname = parsed.hostname
        if (
            parsed.scheme != "https"
            or not hostname
            or parsed.username
            or parsed.password
        ):
            raise ValidationError("Enter a safe HTTPS URL.")
        return parsed
    except (ValueError, ValidationError) as error:
        raise ValidationError("Enter a safe HTTPS URL.") from error


def validate_social_url(value: str, platform: str) -> None:
    parsed = _validate_https_url(value)
    hostname = parsed.hostname.lower()
    allowed_domains = SOCIAL_DOMAINS[platform]
    if not any(
        hostname == domain or hostname.endswith(f".{domain}")
        for domain in allowed_domains
    ):
        raise ValidationError(f"Enter a valid {platform.title()} profile URL.")


def validate_cta_destination(value: str) -> None:
    if value.startswith("/") and not value.startswith("//"):
        parsed = urlsplit(value)
        if (
            not parsed.scheme
            and not parsed.netloc
            and "\\" not in value
            and not any(
                character.isspace() or ord(character) < 32 for character in value
            )
        ):
            return
    _validate_https_url(value)
