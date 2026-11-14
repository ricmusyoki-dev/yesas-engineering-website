from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateMediaStorage(FileSystemStorage):
    def __init__(self):
        super().__init__(
            location=None,
            base_url=None,
            file_permissions_mode=0o600,
            directory_permissions_mode=0o700,
        )

    @property
    def location(self):
        return str(Path(settings.MEDIA_PRIVATE_ROOT).expanduser().resolve())
