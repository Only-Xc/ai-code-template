# ObjectStorage 架构说明

本文档说明本仓库对象存储基础能力的稳定边界、运行期生命周期、MinIO 接入方式、配置约定和业务模块使用方式。它是 `docs/architecture.md` 中“运行期基础能力”和 `packages/core` 公共能力准入规则在对象存储场景下的具体化。

## 定位

`ObjectStorage` 是项目级对象存储基础设施封装，面向 S3-compatible 对象存储协议。当前部署默认后端是 MinIO，代码层稳定依赖是 S3 API。

目标：

- 为业务模块提供统一、可测试、可替换的对象存储能力。
- 让业务代码依赖 `fast_core.storage.ObjectStorage`，避免散落 boto3 调用。
- 将应用启动、配置读取和 app scope 资源管理放在 `apps/api`。
- 将无业务语义的对象存储原语放在 `packages/core`。
- 保持后续迁移 AWS S3、Ceph RGW、云厂商 S3 兼容网关的空间。

## 总体架构

```text
apps/api
  -> lifespan
    -> create_object_storage(settings)
      -> boto3 S3 client
      -> ObjectStorage
      -> optional ensure_bucket
    -> app.state.object_storage

modules/<feature>
  -> deps.py
    -> ObjectStorageDep
    -> XxxStorage / XxxStore / XxxService
  -> service.py
    -> 业务权限、key 规则、元数据事务、删除补偿
```

职责边界：

- `apps/api`：创建对象存储 client，将其放入 `app.state.object_storage`，参与 readiness 检查。
- `packages/core/src/fast_core/storage`：提供 S3-compatible client factory、基础操作 wrapper、配置模型、DTO 和错误类型。
- `packages/core/src/fast_core/deps.py`：提供 `ObjectStorageDep`，从 `app.state.object_storage` 读取 app scope 资源。
- `modules/*`：定义业务文件语义，例如头像、附件、数据集文件、模型产物；负责 object key、权限、大小限制、content type、数据库元数据和补偿逻辑。
- `Router`：处理 HTTP 输入输出，通过模块 Service 间接使用对象存储。

## 为什么使用 S3 API

MinIO 原生兼容 S3 API。项目通过 `boto3` 访问 S3-compatible endpoint，获得更稳定的后端替换能力。

收益：

- `ObjectStorage` 表达对象存储能力，代码绑定行业通用协议。
- MinIO、AWS S3、Ceph RGW 和多类云厂商 S3 兼容服务可以复用同一套 wrapper。
- 业务模块无需感知具体 SDK。
- 测试可以用 Fake S3 client 覆盖核心行为。

MinIO 专属能力应放在独立扩展中，并在调用方说明后端绑定原因。当前稳定能力只覆盖通用对象存储原语。

## 文件职责

```text
packages/core/src/fast_core/storage/
├── __init__.py
├── client.py
├── errors.py
├── factory.py
└── types.py
```

- `client.py`
  - `ObjectStorage` wrapper。
  - 提供上传、删除、读取元数据、对象存在性检查、bucket 存在性检查、bucket 创建、bucket 确保和预签名下载 URL。

- `factory.py`
  - `create_object_storage(settings)`。
  - 根据 `Settings` 中的对象存储字段创建 boto3 S3 client。
  - 配置 `signature_version="s3v4"` 和 path-style addressing。
  - 在 `OBJECT_STORAGE_AUTO_CREATE_BUCKET=true` 时执行 `ensure_bucket()`。

- `types.py`
  - `UploadResult`。
  - `ObjectMetadata`。
  - `PresignedUrl`。

- `errors.py`
  - `ObjectStorageError`。
  - `ObjectStorageConfigError`。
  - `ObjectStorageNotFoundError`。
  - `ObjectStorageUploadError`。
  - `ObjectStorageDeleteError`。
  - `ObjectStorageBucketError`。

## 生命周期

