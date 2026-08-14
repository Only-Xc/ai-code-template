# Monorepo 架构规范

本文档定义项目级 monorepo 组织方式、依赖边界、运行期基础设施边界和架构治理规则。具体代码写法、示例和检查清单由 `docs/coding-rules.md` 承接。

## 文档分工

- `docs/architecture.md`：项目级总纲，记录目录组织、依赖方向、模块边界、运行期基础设施、部署边界、治理规则和专题文档索引。
- `docs/coding-rules.md`：代码实现规范，记录 Router、Service、Repository、DTO、错误、事务、测试和新增能力的落地写法。
- `docs/fastapi-native-architecture.md`：FastAPI 原生依赖装配方案的细化说明。
- `docs/redis-cache-architecture.md`：Redis、缓存、限流、锁、幂等等 Redis-backed 能力的细化说明。
- `docs/object-storage-architecture.md`：MinIO / S3-compatible 对象存储的细化说明。

总纲只记录跨系统长期边界和约束。专题文档记录具体能力的 API、配置、错误处理、测试策略和演进方向。专题文档更新后，如影响跨模块边界、运行期资源或部署约定，需要同步更新本文档。

## 核心架构

后端新代码采用 FastAPI 原生分层架构：

- FastAPI `Depends`、lifespan、`dependency_overrides` 负责依赖装配和测试替换。
- Router 处理 HTTP 输入输出。
- Service 使用普通 Python 类承载业务逻辑、业务规则和流程编排。
- Repository 封装数据库读写和查询表达式。
- `deps.py` 是 FastAPI 依赖与纯业务类之间的装配根。
- 跨模块调用只走 `public.py`、`deps.py` 和稳定 schema。
- import-linter 在 CI 中强制依赖边界。

第三方 DI 容器、自动扫描 provider、全局单例服务作为架构例外处理，需要 ADR 记录原因、影响范围和退出条件。

## 顶层目录

```text
.
├── apps/          # 可运行应用
├── modules/       # 业务模块包
├── packages/      # 跨模块公共包
├── deploy/        # 部署配置
├── scripts/       # 仓库级脚本
├── docs/          # 项目文档
├── pyproject.toml # workspace 根配置
└── uv.lock        # workspace 锁文件
```

目录职责：

- `apps/*`：创建应用、读取配置、管理 lifespan、注册路由、注册异常处理、连接数据库、维护迁移入口。
- `modules/*`：按业务域承载 router、service、repository、schema、model 和 public API。
- `packages/*`：承载 settings、database、deps、unit of work、异常、日志、安全等跨模块基础能力。
- `deploy/*`：部署资产，例如 Docker Compose、反向代理配置、环境部署模板。
- `scripts/*`：仓库级自动化脚本。
- `docs/*`：架构、开发、部署和约定类文档。

## Python 包结构

每个可安装 Python 包使用 `src` layout：

```text
modules/<name>/
├── pyproject.toml
├── README.md
├── src/
│   └── fast_<name>/
│       ├── __init__.py
│       └── ...
└── tests/

packages/<name>/
├── pyproject.toml
├── README.md
├── src/
│   └── fast_<name>/
│       ├── __init__.py
│       └── ...
└── tests/
```

命名约定：

- 目录名：`modules/<name>` 或 `packages/<name>`。
- 分发包名：`fast-<name>`，写入 `[project].name`。
- import 包名：`fast_<name>`。
- 源码入口：`src/fast_<name>/`。

`src/fast_<name>/` 同时提供源码根和 Python import 包边界，避免多包同名文件产生导入冲突，并保持本地开发和安装后的导入路径一致。

## 导入与依赖边界

跨包引用统一使用显式子模块导入：

```python
from fast_core.security import verify_password
from fast_example.models import Example
from fast_example.schemas import ExampleCreate
from fast_example.service import ExampleService
```

导入规则：

