# 代码实现规范

本文档承接 `docs/architecture.md` 的项目级架构总纲，定义代码实现标准，只包含规则和必要示例。涉及具体写法、示例和检查清单时，以本文档为准。

## 项目结构

```text
.
├── apps/          # 可运行应用
├── modules/       # 业务模块包
├── packages/      # 跨模块公共包
├── deploy/        # 部署配置
├── scripts/       # 仓库级脚本
└── docs/          # 文档
```

**依赖方向（单向）：**

```text
apps/* -> modules/* -> packages/*
apps/* -> packages/*
```

**禁止：**

```text
packages/* -> modules/* 或 apps/*
modules/* -> apps/*
modules/<a> -> modules/<b>.services/.repositories/.routers/.models
Repository -> Service
Service -> Router
```

**命名约定：**

- 目录名：`modules/<name>` 或 `packages/<name>`
- 分发包名：`fast-<name>`
- import 包名：`fast_<name>`
- 源码入口：`src/fast_<name>/`

**导入规范：**

- 跨包使用显式子模块导入：`from fast_core.security import verify_password`
- `__init__.py` 保持极简
- 模块内使用包名绝对导入

**依赖边界由 import-linter 在 CI 中强制。**

---

## 新增业务能力流程

1. 确认模块 owner 和表 owner
2. 需数据库表：新增 `models.py`（ORM model），接入 `model_registry.py`，提交 migration
3. 新增 `schemas.py`（API DTO、request/response schema）
4. 新增 `repository.py`（数据访问）
5. 新增 `service.py`（constructor injection）
6. 在 `deps.py` 添加 `get_xxx` 工厂 + `XxxDep` 别名
7. 新增 `routers/`，endpoint 注入 `XxxServiceDep`
8. 新增 `module.py` 聚合路由，在 `api_router.py` 显式 include
9. 需跨模块调用：新增 `public.py`，在 `deps.py` 暴露 `PublicApiDep`
10. 更新 import-linter；提交 migration + 单测 + API 测试

---

## 模块内部结构

```text
src/fast_<name>/
├── deps.py             # FastAPI 装配根
├── module.py           # 模块入口
├── routers/
├── service.py          # 或 services/
├── repository.py       # 或 repositories/
├── schemas.py
├── models.py
└── public.py           # 需跨模块调用时才创建
```

**文件职责：**

- `models.py`：SQLModel `table=True` ORM model、显式字段、relationship
- `schemas.py`：API DTO、request body、response model、非 table schema
- `repository.py`：数据库读写、查询表达式
- `service.py`：业务逻辑、业务规则、流程编排
- `deps.py`：FastAPI Depends 工厂 + `*Dep` 别名
- `module.py`：聚合 routers/，导出单一入口
- `public.py`：跨模块稳定 API

**规则：**

- 没有实际职责的文件直接省略
- 每个业务模块必须维护 `README.md`：模块职责、表 Owner、Public API、主要依赖
- 不使用 `crud.py`

---

## FastAPI 分层规范

### Scope 模型

```text
APP scope（lifespan 创建，存入 app.state）
  -> settings、engine、http client、redis、SDK client

REQUEST scope（Depends 自动缓存）
  -> Session、current_user、Repository、Service
```

**规则：**

- 无状态且构造昂贵的对象放 APP scope
- Service、Repository 默认 REQUEST scope
- 同请求内复用同一 dependency function
- Service/Repository 不读取 `app.state`

---

### Router 规范

**规则：**

- Router 只处理 HTTP 输入输出、状态码、response model
- Endpoint 参数顺序：Path → Body/Form/File → Query → Request Context Dep → Service Dep
- Service 参数：`xxx_service: XxxServiceDep`（变量名体现业务语义）
- 只鉴权/校验的 dependency 放 `dependencies=[Depends(...)]`
- Body 参数优先用 DTO（`payload: UserSearchBody`）
- 每个 endpoint 通常只调 1 个 Service 方法
- 不直接访问 Repository、不访问 `app.state`
- 不翻译 Service 返回的枚举/sentinel 为 HTTP 错误；Service 直接抛公共错误类
- 不用 `HTTPException` 表达业务失败

**示例：**

```python
@router.patch("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateBody,
    current_user: CurrentUserDep,
    user_service: UserServiceDep,
) -> UserPublic:
    return user_service.update_user(
        user_id=user_id,
        payload=payload,
        actor=current_user,
    )
```

---

### Service 规范

**规则：**

