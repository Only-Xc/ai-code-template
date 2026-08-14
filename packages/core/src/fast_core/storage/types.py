from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class UploadResult:
    bucket: str
    key: str
    size_bytes: int | None
    content_type: str | None
    etag: str | None
    checksum_sha256: str | None = None
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ObjectMetadata:
    bucket: str
    key: str
    size_bytes: int | None
    content_type: str | None
    etag: str | None
    last_modified: datetime | None = None
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class PresignedUrl:
    url: str
    expires_seconds: int