- 跨包导入路径使用 `fast_<package>.<submodule>`。
- `__init__.py` 保持极简，只用于标识 Python 包。
- 应用装配代码从模块的 `module.py` 导入模块入口。
- 模块内部使用包名绝对导入。

依赖方向保持单向：

```text
apps/* -> modules/* -> packages/*
apps/* -> packages/*
```

边界规则：

- `packages/*` 只承载跨模块基础能力。
- `modules/*` 承载业务流程和业务规则。
- `apps/*` 负责应用启动、运行时资源初始化和模块路由注册。
- `modules/<a>` 调用 `modules/<b>` 时，只通过 `<b>.public`、`<b>.deps` 或 `<b>.schemas`。
- `packages/*` 排除 `modules/*` 和 `apps/*` 依赖。
- `modules/*` 排除 `apps/*` 依赖。
- `modules/<a>` 排除 `modules/<b>.services`、`modules/<b>.repositories`、`modules/<b>.routers` 和内部 ORM model 依赖。
- Repository 排除 Service 依赖；Service 排除 Router 依赖。

新增模块时同步更新 import-linter 的 root packages 和 forbidden modules。确需例外时，在 PR 或 ADR 中说明原因、影响范围和退出条件。

## FastAPI 分层边界

业务代码按 `Router -> Service -> Repository` 分层。详细编码规则见 `docs/coding-rules.md`。

```text
APP scope
  -> lifespan 创建，存入 app.state，通过 accessor dependency 读出
  -> settings、database engine、http client、redis pool、第三方 SDK client

REQUEST scope
  -> FastAPI Depends 在单个请求内自动缓存 dependency function 的结果
  -> Session、current_user、Repository、Service
```

边界原则：

- app 级资源由 lifespan 管理，请求级对象由 `Depends` 管理。
- Service、Repository 默认 REQUEST scope。
- Service 和 Repository 接收显式构造参数，排除 `app.state` 访问。
- Router 只消费模块 `deps.py` 暴露的 `XxxDep` 别名。
- Router 排除 Repository、`app.state` 和基础设施 client 直接访问。
- Service 承载业务逻辑、业务规则和流程编排。
- Repository 只负责数据库读写和查询表达式封装。
- `deps.py` 是 FastAPI 与纯业务类之间的装配层。
- 错误处理、事务边界、DTO/model 分工、测试替换和 endpoint 参数顺序按 `docs/coding-rules.md` 执行。

## 模块与应用装配

业务模块建议结构：

```text
src/fast_<name>/
├── __init__.py
├── deps.py
├── module.py
├── routers/
├── service.py          # 或 services/
├── repository.py       # 或 repositories/
├── schemas.py
├── models.py
├── public.py
└── ...
```

模块可以按复杂度裁剪文件。没有实际职责的文件直接省略。每个业务模块必须维护 `README.md`，记录模块职责、表 Owner、Public API 和主要依赖。

应用目录位于 `apps/<name>`：

```text
apps/api/
├── app/
│   ├── main.py
│   ├── bootstrap.py
│   ├── api_router.py
│   ├── exception_handlers.py
│   └── alembic/
├── alembic.ini
└── tests/
```

应用职责：

- 创建 FastAPI 应用实例。
- 读取配置。
- 创建 app scope 基础设施对象。
- 注册异常处理。
- 注册模块 router。
- 管理迁移入口。
- 适配部署环境。

所有业务模块通过 `module.py` 提供单一入口。应用层只导入 `<feature>_module` 并注册 `<feature>_module.router`。

## 模型、迁移与跨模块调用

如果模块拥有数据库表，必须同时声明表 owner、导入路径和 migration。具体 ORM、schema、migration 和测试规则见 `docs/coding-rules.md`。

项目级边界：

