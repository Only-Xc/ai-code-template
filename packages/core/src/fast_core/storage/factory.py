import boto3
from botocore.config import Config

from fast_core.settings import Settings
from fast_core.storage.client import ObjectStorage

OBJECT_STORAGE_CONNECT_TIMEOUT_SECONDS = 3
OBJECT_STORAGE_READ_TIMEOUT_SECONDS = 30


def create_object_storage(settings: Settings) -> ObjectStorage:
    # 使用 path style 兼容 MinIO 和大多数 S3-compatible 服务。
    client = boto3.client(
        "s3",
        endpoint_url=settings.OBJECT_STORAGE_ENDPOINT,
        aws_access_key_id=settings.OBJECT_STORAGE_ACCESS_KEY,
        aws_secret_access_key=settings.OBJECT_STORAGE_SECRET_KEY.get_secret_value(),
        region_name=settings.OBJECT_STORAGE_REGION,
        use_ssl=settings.OBJECT_STORAGE_SECURE,
        config=Config(
            signature_version="s3v4",
            connect_timeout=OBJECT_STORAGE_CONNECT_TIMEOUT_SECONDS,
            read_timeout=OBJECT_STORAGE_READ_TIMEOUT_SECONDS,
            s3={"addressing_style": "path"},
        ),
    )
    storage = ObjectStorage(client=client)
    if settings.OBJECT_STORAGE_AUTO_CREATE_BUCKET:
        # 本地开发可自动建桶；生产环境通常由基础设施或 Terraform 预先创建。
        storage.ensure_bucket(bucket=settings.OBJECT_STORAGE_BUCKET)
    return storage
