from datetime import UTC, datetime
from typing import Any, cast

import pytest
from botocore.exceptions import ClientError
from fast_core.errors import AppError, NotFoundError
from fast_core.settings import Settings
from fast_core.storage.client import MAX_PRESIGNED_URL_EXPIRES_SECONDS, ObjectStorage
from fast_core.storage.errors import (
    ObjectStorageBucketError,
    ObjectStorageConfigError,
    ObjectStorageDeleteError,
    ObjectStorageError,
    ObjectStorageNotFoundError,
    ObjectStorageUploadError,
)
from fast_core.storage.factory import (
    OBJECT_STORAGE_CONNECT_TIMEOUT_SECONDS,
    OBJECT_STORAGE_READ_TIMEOUT_SECONDS,
    create_object_storage,
)
from fast_core.storage.types import ObjectMetadata, PresignedUrl, UploadResult
from pydantic import SecretStr


class FakeS3Client:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], dict[str, Any]] = {}
        self.buckets: set[str] = set()
        self.created_buckets: list[str] = []
        self.deleted: list[tuple[str, str]] = []
        self.fail_operations: set[str] = set()

    def put_object(self, **kwargs: Any) -> dict[str, str]:
        if "put_object" in self.fail_operations:
            raise self._client_error("InternalError", 500)
        bucket = kwargs["Bucket"]
        key = kwargs["Key"]
        body = kwargs["Body"]
        self.objects[(bucket, key)] = {
            "Body": body,
            "ContentType": kwargs.get("ContentType"),
            "Metadata": kwargs.get("Metadata") or {},
            "ChecksumAlgorithm": kwargs.get("ChecksumAlgorithm"),
            "ChecksumSHA256": kwargs.get("ChecksumSHA256"),
            "ContentLength": len(body) if isinstance(body, bytes) else None,
            "ETag": '"etag-1"',
            "LastModified": datetime(2026, 1, 1, tzinfo=UTC),
        }
        return {"ETag": '"etag-1"'}

    def delete_object(self, **kwargs: Any) -> None:
        if "delete_object" in self.fail_operations:
            raise self._client_error("InternalError", 500)
        bucket = kwargs["Bucket"]
        key = kwargs["Key"]
        self.deleted.append((bucket, key))
        self.objects.pop((bucket, key), None)

    def head_object(self, **kwargs: Any) -> dict[str, Any]:
        if "head_object" in self.fail_operations:
            raise self._client_error("InternalError", 500)
        bucket = kwargs["Bucket"]
        key = kwargs["Key"]
        value = self.objects.get((bucket, key))
        if value is None:
            raise self._client_error("404", 404)
        return {
            "ContentLength": value["ContentLength"],
            "ContentType": value["ContentType"],
            "ETag": value["ETag"],
            "LastModified": value["LastModified"],
            "Metadata": value["Metadata"],
        }

    def head_bucket(self, **kwargs: Any) -> None:
        if "head_bucket" in self.fail_operations:
            raise self._client_error("InternalError", 500)
        bucket = kwargs["Bucket"]
        if bucket not in self.buckets:
            raise self._client_error("404", 404)

    def create_bucket(self, **kwargs: Any) -> None:
        if "create_bucket" in self.fail_operations:
            raise self._client_error("InternalError", 500)
        bucket = kwargs["Bucket"]
        self.buckets.add(bucket)
        self.created_buckets.append(bucket)

    def generate_presigned_url(self, *args: Any, **kwargs: Any) -> str:
        if "generate_presigned_url" in self.fail_operations:
            raise self._client_error("InternalError", 500)
        assert args == ("get_object",)
        params = kwargs["Params"]
        expires = kwargs["ExpiresIn"]
        return f"https://storage.example.com/{params['Bucket']}/{params['Key']}?exp={expires}"

    def _client_error(self, code: str, status_code: int) -> ClientError:
        return ClientError(
            {
                "Error": {"Code": code},
                "ResponseMetadata": {"HTTPStatusCode": status_code},
            },
            "FakeOperation",
        )


def make_app_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "PROJECT_NAME": "Test",
        "POSTGRES_SERVER": "localhost",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": SecretStr("changethis"),
        "POSTGRES_DB": "app",
        "FIRST_SUPERUSER": "admin@example.com",
        "FIRST_SUPERUSER_PASSWORD": SecretStr("changethis"),
        "SECRET_KEY": SecretStr("changethis"),
        "OBJECT_STORAGE_ACCESS_KEY": "minio-access-key",
        "OBJECT_STORAGE_SECRET_KEY": SecretStr("minio-secret-key"),
    }
    values.update(overrides)
    return Settings(**cast(Any, values))