- 每个表只能有一个模块 owner。
- 表字段必须在模块 model 中显式声明。
- 默认主键策略为应用侧生成 UUID。
- 默认时间策略为 timezone-aware UTC `created_at`。
- Alembic `env.py` 必须在生成 `target_metadata` 前 import 所有模块 table model。
- 新增或修改 table 必须提交 migration 文件。
- public API 返回稳定 schema 或普通值。

需要注册全部 table model 时，使用显式 import 路径或专门的 model registry。registry 只负责 import table model。

```python
# apps/api/app/model_registry.py
from fast_auth.models import User
from fast_items.models import Item
from fast_project.models import Project

__all__ = ["Item", "User", "Project"]
```

跨模块调用只能通过对方模块的 `public.py` 和稳定 schema：

```python
from fast_project.public import ProjectPublicApi
from fast_project.schemas import ProjectPublic
```

跨模块规则：

- public API 应少而稳定。
- public API 需要在模块 README 中说明用途和调用方边界。
- 模块没有跨模块调用面时，省略空 `public.py`，并在 README 中写明当前无 public API。
- 跨模块依赖必须能从 import 语句追踪，并由 import-linter 强制。
- 两个模块互相需要能力时，优先抽出更底层模块或新增 Workflow。
- 只读依赖可以拆成 Query Service 或 public query API。
- 副作用通知在有基础设施后使用 Event / outbox。

## API 契约治理

列表查询接口统一使用公共分页、排序和过滤约定。实现规则见 `docs/coding-rules.md`。

OpenAPI 文档是外部 API 契约：

- Router tags 与业务模块边界保持一致。
- `operation_id` 使用稳定命名规则。
- 常见错误响应应在 OpenAPI 中可见。
- Schema 命名保持稳定，避免因内部重命名造成无意义 diff。
- 内部接口、不稳定接口和仅用于诊断的接口应明确隐藏或标记。
- 生成 OpenAPI 后通过 schema 检查、快照或 diff 检查发现非预期变化。
- 新增或修改公开 API 时，PR 描述应说明 OpenAPI 契约变化。
- 破坏性变化必须给出迁移说明。

## 运行期基础能力

运行期基础能力由应用层实现和注册。公共包只承载跨模块复用的基础能力；只服务单个应用的 middleware、health check、日志配置、限流策略、安全响应头和 OpenAPI tags 放在对应应用目录。

### 基础设施能力边界

数据库、Redis、对象存储、HTTP client、第三方 SDK client 等运行期资源属于 APP scope，由应用 lifespan 创建、放入 `app.state`，并通过 accessor dependency 暴露给请求级依赖。Service、Repository 和业务模块排除 `app.state` 直接访问，通过 constructor injection 接收语义化依赖。

```text
apps/api lifespan
  -> settings
  -> database engine
  -> redis client / cache client
  -> object storage client
  -> http clients / SDK clients
  -> app.state

packages/core
  -> settings / deps / database / cache / storage / errors / logging
  -> 只提供无业务语义的基础能力和 dependency accessor

modules/<feature>
  -> deps.py 装配 XxxCache / XxxStorage / XxxGateway / XxxService
  -> Service 使用语义化依赖
  -> Router 只注入业务 Service
```

通用规则：

- APP scope 资源由应用层创建、关闭和纳入 readiness。
- `packages/core` 提供薄封装、配置模型、错误类型、health helper 和 dependency accessor。
- 业务模块定义自己的 `XxxCache`、`XxxStore`、`XxxStorage`、`XxxGateway`，封装业务 key、bucket path、TTL、权限、降级和补偿策略。
- Router 排除 Redis、S3 client、boto3、httpx client 或第三方 SDK 直接操作。
- Service 可以依赖语义化基础设施类；Repository 只处理数据库访问。
- 基础设施错误在 wrapper 内转换为项目内错误类型；业务 Service 按场景转换为公共 HTTP 语义错误。
- readiness 检查只覆盖运行期关键依赖；liveness 只判断进程可响应。

基础设施能力归属：

