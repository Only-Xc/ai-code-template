from fast_core.errors import AppError, NotFoundError


class ObjectStorageError(AppError):
    """Base exception for object storage failures."""

    status_code = 500
    default_detail = "Object storage operation failed"

    @property
    def message(self) -> str:
        return self.detail


class ObjectStorageConfigError(ObjectStorageError):
    """Raised when object storage configuration is invalid."""

    default_detail = "Object storage configuration is invalid"


class ObjectStorageNotFoundError(NotFoundError):
    """Raised when an object does not exist."""

    default_detail = "Object was not found"

    @property
    def message(self) -> str:
        return self.detail


class ObjectStorageUploadError(ObjectStorageError):
    """Raised when an object upload fails."""

    default_detail = "Object upload failed"


class ObjectStorageDeleteError(ObjectStorageError):
    """Raised when an object delete fails."""

    default_detail = "Object delete failed"


class ObjectStorageBucketError(ObjectStorageError):
    """Raised when a bucket operation fails."""

    default_detail = "Object storage bucket operation failed"
