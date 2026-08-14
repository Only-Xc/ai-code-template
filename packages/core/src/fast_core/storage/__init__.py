"""Shared object storage infrastructure."""

from fast_core.storage.client import ObjectStorage
from fast_core.storage.errors import (
    ObjectStorageBucketError,
    ObjectStorageConfigError,
    ObjectStorageDeleteError,
    ObjectStorageError,
    ObjectStorageNotFoundError,
    ObjectStorageUploadError,
)
from fast_core.storage.types import ObjectMetadata, PresignedUrl, UploadResult

__all__ = [
    "ObjectMetadata",
    "ObjectStorage",
    "ObjectStorageBucketError",
    "ObjectStorageConfigError",
    "ObjectStorageDeleteError",
    "ObjectStorageError",
    "ObjectStorageNotFoundError",
    "ObjectStorageUploadError",
    "PresignedUrl",
    "UploadResult",
]