- 数据库：engine 属于 APP scope，`Session` 属于 REQUEST scope；Repository 使用注入的 Session，事务边界由 Application / Workflow Service 控制。
- Redis / cache：Redis client 属于 APP scope；通用缓存封装位于 `fast_core.cache`；业务模块通过 `XxxCache` / `XxxStore` 定义 key、TTL 和失败策略。查询缓存默认 best-effort，限流、锁、幂等、会话等强约束能力必须使用专门类并明确 fail-open / fail-closed 策略。细节见 `docs/redis-cache-architecture.md`。
- 对象存储：代码层依赖 S3-compatible `ObjectStorage`，当前部署默认 MinIO；对象存储 client 属于 APP scope；业务模块负责 object key、文件权限、数据库元数据和删除补偿。细节见 `docs/object-storage-architecture.md`。
- 外部 HTTP / SDK client：client 属于 APP scope；公共包只封装无业务语义的通用 client factory；业务调用放在模块级 Gateway / Infrastructure Service 中，负责超时、重试、错误转换和脱敏日志。
- 事件 / outbox：当前不把事件总线作为默认模块解耦机制。跨模块同步调用走 public API；需要可靠副作用通知时，引入 outbox 或事件基础设施，并用 ADR 记录交付语义、事务边界、重试和幂等策略。

### 日志、请求上下文与健康检查

应用日志使用 JSON 结构，字段至少包含 `timestamp`、`level`、`logger`、`message`、`request_id`。HTTP 请求日志包含 `path`、`method`、`status_code` 和 `duration_ms`。日志输出必须脱敏敏感字段，例如 `token`、`password`、`secret`、`authorization`。

应用必须注册 request context middleware，用于生成或透传 `X-Request-ID`：

- 请求带合法 `X-Request-ID` 时透传该值。
- 请求未带 `X-Request-ID` 时生成新 request id。
- 响应头必须包含 `X-Request-ID`。
- request id 写入 context var，供日志 formatter 读取。
- 并发请求之间 request id 必须隔离。

应用提供独立的存活检查和就绪检查：

- `/livez`：只判断进程是否可响应。
- `/readyz`：检查数据库连接、migration 版本和关键 app scope 资源。
- Redis 参与限流、锁、幂等、会话等强约束能力时，应纳入 readiness；只用于 best-effort 查询缓存时可按部署策略选择。
- 对象存储支撑核心上传、下载或文件处理链路时，应纳入 readiness；检查内容至少包含 client 初始化和 bucket 可访问性。
- 外部服务 readiness 只检查启动后必须可用的强依赖。
- 所有 readiness 错误输出必须脱敏。

### 安全基础项

HTTP 基础安全由应用层统一注册，配置项纳入 Settings 和环境文件：

- CORS 按环境校验，production 禁止宽松 `*` 配置。
- production 禁止 debug、reload、测试邮件服务和不安全占位密钥。
- 应用统一添加约定安全响应头。
- 登录、令牌签发、密码重置等敏感接口必须接入基础限流策略。
- 限流策略必须可配置，并通过测试覆盖成功和失败路径。
- 安全失败通过明确 HTTP status code 和 `detail` 响应。

## Workspace、工具链与部署边界

根 `pyproject.toml` 是 workspace 入口：

```toml
[tool.uv.workspace]
members = [
    "apps/<app>",
    "modules/<module>",
    "packages/<package>",
]
```

新增应用、模块或公共包时，同步维护：

- `[tool.uv.workspace].members`
- `[tool.pyright].extraPaths`
- 依赖方 `pyproject.toml`
- `uv.lock`

路径添加规则：

```text
apps/<app>              -> apps/<app>
modules/<module>       -> modules/<module>/src
packages/<package>     -> packages/<package>/src
```

Python 版本固定为 3.11。代码检查只使用 Ruff、Pyright、import-linter。具体命令和测试分层见 `docs/coding-rules.md`。

