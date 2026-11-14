import os

# Do not allow test runs to inherit a development or production database URL.
os.environ["DJANGO_SECRET_KEY"] = "test-only-secret-key"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from .base import *

DEBUG = False

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    },
}