对象存储 client 属于 APP scope。

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    object_storage = create_object_storage(settings)
    app.state.object_storage = object_storage
    try:
        yield
    finally:
        ...
```

规则：

- 应用层负责创建对象存储 client。
- `packages/core` 提供工厂和 dependency accessor。
- Service 和 Repository 通过 constructor injection 接收依赖。
- Service 和 Repository 不读取 `app.state`。
- 业务模块不自行创建 boto3 client。
- 同步 boto3 client 当前无需显式关闭；后续若切换到异步 client 或自定义 HTTP session，应在 lifespan 退出阶段关闭。

## 稳定 API

当前 `ObjectStorage` 稳定 v1 能力：

```python
put_object(
    *,
    bucket: str,
    key: str,
    body: bytes | BinaryIO,
    content_type: str | None = None,
    metadata: Mapping[str, str] | None = None,
    checksum_sha256: str | None = None,
) -> UploadResult

delete_object(*, bucket: str, key: str) -> None
head_object(*, bucket: str, key: str) -> ObjectMetadata
object_exists(*, bucket: str, key: str) -> bool
bucket_exists(*, bucket: str) -> bool
create_bucket(*, bucket: str) -> None
ensure_bucket(*, bucket: str) -> None
create_presigned_get_url(*, bucket: str, key: str, expires_seconds: int) -> PresignedUrl
```

兼容承诺：

- v1 方法签名保持向后兼容。
- 新能力通过新增方法扩展。
- SDK 原始异常在 wrapper 内转换为 `ObjectStorageError` 子类。
- 错误消息保持脱敏，避免泄漏 endpoint、access key、secret key 和内部连接细节。

## 配置

配置入口在 `fast_core.settings.Settings`：

```text
OBJECT_STORAGE_ENDPOINT=http://localhost:9000
OBJECT_STORAGE_ACCESS_KEY=minioadmin
OBJECT_STORAGE_SECRET_KEY=...
OBJECT_STORAGE_BUCKET=fast-platform
OBJECT_STORAGE_REGION=us-east-1
OBJECT_STORAGE_SECURE=false
OBJECT_STORAGE_PUBLIC_BASE_URL=
OBJECT_STORAGE_AUTO_CREATE_BUCKET=false
OBJECT_STORAGE_READINESS_CHECK_ENABLED=false
```

环境规则：

- production 环境通过部署平台 secret、环境变量或 Secret 管理系统注入凭据。
- production 环境使用预先创建好的 bucket。
- development 和 test 环境可以开启 `OBJECT_STORAGE_AUTO_CREATE_BUCKET`。
- readiness 检查由 `OBJECT_STORAGE_READINESS_CHECK_ENABLED` 控制。
- 服务端访问 endpoint 和浏览器访问 public base URL 分开配置。
- SDK 连接超时和读取超时属于代码默认策略，不进入环境变量；presigned URL 过期时间由调用方传入。

## Bucket 初始化

`OBJECT_STORAGE_AUTO_CREATE_BUCKET=true` 时，factory 在应用启动阶段执行：

```text
create_object_storage(settings)
  -> ObjectStorage(client)
  -> ensure_bucket(bucket=settings.OBJECT_STORAGE_BUCKET)
```

`ensure_bucket()` 是幂等操作：

- bucket 存在时直接返回。
- bucket 缺失时调用 `create_bucket()`。
- bucket 操作失败时抛 `ObjectStorageBucketError`。

推荐策略：

- 开发环境开启自动创建，提升本地启动体验。
- 生产环境由 Terraform、Helm、Compose 初始化脚本或运维流程创建 bucket。
- readiness 检查用于确认运行期 bucket 可访问。

## 业务模块使用方式

业务模块应定义语义化 storage/store/service，封装 object key 和文件规则。

推荐结构：

```text
modules/<feature>/src/fast_<feature>/
├── deps.py
├── service.py
├── repository.py
├── storage.py
└── routers/
```

示例：

```python
class AvatarStorage:
    def __init__(self, storage: ObjectStorage, bucket: str) -> None:
        self.storage = storage
        self.bucket = bucket

    def put_avatar(self, *, user_id: UUID, file_id: UUID, body: bytes) -> UploadResult:
        key = f"users/avatar/{user_id}/{file_id}.webp"
        return self.storage.put_object(
            bucket=self.bucket,
            key=key,
            body=body,
            content_type="image/webp",
            metadata={"owner": "user-avatar"},
        )