部署文件统一放在 `deploy/` 下：

```text
deploy/
└── compose/
    ├── compose.yml
    ├── compose.override.yml
    └── compose.traefik.yml
```

部署约定：

- Dockerfile 放在对应应用目录，例如 `apps/<app>/Dockerfile`。
- Compose 文件放在 `deploy/compose/`。
- 从仓库根目录执行 Compose 命令时使用 `--project-directory .`。
- Compose build context 指向仓库根目录。
- 容器内工作目录指向具体应用目录。
- 生产部署使用 `deploy/compose/compose.yml` 和 `.env.production`，敏感配置由系统环境变量、部署平台 secret 或 Secret 管理系统覆盖。

## 架构治理

架构治理文档只记录长期有效的规则、决策和例外，避免记录普通任务进度或一次性验证输出。

### 公共能力准入

`packages/core` 只承载跨模块复用、无业务语义、可稳定演进的基础能力。新增公共能力进入 `fast-core` 前必须满足：

- 至少被两个模块复用；或已被一个模块使用，且第二个明确使用方已在 roadmap、issue 或 PR 描述中列出。
- API 名称、参数和返回值不包含业务领域语义，例如 user、item、order 等概念。
- 能力可独立测试。
- 依赖方向保持 `packages/* -> packages/*`，排除 `packages/* -> modules/*` 或 `packages/* -> apps/*`。

新增或修改公共能力必须包含测试。涉及公共 API、配置项、错误结构、dependency alias、schema 或返回值的 breaking change，必须给出影响范围、迁移步骤、兼容层或回滚方案。

### ADR 决策记录

涉及依赖装配、事务、错误格式、模块边界、CI、部署方式等重大架构变化时，必须新增 ADR。ADR 存放在 `docs/adr/`，状态使用：

- `proposed`：已提出，尚未接受。
- `accepted`：当前有效决策。
- `deprecated`：已废弃决策。
- `superseded`：已被新 ADR 替代，正文必须链接替代 ADR。

ADR 必须包含背景、决策、备选方案、影响范围和回滚条件。修改已接受决策时，新建 ADR。

### 废弃和迁移

废弃能力只允许作为兼容层存在。确需新增或保留废弃项时，必须在对应 PR 或 ADR 中说明当前使用位置、迁移方向、替代 API 和删除条件。

兼容层只允许转调新 Service、Repository 或 `fast-core` 能力。废弃能力迁移完成后删除对应兼容层。

## 新增能力流程

新增业务模块或业务能力的实现步骤见 `docs/coding-rules.md`。本文档只维护跨系统影响检查：

- 是否新增或改变模块边界、表 owner、public API、应用装配或路由注册。
- 是否新增数据库表、migration、model registry 或跨模块 schema。
- 是否新增运行期基础设施资源、Settings 配置、lifespan 装配、readiness 或部署资源。
- 是否需要更新 import-linter、workspace members、Pyright extraPaths 或依赖方 `pyproject.toml`。
- 是否需要新增专题架构文档或 ADR。

新增运行期基础设施能力时：

1. 明确能力归属：应用 app scope 资源、`packages/core` 通用封装、模块级语义化封装。
2. 在 Settings 中定义配置项，并说明 production、development、test 的默认策略。
3. 在应用 lifespan 中创建和关闭资源，并通过 dependency accessor 暴露。
4. 在 readiness 中明确检查策略、超时、脱敏错误和是否可降级。
5. 在业务模块中通过 `XxxCache`、`XxxStorage`、`XxxGateway` 或 Infrastructure Service 使用能力。
6. 为公共封装、应用装配和业务模块使用方式补测试。
7. 能力复杂或有后端绑定时，新增专题架构文档，并在本文档“文档分工”中索引。
8. 涉及模块边界、事务语义、可靠投递或部署方式变化时，新增 ADR。
