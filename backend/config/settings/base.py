
from pathlib import Path

import environ

# --------------------------------------------------
# PATHS AND ENVIRONMENT
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = BASE_DIR.parent

env = environ.Env()

ENV_FILE = ROOT_DIR / ".env"

if ENV_FILE.exists():
    environ.Env.read_env(ENV_FILE)


# --------------------------------------------------
# SECURITY AND APPLICATION ENVIRONMENT
# --------------------------------------------------

SECRET_KEY = env("DJANGO_SECRET_KEY")

DEBUG = env.bool("DJANGO_DEBUG", default=False)

ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1"],
)


# --------------------------------------------------
# APPLICATIONS
# --------------------------------------------------

INSTALLED_APPS = [
    # Django built-in applications
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party applications
    "rest_framework",
    "django_filters",

    # Yesas Engineering applications
    "accounts.apps.AccountsConfig",
    "company.apps.CompanyConfig",
    "services.apps.ServicesConfig",
    "projects.apps.ProjectsConfig",
    "inquiries.apps.InquiriesConfig",
    "testimonials.apps.TestimonialsConfig",
    "media_library.apps.MediaLibraryConfig",
]


# --------------------------------------------------
# MIDDLEWARE
# --------------------------------------------------

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"

ASGI_APPLICATION = "config.asgi.application"


# --------------------------------------------------
# TEMPLATES
# --------------------------------------------------

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# --------------------------------------------------
# DATABASE
# --------------------------------------------------

DATABASES = {
    "default": env.db("DATABASE_URL"),
}


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# --------------------------------------------------
# DJANGO REST FRAMEWORK
# --------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": "5/minute",
    },
}


# --------------------------------------------------
# INTERNATIONALIZATION
# --------------------------------------------------

LANGUAGE_CODE = "en-us"

TIME_ZONE = "Africa/Nairobi"

USE_I18N = True

USE_TZ = True


# --------------------------------------------------
# STATIC AND MEDIA FILES
# --------------------------------------------------

STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"

MEDIA_ROOT = BASE_DIR / "media"

MEDIA_PRIVATE_ROOT = Path(
    env(
        "MEDIA_PRIVATE_ROOT",
        default=str(ROOT_DIR.parent / "yesas-private-media"),
    )
).expanduser().resolve()
MEDIA_IMAGE_MAX_BYTES = env.int("MEDIA_IMAGE_MAX_BYTES", default=12 * 1024 * 1024)
MEDIA_VIDEO_MAX_BYTES = env.int("MEDIA_VIDEO_MAX_BYTES", default=100 * 1024 * 1024)
MEDIA_IMAGE_MAX_DIMENSION = env.int("MEDIA_IMAGE_MAX_DIMENSION", default=8192)
MEDIA_IMAGE_MAX_PIXELS = env.int("MEDIA_IMAGE_MAX_PIXELS", default=20_000_000)
MEDIA_THUMBNAIL_MAX_DIMENSION = env.int(
    "MEDIA_THUMBNAIL_MAX_DIMENSION",
    default=512,
)
MEDIA_X_ACCEL_PREFIX = env("MEDIA_X_ACCEL_PREFIX", default="")


# --------------------------------------------------
# EMAIL
# --------------------------------------------------

MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.console.EmailBackend",
    },
}

DEFAULT_FROM_EMAIL = "noreply@yesasengineering.local"

EMAIL_SUBJECT_PREFIX = "[Yesas Engineering] "


# --------------------------------------------------
# DEFAULTS
# --------------------------------------------------

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