- Service 是普通 Python 类，constructor injection，构造参数必须有类型注解
- 方法参数只表达业务输入
- 不 import `fastapi`，不出现 `Depends`/`Request`/`Response`/`HTTPException`
- 不读取 `app.state`
- 业务错误用 `fast_core.errors` 公共错误类，抛出位置写明错误信息
- 多 Service 协作由 Workflow/Application Service 编排

**Service 分类：**

- Application/Workflow Service：编排完整用例，负责事务边界
- Domain Service：承载领域规则
- Query Service：只读查询
- Infrastructure Service：封装 token、password、email、storage、外部 API

---

### Repository 规范

**规则：**

- 使用注入的 Session，不自建 engine
- 只负责 `add`/`delete`/`select`/`flush` 和查询封装
- 写操作默认 `flush`，事务提交由上层控制
- 不调 Service、不处理 HTTP、不发邮件、不生 token、不调第三方业务 API

---

### deps.py 装配规范

**规则：**

- `deps.py` 可 import `fastapi.Depends`；Service/Repository 不可
- 工厂函数只装配对象，不写业务逻辑
- 工厂直接依赖稳定的 `*Dep` 别名，不通过参数传递固定依赖
- Router 只注入 `*Dep`
- `dependency_overrides` 以工厂函数为 key，函数名保持稳定

**示例：**

```python
from typing import Annotated
from fastapi import Depends
from fast_core.deps import SessionDep
from fast_project.services.project_service import ProjectService

def get_project_service(session: SessionDep) -> ProjectService:
    return ProjectService(session=session)

ProjectServiceDep = Annotated[ProjectService, Depends(get_project_service)]
```

---

## 错误处理规范

**成功响应：**

- 直接返回资源 DTO 或 response schema
- 不使用统一 `ApiResponse` 包装
- 创建返回 201，删除返回 204
- 不用 HTTP 200 表达业务失败

**公共错误类（`fast_core.errors`）：**

```python
class AppError(Exception):
    status_code = 500
    default_detail = "Internal Server Error"

class BadRequestError(AppError):    status_code = 400
class UnauthorizedError(AppError):  status_code = 401
class ForbiddenError(AppError):     status_code = 403
class NotFoundError(AppError):      status_code = 404
class ConflictError(AppError):      status_code = 409
```

**业务错误规则：**

- 公共错误类放在 `fast_core.errors`
- 业务代码直接抛公共错误类，在抛出位置写清错误信息
- 不在模块内为普通 HTTP 错误维护 `exceptions.py`
- 只有需要承载额外领域状态时，才新增模块自定义异常

**使用示例：**

```python
from fast_core.errors import BadRequestError, ConflictError, NotFoundError

def get_resource(resource_id: uuid.UUID) -> Resource:
    resource = repository.get(resource_id)
    if resource is None:
        raise NotFoundError("Resource not found")
    return resource

def create_resource(payload: ResourceCreate) -> Resource:
    if repository.exists(name=payload.name):
        raise ConflictError("Resource already exists")
    return repository.create(payload)
```

**全局 exception handler（注册在应用层）：**

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fast_core.errors import AppError

def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

