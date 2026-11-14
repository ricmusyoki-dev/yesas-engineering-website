from pathlib import Path

from .base import *

DEBUG = False

MEDIA_PRIVATE_ROOT = Path(env("MEDIA_PRIVATE_ROOT")).expanduser().resolve()

ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

CSRF_TRUSTED_ORIGINS = env.list(
    "DJANGO_CSRF_TRUSTED_ORIGINS"
)

SECURE_SSL_REDIRECT = True

SESSION_COOKIE_SECURE = True

CSRF_COOKIE_SECURE = True

SECURE_PROXY_SSL_HEADER = (
    "HTTP_X_FORWARDED_PROTO",
    "https",
)

SECURE_CONTENT_TYPE_NOSNIFF = True

SECURE_REFERRER_POLICY = "same-origin"

X_FRAME_OPTIONS = "DENY"


MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        "OPTIONS": {
            "host": env("SMTP_HOST", default=""),
            "port": env.int("SMTP_PORT", default=587),
            "username": env("SMTP_USERNAME", default=""),
            "password": env("SMTP_PASSWORD", default=""),
            "use_tls": env.bool("SMTP_USE_TLS", default=True),
            "use_ssl": env.bool("SMTP_USE_SSL", default=False),
            "timeout": env.int("SMTP_TIMEOUT", default=10),
        },
    },
}