def test_upload_result_uses_stable_shape_and_isolated_metadata() -> None:
    first = UploadResult(
        bucket="fast-platform",
        key="items/files/file.pdf",
        size_bytes=123,
        content_type="application/pdf",
        etag="etag-1",
    )
    second = UploadResult(
        bucket="fast-platform",
        key="items/files/other.pdf",
        size_bytes=None,
        content_type=None,
        etag=None,
    )

    first.metadata["source"] = "test"

    assert first.bucket == "fast-platform"
    assert first.key == "items/files/file.pdf"
    assert first.size_bytes == 123
    assert first.content_type == "application/pdf"
    assert first.etag == "etag-1"
    assert first.checksum_sha256 is None
    assert second.metadata == {}


def test_object_metadata_and_presigned_url_shapes() -> None:
    metadata = ObjectMetadata(
        bucket="fast-platform",
        key="items/files/file.pdf",
        size_bytes=123,
        content_type="application/pdf",
        etag="etag-1",
        metadata={"owner": "items"},
    )
    url = PresignedUrl(url="https://storage.example.com/file", expires_seconds=300)

    assert metadata.metadata == {"owner": "items"}
    assert metadata.last_modified is None
    assert url.expires_seconds == 300


@pytest.mark.parametrize(
    "error_type",
    [
        ObjectStorageError,
        ObjectStorageConfigError,
        ObjectStorageNotFoundError,
        ObjectStorageUploadError,
        ObjectStorageDeleteError,
    ],
)
def test_storage_errors_have_safe_default_messages(
    error_type: type[ObjectStorageError],
) -> None:
    error = error_type()

    assert str(error)
    assert "secret" not in str(error).lower()
    assert "access" not in str(error).lower()
    assert "http" not in str(error).lower()
    assert isinstance(error, AppError)


def test_storage_not_found_error_uses_not_found_status() -> None:
    error = ObjectStorageNotFoundError()

    assert isinstance(error, NotFoundError)
    assert error.status_code == 404


def test_storage_errors_accept_safe_custom_messages() -> None:
    error = ObjectStorageUploadError("Object upload failed")

    assert str(error) == "Object upload failed"


def test_object_storage_put_object_returns_upload_result() -> None:
    fake = FakeS3Client()
    storage = ObjectStorage(client=fake)

    result = storage.put_object(
        bucket="fast-platform",
        key="items/files/file.pdf",
        body=b"content",
        content_type="application/pdf",
        metadata={"owner": "items"},
        checksum_sha256="checksum-1",
    )

    assert result.bucket == "fast-platform"
    assert result.key == "items/files/file.pdf"
    assert result.size_bytes == 7
    assert result.content_type == "application/pdf"
    assert result.etag == "etag-1"
    assert result.checksum_sha256 == "checksum-1"
    assert result.metadata == {"owner": "items"}
    stored = fake.objects[("fast-platform", "items/files/file.pdf")]
    assert stored["ChecksumAlgorithm"] == "SHA256"
    assert stored["ChecksumSHA256"] == "checksum-1"


def test_object_storage_delete_object_deletes_by_bucket_and_key() -> None:
    fake = FakeS3Client()
    storage = ObjectStorage(client=fake)
    storage.put_object(bucket="fast-platform", key="file.txt", body=b"content")

    storage.delete_object(bucket="fast-platform", key="file.txt")

    assert fake.deleted == [("fast-platform", "file.txt")]
    assert not storage.object_exists(bucket="fast-platform", key="file.txt")


def test_object_storage_head_object_returns_metadata() -> None:
    fake = FakeS3Client()
    storage = ObjectStorage(client=fake)
    storage.put_object(
        bucket="fast-platform",
        key="file.txt",
        body=b"content",
        content_type="text/plain",
        metadata={"owner": "items"},
    )

    metadata = storage.head_object(bucket="fast-platform", key="file.txt")

    assert metadata.bucket == "fast-platform"
    assert metadata.key == "file.txt"
    assert metadata.size_bytes == 7
    assert metadata.content_type == "text/plain"
    assert metadata.etag == "etag-1"
    assert metadata.last_modified == datetime(2026, 1, 1, tzinfo=UTC)
    assert metadata.metadata == {"owner": "items"}