```

模块 `deps.py` 负责装配：

```python
def get_avatar_storage(
    object_storage: ObjectStorageDep,
    settings: SettingsDep,
) -> AvatarStorage:
    return AvatarStorage(
        storage=object_storage,
        bucket=settings.OBJECT_STORAGE_BUCKET,
    )
```

Router 注入业务 Service。Service 再使用业务 storage/store，保持 HTTP 层和基础设施层解耦。

## Object Key 规则

业务模块负责生成 object key。

推荐格式：

```text
<module>/<resource_type>/<resource_id>/<file_id>.<ext>
```

示例：

```text
users/avatar/{user_id}/{file_id}.webp
projects/{project_id}/attachments/{file_id}.pdf
datasets/{dataset_id}/raw/{file_id}.csv
models/{model_id}/artifacts/{file_id}.bin
```

规则：

- `file_id` 使用 UUID。
- 扩展名由服务端白名单推导。
- 原始文件名只保存到数据库元数据。
- 数据库存储 `bucket` 和 `object_key`。
- 私有文件通过预签名 URL 下载。
- 公开文件通过明确的 public base URL 规则生成访问地址。
- object key 只使用服务端生成片段和已校验业务 ID。

## 错误处理

`ObjectStorage` 将 boto3 / botocore 异常转换为项目内错误类型。

映射规则：

- 上传失败：`ObjectStorageUploadError`
- 删除失败：`ObjectStorageDeleteError`
- 对象缺失：`ObjectStorageNotFoundError`
- bucket 操作失败：`ObjectStorageBucketError`
- 其他对象存储失败：`ObjectStorageError`
- 配置错误：`ObjectStorageConfigError`

业务 Service 可以按场景继续转换为 `fast_core.errors` 中的 HTTP 语义错误，例如 `NotFoundError`、`BadRequestError` 或 `ConflictError`。

## Readiness

对象存储 readiness 位于应用层。

检查内容：

- `app.state.object_storage` 已初始化。
- 配置的 bucket 可访问。
- 底层 client 在 timeout 范围内返回。

默认策略：

- `OBJECT_STORAGE_READINESS_CHECK_ENABLED=false`。
- 需要强依赖对象存储的部署环境开启该检查。
- readiness 失败时编排系统暂缓接入流量。

## 测试策略

测试分层：

- core 单测使用 Fake S3 client，覆盖 wrapper 行为和错误转换。
- factory 测试使用 monkeypatch 替换 boto3 client，覆盖配置传递和 auto-create bucket。
- 应用 bootstrap 测试验证 lifespan 将 `object_storage` 写入 `app.state`。
- 业务模块测试注入 Fake `ObjectStorage` 或业务 storage/store。
- 上线前执行一次真实 MinIO 集成验证，覆盖 `ensure_bucket`、`put_object`、`head_object`、`create_presigned_get_url` 和 `delete_object`。

## 扩展方向

后续能力按实际业务需求增量加入：

- 默认 bucket 绑定 wrapper。
- public URL helper。
- presigned upload URL。
- multipart upload。
- copy object。
- list objects。
- checksum 校验。
- 文件扫描和异步处理。
- 业务模块级文件引用计数。

扩展规则：

- 通用、跨模块、无业务语义的能力进入 `fast_core.storage`。
- 带业务命名、业务权限和业务流程的能力留在对应模块。
- MinIO 专属能力需要单独说明后端绑定和替换成本。