async def app_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):
        raise exc
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})
```

**错误响应约定：**

- 客户端优先根据 HTTP status code 判断错误类型
- 响应体 `detail` 只承载可展示的错误描述
- 不引入业务自定义 code 字段作为默认错误分类机制

---

## 事务规范

```text
Repository         -> add/delete/select/flush（不 commit）
Domain/Query Svc   -> 不 commit
Application Svc    -> 控制事务边界，显式 commit
```

**规则：**

- 跨多个写操作由 Application/Workflow Service 控制事务
- 事务内只做数据库操作
- 邮件、HTTP 请求、消息推送等外部副作用放在事务提交之后
- self-committing 方法必须在 docstring 标明 `Transaction: self-committing`
- self-committing 方法只用于独立原子动作

---

## 依赖边界与跨模块调用

**依赖方向规则：**

- `packages/*` 只承载跨模块基础能力，不依赖 `modules/*` 或 `apps/*`
- `modules/*` 不依赖 `apps/*`
- `modules/<a>` 调用 `modules/<b>` 时，只通过 `<b>.public`、`<b>.deps` 或 `<b>.schemas`
- 禁止 `modules/<a>` 导入 `modules/<b>.services/.repositories/.routers` 或内部 ORM model

**跨模块调用规则：**

- 跨模块调用只能通过对方模块的 `public.py` 和稳定 schema
- public API 应少而稳定，返回稳定 schema 或普通值，不返回内部 ORM 对象
- public API 需在模块 README 中说明用途和调用方边界
- 没有跨模块调用面时，不创建空 `public.py`
- 两个模块互相依赖时，优先抽出更底层模块或新增 Workflow
- 副作用通知在有基础设施后使用 Event/outbox

**允许：**

```python
from fast_project.public import ProjectPublicApi
from fast_project.deps import ProjectPublicApiDep
from fast_project.schemas import ProjectPublic
```

**禁止：**

```python
from fast_project.services.project_service import ProjectService
from fast_project.repositories.project_repository import ProjectRepository
from fast_project.models import Project
```

**import-linter 在 CI 中强制约束，新增模块时同步更新 root_packages 和 forbidden_modules。**

---

## 模型与迁移规范

**models.py vs schemas.py 分工：**

- `models.py`：SQLModel `table=True` ORM model、显式数据库字段、relationship、数据库默认值函数
- `schemas.py`：API DTO、request body、response model、分页响应、Message、Token 等非 table schema

**规则：**

- 每个表只能有一个模块 owner
- 表字段必须在模块 model 中显式声明，不使用跨包 mixin 隐藏字段
- 默认主键：应用侧生成 UUID；默认时间：timezone-aware UTC `created_at`
- `schemas.py` 不放 ORM model；`models.py` 不放 API schema
- Alembic `env.py` 必须在生成 `target_metadata` 前 import 所有模块 table model
- 新增或修改 table 必须提交 migration 文件
- public API 不返回内部 ORM table 对象

**model_registry 示例：**

```python
# apps/api/app/model_registry.py
from fast_auth.models import User
from fast_items.models import Item

__all__ = ["User", "Item"]
```

```python
# apps/api/app/alembic/env.py
import app.model_registry  # noqa: F401
from sqlmodel import SQLModel

target_metadata = SQLModel.metadata
```

---

## API 查询规范

### 分页

- 新列表接口复用 `fast_core.pagination` 提供的 `PaginationParams` 和 `Page[T]`
- 不重复定义只表达通用分页语义的 schema
- 默认分页大小和最大分页大小由公共组件定义
- OpenAPI 中分页响应结构必须稳定

### 排序和过滤

- 排序参数使用统一格式：`sort=created_at:desc`
- 每个列表接口声明允许排序字段白名单
- 每个列表接口声明允许过滤字段白名单
- 客户端不得传入任意数据库字段名
- 默认排序必须稳定，避免分页漂移
- 非法排序或过滤字段返回明确错误
- Repository 只接收已解析、已校验的排序和过滤条件，不解析 HTTP 查询参数

---

## 应用装配规范

**推荐结构：**

```text
apps/api/
├── app/
│   ├── main.py                 # ASGI app 暴露点
│   ├── bootstrap.py            # create_app
│   ├── api_router.py           # 汇总所有模块 router
│   ├── exception_handlers.py
│   └── alembic/
├── alembic.ini
└── tests/
```

**规则：**

- 所有模块通过 `module.py` 提供单一入口，应用层只导入 `<feature>_module` 并注册 `router`
- 应用层在 `exception_handlers.py` 统一注册异常处理，模块不各自注册业务异常
- 应用默认只在装配层挂载 `/api`
- `api_router.py` 只聚合模块 router，不使用 `/api/v1` 作为全局统一前缀
- 需要版本化的接口由所属 router 显式声明 `/v1`、`/v2` 路径段；不需要版本化的接口直接声明业务路径
- 同一模块不要为了兼容 `/api` 和 `/api/v1` 注册两次；兼容旧路径时使用明确的 legacy router，并隐藏 OpenAPI 或标注废弃

**bootstrap 示例：**

```python
# apps/api/app/bootstrap.py
from fastapi import FastAPI

from app.api_router import api_router

def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(api_router, prefix="/api")
    return app
```

**api_router 示例：**

```python
# apps/api/app/api_router.py
from fastapi import APIRouter
from fast_auth.module import auth_module
from fast_items.module import items_module

api_router = APIRouter()
api_router.include_router(auth_module.router)
api_router.include_router(items_module.router)
```

**module.py 示例：**

```python
# modules/auth/src/fast_auth/module.py
from dataclasses import dataclass
from fastapi import APIRouter
from fast_auth.routers import login, users

@dataclass(frozen=True)
class AuthModule:
    router: APIRouter

def create_auth_module() -> AuthModule:
    router = APIRouter()
    router.include_router(login.router)
    router.include_router(users.router)
    return AuthModule(router=router)

auth_module = create_auth_module()
```

**版本化接口示例：**

```python
# modules/tasks/src/fast_tasks/routers/admin_tasks.py
from fastapi import APIRouter

router = APIRouter(tags=["tasks"])

@router.get("/v1/admin/tasks/stats", response_model=AdminTaskStatsPublic)
def get_v1_task_stats(...) -> AdminTaskStatsPublic:
    ...

@router.get("/tenant/tasks", response_model=TenantTaskListPublic)
def list_tenant_tasks(...) -> TenantTaskListPublic:
    ...
```

---

## 测试规范

**Service 单测：**

```python
def test_login() -> None:
    users = UserService(session=FakeSession(), settings=fake_settings)
    auth = AuthService(session=FakeSession(), users=users)

    result = auth.create_access_token_for_login(email="a@b.com", password="pw")

    assert result.access_token != ""
```

**API 测试：**

```python
def test_login_route() -> None:
    app = create_app()
    app.dependency_overrides[get_auth_service] = lambda: FakeAuthService()

    client = TestClient(app)
    response = client.post("/api/login/access-token",
                           data={"username": "a@b.com", "password": "pw"})

    assert response.status_code == 200
```

**规则：**

- Service 单测直接构造实例，注入 Fake，不启动 FastAPI
- Service 单测直接断言公共错误类和错误信息
- Repository 测试使用测试数据库 session
- API 测试通过 `dependency_overrides` 替换工厂函数，以工厂函数为 key
- API 错误响应断言 HTTP status code 和 `detail`
- 不 monkeypatch 全局单例

**pytest markers：**

- `unit`：纯单元测试，不依赖数据库、网络、TestClient
- `integration`：依赖数据库、文件系统或外部进程
- `api`：通过 TestClient 或 HTTP client 覆盖 API 行为
- `slow`：耗时较长或只适合提交前执行

---

## 运行期基础能力

### 结构化日志

日志使用 JSON 结构，字段至少包含：`timestamp`、`level`、`logger`、`message`、`request_id`。

HTTP 请求日志包含：`path`、`method`、`status_code`、`duration_ms`。

**规则：**

- 未处理异常必须记录 stack trace，响应体只返回 `{"detail": "Internal Server Error"}`
- 日志必须脱敏：`token`、`password`、`secret`、`authorization` 等敏感字段
- 敏感配置和凭据不得以明文进入日志

### 请求上下文

**规则：**

- 请求携带合法 `X-Request-ID` 时透传；未携带时生成新 request id
- 响应头必须包含 `X-Request-ID`
- request id 写入 context var，供日志 formatter 读取
- 并发请求之间 request id 必须隔离

### 健康检查

- `/livez`：只判断进程是否可响应，不依赖数据库或外部服务
- `/readyz`：检查数据库连接、migration 版本和关键 app scope 资源

**部署探针约定：**

- 存活探针：`GET /api/livez`
- 就绪探针：`GET /api/readyz`（返回非 2xx 时，编排系统停止接入流量）

### 安全基础项

**规则：**

- CORS 按环境校验，production 禁止 `*`
- production 禁止 debug、reload、测试邮件服务和不安全占位密钥
- 应用统一添加安全响应头
- 登录、令牌签发、密码重置等敏感接口必须接入限流策略
- 限流策略必须可配置，并通过测试覆盖成功和失败路径

---

## OpenAPI 治理规范

**规则：**

- Router tags 与业务模块边界保持一致
- 面向业务用户的 OpenAPI 文案使用当前产品文档语言，包括 tag 名称、tag description、endpoint summary、endpoint description、response_description、参数说明和字段说明
- OpenAPI schema component key 和 schema title 使用代码类型名，例如 `UserPublic`、`TaskCreateBody`、`AttemptStateResponse`
- API schema 字段名保持契约字段名；字段 title 和 description 使用当前产品文档语言
- 每个模块在 `src/fast_<name>/openapi.py` 维护本模块 `OPENAPI_TAGS`，模块专用应用和平台应用复用同一份 tag 元数据
- 全局应用只按路由挂载顺序汇总各模块 `OPENAPI_TAGS` 和应用自有 tag；删除或重命名 router tag 时同步更新所属模块的 tag 元数据
- 模块专用应用必须传入模块专用 `openapi_tags`，只展示该模块实际对外暴露的 tag 和接口
- `operation_id` 使用稳定命名规则，避免随机生成或冲突
- Schema 命名保持稳定，避免因内部重命名造成无意义 diff
- 内部接口、不稳定接口和仅用于诊断的接口明确隐藏或标记
- 新增或修改公开 API 时，PR 描述说明 OpenAPI 契约变化；破坏性变化必须给出迁移说明
- 新增或修改 OpenAPI 文档生成规则时，必须覆盖回归测试：tag 列表、模块文档接口范围、schema component key、schema title、字段 title 和 description

**文档语言分工：**

```text
面向人阅读的文档文案  -> 当前产品文档语言
契约和代码类型标识    -> 英文代码名
```

**schema 示例：**

```python
class TaskStateResponse(SQLModel):
    task_id: uuid.UUID = Field(
        title="任务标识",
        description="任务的唯一标识。",
    )
```

生成的 OpenAPI component key 和 schema title 应为 `TaskStateResponse`，字段 `task_id` 的 title 和 description 使用产品文档语言。

---

## 架构治理规范

### 公共能力准入（fast-core）

`packages/core` 只承载跨模块复用、无业务语义、可稳定演进的基础能力。

新增公共能力进入 `fast-core` 前必须满足：

1. 至少被两个模块复用，或已被一个模块使用且第二个使用方已在 roadmap/issue/PR 中列出
2. API 名称和参数不包含业务领域语义（user、item、order 等）
3. 能力可独立测试，不依赖真实应用启动或业务数据库状态
4. 不引入 `packages/* -> modules/*` 或 `packages/* -> apps/*` 反向依赖

新增或修改公共能力必须包含测试。涉及公共 API、配置项、错误结构、dependency alias 或返回值的 breaking change，必须给出影响范围、迁移步骤和回滚方案。

### ADR 决策记录

涉及依赖装配、事务、错误格式、模块边界、CI、部署方式等重大架构变化时，必须新增 ADR，存放在 `docs/adr/`。

ADR 状态：`proposed`、`accepted`、`deprecated`、`superseded`（必须链接替代 ADR）。

ADR 必须包含：背景、决策、备选方案、影响范围、回滚条件。修改已接受决策时新建 ADR，不直接重写历史结论。

### 废弃和迁移

- 废弃能力只作为兼容层存在，不承载新业务逻辑
- 兼容层只允许转调新 Service、Repository 或 `fast-core` 能力
- 确需保留废弃项时，必须写明：当前使用位置、迁移方向、替代 API、删除条件
- 迁移完成后删除兼容层

---

## Workspace 与工具链

**Workspace 配置（根 pyproject.toml）：**

```toml
[tool.uv.workspace]
members = [
    "apps/<app>",
    "modules/<module>",
    "packages/<package>",
]
```

**新增成员时同步：**

1. `[tool.uv.workspace].members` 添加成员
2. `[tool.pyright].extraPaths` 添加源码根
3. 依赖方 `pyproject.toml` 声明依赖
4. 运行 `uv lock`

**路径添加规则：**

```text
apps/<app>           -> extraPaths: apps/<app>
modules/<module>     -> extraPaths: modules/<module>/src
packages/<package>   -> extraPaths: packages/<package>/src
```

**工具链（只使用以下三个）：**

- Ruff：格式化、lint、import 排序
- Pyright：类型检查
- import-linter：依赖方向和模块边界检查

```bash
uv run ruff format apps modules packages
uv run ruff check apps modules packages
uv run pyright apps modules packages
uv run lint-imports
```

**验证分级：**

- `scripts/verify.py --fast`：Ruff format check + Ruff lint + 非 slow 测试（开发中快速反馈）
- `scripts/verify.py --full`：完整质量门禁（提交前 / CI 等价）

---

## 编辑器与静态分析路径规范

**Pyright 配置（根 pyproject.toml）：**

```toml
[tool.pyright]
pythonVersion = "3.11"
venvPath = "."
venv = ".venv"
typeCheckingMode = "standard"
extraPaths = [
    "apps/<app>",
    "modules/<module>/src",
    "packages/<package>/src",
]
```

**VSCode 只负责解释器路径（.vscode/settings.json）：**

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/.venv/bin/python"
}
```

**编辑器跳转异常时，按顺序检查：**

1. VS Code 解释器是否指向 `.venv/bin/python`
2. `extraPaths` 是否包含目标包的源码根
3. `[tool.uv.workspace].members` 是否包含目标成员
4. 依赖方 `pyproject.toml` 是否声明对应依赖

---

## 部署目录规范

```text
deploy/
└── compose/
    ├── compose.yml
    ├── compose.override.yml
    └── compose.traefik.yml
```

**约定：**

- Dockerfile 放在对应应用目录（`apps/<app>/Dockerfile`）
- Compose 文件放在 `deploy/compose/`
- 从仓库根目录执行 Compose 命令，使用 `--project-directory .`
- Compose build context 指向仓库根目录

```bash
docker compose \
  --project-directory . \
  --env-file .env.development \
  -f deploy/compose/compose.yml \
  -f deploy/compose/compose.override.yml \
  up -d
```

- 生产部署使用 `compose.yml` + `.env.production`
- 敏感配置由系统环境变量或部署平台 secret 覆盖