def test_object_storage_object_exists_handles_missing_objects() -> None:
    storage = ObjectStorage(client=FakeS3Client())

    assert not storage.object_exists(bucket="fast-platform", key="missing.txt")

    with pytest.raises(ObjectStorageNotFoundError):
        storage.head_object(bucket="fast-platform", key="missing.txt")


def test_object_storage_bucket_exists_handles_missing_buckets() -> None:
    fake = FakeS3Client()
    storage = ObjectStorage(client=fake)

    assert not storage.bucket_exists(bucket="fast-platform")

    fake.buckets.add("fast-platform")

    assert storage.bucket_exists(bucket="fast-platform")


def test_object_storage_ensure_bucket_creates_missing_bucket() -> None:
    fake = FakeS3Client()
    storage = ObjectStorage(client=fake)

    storage.ensure_bucket(bucket="fast-platform")

    assert fake.created_buckets == ["fast-platform"]
    assert storage.bucket_exists(bucket="fast-platform")


def test_object_storage_ensure_bucket_skips_existing_bucket() -> None:
    fake = FakeS3Client()
    fake.buckets.add("fast-platform")
    storage = ObjectStorage(client=fake)

    storage.ensure_bucket(bucket="fast-platform")

    assert fake.created_buckets == []


def test_object_storage_wraps_bucket_create_failure() -> None:
    fake = FakeS3Client()
    fake.fail_operations.add("create_bucket")
    storage = ObjectStorage(client=fake)

    with pytest.raises(ObjectStorageBucketError):
        storage.ensure_bucket(bucket="fast-platform")


def test_object_storage_create_presigned_get_url() -> None:
    storage = ObjectStorage(client=FakeS3Client())

    result = storage.create_presigned_get_url(
        bucket="fast-platform",
        key="file.txt",
        expires_seconds=300,
    )

    assert result.url == "https://storage.example.com/fast-platform/file.txt?exp=300"
    assert result.expires_seconds == 300


def test_object_storage_rejects_presigned_url_expiration_above_limit() -> None:
    storage = ObjectStorage(client=FakeS3Client())

    with pytest.raises(ValueError, match=str(MAX_PRESIGNED_URL_EXPIRES_SECONDS)):
        storage.create_presigned_get_url(
            bucket="fast-platform",
            key="file.txt",
            expires_seconds=MAX_PRESIGNED_URL_EXPIRES_SECONDS + 1,
        )


def test_object_storage_wraps_upload_delete_and_presigned_failures() -> None:
    fake = FakeS3Client()
    storage = ObjectStorage(client=fake)

    fake.fail_operations.add("put_object")
    with pytest.raises(ObjectStorageUploadError):
        storage.put_object(bucket="fast-platform", key="file.txt", body=b"content")

    fake.fail_operations.add("delete_object")
    with pytest.raises(ObjectStorageDeleteError):
        storage.delete_object(bucket="fast-platform", key="file.txt")

    fake.fail_operations.add("generate_presigned_url")
    with pytest.raises(ObjectStorageError):
        storage.create_presigned_get_url(
            bucket="fast-platform",
            key="file.txt",
            expires_seconds=300,
        )


def test_create_object_storage_builds_s3_compatible_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeS3Client()
    calls: list[dict[str, Any]] = []

    def fake_boto3_client(*args: Any, **kwargs: Any) -> FakeS3Client:
        calls.append({"args": args, "kwargs": kwargs})
        return fake

    monkeypatch.setattr("fast_core.storage.factory.boto3.client", fake_boto3_client)

    storage = create_object_storage(
        make_app_settings(OBJECT_STORAGE_AUTO_CREATE_BUCKET=False)
    )

    assert storage.client is fake
    assert calls[0]["args"] == ("s3",)
    assert calls[0]["kwargs"]["endpoint_url"] == "http://localhost:9000"
    assert calls[0]["kwargs"]["region_name"] == "us-east-1"
    assert calls[0]["kwargs"]["use_ssl"] is False
    config = calls[0]["kwargs"]["config"]
    assert config.signature_version == "s3v4"
    assert config.connect_timeout == OBJECT_STORAGE_CONNECT_TIMEOUT_SECONDS
    assert config.read_timeout == OBJECT_STORAGE_READ_TIMEOUT_SECONDS
    assert config.s3 == {"addressing_style": "path"}


def test_create_object_storage_auto_creates_bucket(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeS3Client()
    monkeypatch.setattr("fast_core.storage.factory.boto3.client", lambda *_, **__: fake)

    create_object_storage(make_app_settings(OBJECT_STORAGE_AUTO_CREATE_BUCKET=True))

    assert fake.created_buckets == ["fast-platform"]
