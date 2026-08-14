from collections.abc import Mapping
from datetime import datetime
from typing import Any, BinaryIO

from botocore.exceptions import BotoCoreError, ClientError

from fast_core.storage.errors import (
    ObjectStorageBucketError,
    ObjectStorageDeleteError,
    ObjectStorageError,
    ObjectStorageNotFoundError,
    ObjectStorageUploadError,
)
from fast_core.storage.types import ObjectMetadata, PresignedUrl, UploadResult

_NOT_FOUND_CODES = {"404", "NoSuchKey", "NotFound"}
MAX_PRESIGNED_URL_EXPIRES_SECONDS = 7 * 24 * 3600


class ObjectStorage:
    """S3-compatible object storage client wrapper."""

    def __init__(self, client: Any) -> None:
        self.client = client

    def put_object(
        self,
        *,
        bucket: str,
        key: str,
        body: bytes | BinaryIO,
        content_type: str | None = None,
        metadata: Mapping[str, str] | None = None,
        checksum_sha256: str | None = None,
    ) -> UploadResult:
        extra_args: dict[str, Any] = {}
        if content_type is not None:
            extra_args["ContentType"] = content_type
        if metadata:
            extra_args["Metadata"] = dict(metadata)
        if checksum_sha256 is not None:
            # 传给 S3 让服务端校验内容完整性，返回值里的 checksum 才有业务意义。
            extra_args["ChecksumAlgorithm"] = "SHA256"
            extra_args["ChecksumSHA256"] = checksum_sha256

        try:
            response = self.client.put_object(
                Bucket=bucket,
                Key=key,
                Body=body,
                **extra_args,
            )
        except (ClientError, BotoCoreError) as exc:
            raise ObjectStorageUploadError() from exc

        return UploadResult(
            bucket=bucket,
            key=key,
            size_bytes=self._body_size(body),
            content_type=content_type,
            etag=self._normalize_etag(response.get("ETag")),
            checksum_sha256=checksum_sha256,
            metadata=dict(metadata or {}),
        )

    def delete_object(self, *, bucket: str, key: str) -> None:
        try:
            self.client.delete_object(Bucket=bucket, Key=key)
        except (ClientError, BotoCoreError) as exc:
            raise ObjectStorageDeleteError() from exc

    def head_object(self, *, bucket: str, key: str) -> ObjectMetadata:
        try:
            response = self.client.head_object(Bucket=bucket, Key=key)
        except ClientError as exc:
            if self._is_not_found(exc):
                raise ObjectStorageNotFoundError() from exc
            raise ObjectStorageError() from exc
        except BotoCoreError as exc:
            raise ObjectStorageError() from exc

        return ObjectMetadata(
            bucket=bucket,
            key=key,
            size_bytes=response.get("ContentLength"),
            content_type=response.get("ContentType"),
            etag=self._normalize_etag(response.get("ETag")),
            last_modified=self._last_modified(response.get("LastModified")),
            metadata=dict(response.get("Metadata") or {}),
        )

    def object_exists(self, *, bucket: str, key: str) -> bool:
        # exists 只吞掉对象不存在，权限、网络或服务端错误继续向上暴露。
        try:
            self.head_object(bucket=bucket, key=key)
        except ObjectStorageNotFoundError:
            return False
        return True

    def bucket_exists(self, *, bucket: str) -> bool:
        try:
            self.client.head_bucket(Bucket=bucket)
        except ClientError as exc:
            if self._is_not_found(exc):
                return False
            raise ObjectStorageError() from exc
        except BotoCoreError as exc:
            raise ObjectStorageError() from exc
        return True

    def create_bucket(self, *, bucket: str) -> None:
        try:
            self.client.create_bucket(Bucket=bucket)
        except (ClientError, BotoCoreError) as exc:
            raise ObjectStorageBucketError() from exc

    def ensure_bucket(self, *, bucket: str) -> None:
        if self.bucket_exists(bucket=bucket):
            return
        self.create_bucket(bucket=bucket)

    def create_presigned_get_url(
        self,
        *,
        bucket: str,
        key: str,
        expires_seconds: int,
    ) -> PresignedUrl:
        # S3 presigned URL 最大有效期为 7 天，入口处限制避免长期外链泄露。
        if expires_seconds > MAX_PRESIGNED_URL_EXPIRES_SECONDS:
            raise ValueError(
                f"expires_seconds must not exceed {MAX_PRESIGNED_URL_EXPIRES_SECONDS}"
            )
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_seconds,
            )
        except (ClientError, BotoCoreError) as exc:
            raise ObjectStorageError() from exc
        return PresignedUrl(url=str(url), expires_seconds=expires_seconds)

    def _is_not_found(self, exc: ClientError) -> bool:
        error = exc.response.get("Error", {})
        code = str(error.get("Code", ""))
        status_code = str(
            exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode", "")
        )
        return code in _NOT_FOUND_CODES or status_code == "404"

    def _body_size(self, body: bytes | BinaryIO) -> int | None:
        if isinstance(body, bytes):
            return len(body)
        try:
            # file-like 对象读取 size 后恢复原位置，避免影响后续上传读取。
            current_position = body.tell()
            body.seek(0, 2)
            size = body.tell()
            body.seek(current_position)
            return int(size)
        except (AttributeError, OSError):
            return None

    def _normalize_etag(self, etag: Any) -> str | None:
        if etag is None:
            return None
        return str(etag).strip('"')

    def _last_modified(self, value: Any) -> datetime | None:
        if isinstance(value, datetime):
            return value
        return None
