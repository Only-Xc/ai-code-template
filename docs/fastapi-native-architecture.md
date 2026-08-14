# FastAPI 原生分层架构规范

本文档定义后端新代码的目标架构标准：基于 FastAPI 原生能力完成分层、依赖装配、测试替换和应用启动，不引入第三方 DI 容器。

本规范适用于未来新增模块和现有模块后续重构。它不是当前代码现状说明。当前仓库仍保留部分 FastAPI template 风格代码；旧代码迁移顺序、兼容策略和分阶段替换计划应放在独立迁移文档中，不混入本规范。

FastAPI 原生方案与第三方 DI 容器方案是两套互斥标准：

```text
FastAPI 原生
  -> 使用 FastAPI Depends / lifespan / dependency_overrides。
  -> 不引入 dishka、dependency-injector 等第三方 DI 容器。

Spring 风格 IoC
  -> 使用项目级 IoC API，底层适配第三方 DI 容器。
  -> 追求更接近 Spring Boot 的容器体验。
```

项目落地时只能选择其中一种作为后端依赖装配标准。

## 目标

```text
1. 业务代码按 Router -> Service -> Repository 分层开发。
2. Router 保持函数式 FastAPI APIRouter，不引入 Controller 类。
3. Service 使用 constructor injection，业务层不接触 Depends、Request、Response、app.state。
4. Repository 只负责数据访问，不承载业务流程。
5. 依赖装配集中在 FastAPI dependency 工厂函数和 Annotated 类型别名中。
6. app 级对象由 lifespan 管理，请求级对象由 Depends 管理。
7. 跨模块依赖只走 public API，并由 import-linter 在 CI 中约束。
8. 测试通过直接构造 Service 或 dependency_overrides 替换依赖。
```

## 非目标

```text
1. 不提供 NestJS / Spring 那种自动扫描类、自动注册 provider 的容器模型。
2. 不在业务层引入 Provider、Container、Inject 等概念。
3. 不要求旧模块一次性改造为本规范。
4. 不把模块目录存在本身视为已注册；路由、模型、迁移都必须显式接入。
5. 不用事件/RPC 作为当前模块解耦的默认机制；没有基础设施前只定义契约，不发布事件。
```

## 总体架构

```text
apps/api
  -> FastAPI 应用入口
  -> 创建 app、配置 lifespan、注册模块 router、注册异常处理、执行启动期校验

packages/core
  -> 跨模块基础设施
  -> settings、database、deps、unit_of_work、exceptions、logging、events contract

modules/<name>
  -> 业务 Feature Package
  -> router、service、repository、schemas、models、public API
```

依赖方向：

```text
apps/api
  -> modules/*
  -> packages/core

modules/*
  -> packages/core
  -> 其他 modules 的 public API，可选

packages/core
  -> 不依赖 apps/*
  -> 不依赖 modules/*
```

禁止方向：

```text
packages/core -> modules/*
modules/* -> apps/*
modules/<a> -> modules/<b>.services / repositories / routers / internal models
Repository -> Service
Service -> Router
```

## 推荐目录结构

### apps/api

```text
apps/api/
├── app/
│   ├── main.py                 # ASGI app 暴露点
│   ├── bootstrap.py            # create_app
│   ├── lifespan.py             # 可选：app scope 单例初始化与释放
│   ├── api_router.py           # 汇总所有模块 router
│   ├── exception_handlers.py
│   └── alembic/                # Alembic migration scripts
├── alembic.ini
└── tests/
```

当前仓库的 `apps/api/app/main.py` 是 ASGI app 暴露点；新模块接入时应使用 `create_app + api_router` 的结构。

### packages/core

```text
packages/core/
├── pyproject.toml
└── src/
    └── fast_core/
        ├── settings.py
        ├── database.py
        ├── deps.py             # SettingsDep / EngineDep / SessionDep / UowDep
        ├── unit_of_work.py
        ├── exceptions.py
        ├── logging.py
        └── events.py           # 事件契约，不代表已有事件总线
```

### modules/<name>

最小结构：

```text
modules/<name>/
├── pyproject.toml
├── src/
│   └── fast_<name>/
│       ├── __init__.py
│       ├── deps.py             # 当前模块的 FastAPI 装配根
│       ├── module.py           # 模块单一入口:聚合 routers/ 并导出模块能力
│       ├── routers/            # 一个或多个 FastAPI APIRouter
│       ├── service.py          # 或 services/，按模块复杂度选择
│       └── schemas.py
└── tests/
```

条件文件：

```text
repository.py / repositories/
  -> 需要数据库访问时添加。

models.py
  -> 当前模块拥有数据库表时添加，只放 ORM/table model 和数据库相关定义，并接入 Alembic model import。

schemas.py
  -> 当前模块的 API DTO、请求体、响应体和通用消息 schema。不得放入 models.py。

public.py
  -> 需要被其他模块调用时添加。

dependencies.py / permissions.py
  -> 仅当模块有复杂认证、授权或请求依赖时添加。

events.py
  -> 仅定义事件契约；没有 outbox / broker / event bus 前不得发布跨模块事件。

module.py
  -> 模块单一入口,负责聚合 routers/ 并向应用层导出模块能力。所有业务模块都应提供。

README.md
  -> 模块边界、表归属或外部依赖复杂时添加。
```

不使用模块内 `crud.py`。数据访问归 Repository，业务能力归 Service；`crud.py` 既不是模块 public API，也不是 Repository 的替代品。若旧代码仍需要 `app.crud` 兼容入口，应将兼容层放在 app/legacy 边界，并让它直接调用新模块的 Service / Repository，不在 `modules/<name>/` 内保留二级 CRUD 门面。

不要为了目录完整性创建空文件。模块结构应服务于当前复杂度。

命名约定：

```text
目录名: packages/core     分发包名: fast-core     import 包名: fast_core
目录名: modules/<name>    分发包名: fast-<name>   import 包名: fast_<name>
```

## Scope 模型

FastAPI 原生方案只使用两级 scope：

```text
APP scope
  -> lifespan 创建，存入 app.state，通过 accessor dependency 读出。
  -> settings、database engine、http client、redis pool、第三方 SDK client。

REQUEST scope
  -> FastAPI Depends 在单个请求内自动缓存 dependency function 的结果。
  -> Session、UnitOfWork、current_user、Repository、Service。
```

规则：

```text
1. 无状态且构造昂贵的基础设施对象放 APP scope。
2. Service、Repository 默认 REQUEST scope。
3. 请求态对象不得放入 app.state。
4. Service / Repository 不接收 Request，不读取 app.state。
5. 同一个请求内必须复用同一个 dependency function，避免缓存失效。
```

示例：

```python
# 可选：apps/api/app/lifespan.py
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from sqlmodel import create_engine

from fast_core.settings import load_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    http = httpx.AsyncClient()

    app.state.settings = settings
    app.state.engine = engine
    app.state.http = http

    try:
        yield
    finally:
        await http.aclose()
        engine.dispose()
```

## Core Depends

基础 dependency 集中在 `fast_core.deps`。业务模块只能复用这些别名，不重复定义数据库 session 生命周期。

```python
# packages/core/src/fast_core/deps.py
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import Engine
from sqlmodel import Session

from fast_core.settings import Settings


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_engine(request: Request) -> Engine:
    return request.app.state.engine


def get_session(engine: Annotated[Engine, Depends(get_engine)]) -> Iterator[Session]:
    with Session(engine) as session:
        yield session


SettingsDep = Annotated[Settings, Depends(get_settings)]
EngineDep = Annotated[Engine, Depends(get_engine)]
SessionDep = Annotated[Session, Depends(get_session)]
```

`Annotated[X, Depends(...)]` 是本方案减少样板代码的主要手段。模块内稳定依赖应在 `deps.py` 中定义为 `XxxDep` 别名，Router 只消费这些别名，不在 endpoint 中重复写 `Depends(get_xxx)`。

## Service 规范

Service 承载业务逻辑、业务规则和业务流程编排。Service 是普通 Python 类，不依赖 FastAPI。

```python
# modules/user/src/fast_user/services/user_service.py
from sqlmodel import Session

from fast_project.public import ProjectPublicApi


class UserService:
    def __init__(self, session: Session, projects: ProjectPublicApi) -> None:
        self.session = session
        self.projects = projects

    def get_by_id(self, *, user_id: str) -> User | None:
        ...
```

规则：

```text
1. 必须使用 constructor injection。
2. 构造参数必须有类型注解。
3. 不 import fastapi，不出现 Depends / Request / Response / HTTPException。
4. 不读取 app.state，不接收 request。
5. 方法参数只表达业务输入，不传 Session、Request、current_user 这类框架或请求态对象。
6. 业务错误使用模块自定义异常，由 Router 或全局 exception handler 映射为 HTTP 响应。
7. 多 Service 协作优先由 Workflow / Application Service 编排。
8. 允许依赖其他模块的 public API，不允许依赖其他模块内部 Service / Repository。
```

Service 分类：

```text
Application / Workflow Service
  -> 编排完整用例，负责事务边界和跨 Service 协作。

Domain Service
  -> 承载领域规则，尽量少依赖基础设施。

Query Service
  -> 只读查询，不产生副作用。

Infrastructure Service
  -> 封装 token、password、email、storage、clock、外部 API 等能力。
```

## Repository 规范

Repository 只负责数据访问，不负责业务流程。

```python
# modules/user/src/fast_user/repositories/user_repository.py
from sqlmodel import Session


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_by_id(self, *, user_id: str) -> User | None:
        return self.session.get(User, user_id)
```

规则：

```text
1. 只负责数据库读写和查询表达式封装。
2. 使用注入进来的 Session，不自行创建 engine 或连接池。
3. 不调用 Service。
4. 不 import fastapi，不处理 HTTP。
5. 不发送邮件、不生成 token、不调用第三方业务 API。
6. 不自行 commit；写操作默认 flush，由上层事务边界提交。
7. 不新增 `crud.py` 作为数据访问门面；旧式 CRUD 函数应迁移为 Repository 方法或 Service 方法。
```

## 模块装配根 deps.py

每个模块的 `deps.py` 是 FastAPI Depends 与纯净业务类之间的唯一装配层。每个可注入类提供一个工厂函数和一个 `*Dep` 类型别名。

本项目采用固定依赖定义风格：如果底层依赖来源已经确定，例如数据库 session 固定来自 `SessionDep`，配置固定来自 `settings`，则直接在模块 `deps.py` 中引用这些项目级依赖，不再把 `get_session`、`settings`、`send_email` 等从 `create_module(...)` 或 `create_router(...)` 层层传入。

```python
# modules/project/src/fast_project/deps.py
from typing import Annotated

from fastapi import Depends

from fast_core.deps import SessionDep
from fast_project.public import ProjectPublicApi
from fast_project.services.project_service import ProjectService


def get_project_service(session: SessionDep) -> ProjectService:
    return ProjectService(session=session)


def get_project_public_api(session: SessionDep) -> ProjectPublicApi:
    return ProjectPublicApi(session=session)


ProjectServiceDep = Annotated[ProjectService, Depends(get_project_service)]
ProjectPublicApiDep = Annotated[ProjectPublicApi, Depends(get_project_public_api)]
```

禁止把固定依赖参数化后层层透传：

```python
# 不推荐
def create_get_project_service(*, get_session: Callable[..., Any]) -> Callable[..., ProjectService]:
    def get_project_service(
        session: Annotated[Session, Depends(get_session)],
    ) -> ProjectService:
        return ProjectService(session=session)

    return get_project_service


def create_project_module(*, get_session: Callable[..., Any]) -> ProjectModule:
    get_project_service = create_get_project_service(get_session=get_session)
    ...
```

跨模块组合示例：

```python
# modules/user/src/fast_user/deps.py
from typing import Annotated

from fastapi import Depends

from fast_core.deps import SessionDep
from fast_project.deps import ProjectPublicApiDep
from fast_user.services.user_service import UserService


def get_user_service(
    session: SessionDep,
    projects: ProjectPublicApiDep,
) -> UserService:
    return UserService(session=session, projects=projects)


UserServiceDep = Annotated[UserService, Depends(get_user_service)]
```

规则：

```text
1. deps.py 可以 import fastapi.Depends；Service / Repository 不可以。
2. 工厂函数只做对象装配，不写业务逻辑。
3. 工厂函数必须直接依赖稳定的项目级或模块级 `*Dep` 别名，避免把 `get_session`、`settings`、外部回调函数作为参数层层传递。
4. 工厂函数必须复用已有 *Dep 别名，避免重复声明同一 dependency。
5. Router 只注入 *Dep，不直接写复杂 Depends 链。
6. dependency_overrides 以工厂函数为 key，因此工厂函数名必须稳定。
```

## Router 规范

Router 保持 FastAPI 原生函数式写法，只处理 HTTP 输入输出和状态码。

```python
# modules/auth/src/fast_auth/routers/login.py
from fastapi import APIRouter

from fast_auth.deps import AuthServiceDep
from fast_auth.schemas import LoginRequest, TokenPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPublic)
def login(payload: LoginRequest, auth_service: AuthServiceDep) -> TokenPublic:
    result = auth_service.login(email=payload.email, password=payload.password)
    return TokenPublic.from_result(result)
```

多个 Service 同时注入时，变量名必须体现具体服务语义：

```python
def submit_order(
    payload: OrderSubmit,
    order_service: OrderServiceDep,
    payment_service: PaymentServiceDep,
) -> OrderPublic:
    ...
```

不要使用泛变量名：

```python
# 不推荐
def submit_order(payload: OrderSubmit, service: OrderServiceDep) -> OrderPublic:
    ...
```

Endpoint 参数顺序固定为：Path -> Body/Form/File -> Query -> Request Context Dep -> Service Dep。FastAPI 不依赖参数位置解析参数，但固定顺序能让接口输入和注入对象一眼可分。

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

只用于鉴权/校验且返回值不使用的 dependency 放在 route decorator 的 `dependencies` 中，不占用函数参数。

```python
@router.get(
    "/",
    response_model=UsersPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_users(
    skip: int = 0,
    limit: int = 100,
    user_service: UserServiceDep,
) -> UsersPublic:
    return user_service.list_users(skip=skip, limit=limit)
```

如果查询条件来自 JSON body，使用请求 DTO 表达 body，而不是散落多个 body 标量参数：

```python
class UserSearchBody(BaseModel):
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=100, ge=1, le=1000)


@router.post(
    "/search",
    response_model=UsersPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def search_users(
    payload: UserSearchBody,
    user_service: UserServiceDep,
) -> UsersPublic:
    return user_service.list_users(skip=payload.skip, limit=payload.limit)
```

规则：

```text
1. 负责 path、query、body、header、cookie、form 参数解析。
2. 声明 response_model、status_code、tags、dependencies。
3. Service 参数使用 `xxx_service: XxxServiceDep` 形式，类型写依赖别名，变量名写清楚业务语义。
4. 当前用户、权限等请求上下文也使用 `CurrentUserDep`、`CurrentActiveSuperuserDep` 这类别名。
5. Endpoint 参数顺序固定为 Path -> Body/Form/File -> Query -> Request Context Dep -> Service Dep。
6. 只用于鉴权/校验且返回值不使用的 dependency 放到 decorator 的 `dependencies=[Depends(...)]`，不写成 `_ : XxxDep` 参数。
7. Body 参数优先使用 DTO，例如 `payload: UserSearchBody`；多个 body 字段不要散写成多个标量参数。
8. 每个 endpoint 通常只调用一个入口 Service 方法。
9. 不直接访问 Repository。
10. 不访问 app.state / container。
11. 不编排复杂业务流程；多 Service 协作时新增 Workflow / Application Service。
12. HTTPException 只在 Router 或 exception handler 层出现。
```

## 请求级缓存与菱形依赖

FastAPI 按 dependency function 在单个请求内缓存返回值。

```text
AuthService
  -> UserService
      -> ProjectPublicApi
      -> Session
  -> ProjectPublicApi
  -> Session
```

只要所有路径复用同一组 dependency function，单次请求内会得到：

```text
get_session             执行 1 次
get_project_public_api  执行 1 次
get_user_service        执行 1 次
get_auth_service        执行 1 次
```

规则：

```text
1. 默认使用 FastAPI dependency cache。
2. 不要随意设置 use_cache=False。
3. 同一逻辑依赖只允许一个标准工厂函数。
4. 不要在 Router 中手动 new Service 绕过 dependency cache。
```

## 事务规范

默认事务语义：调用方提交，底层只 flush。

```text
Repository
  -> 负责 add / delete / select / flush，不 commit。

Domain Service / Query Service
  -> 不 commit。

Application / Workflow Service
  -> 控制一个业务用例的事务边界。

Router
  -> 不直接控制事务，除非只是临时兼容旧代码。
```

UnitOfWork 示例：

```python
# packages/core/src/fast_core/deps.py
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends

from fast_core.unit_of_work import UnitOfWork


def get_uow(session: SessionDep) -> Iterator[UnitOfWork]:
    uow = UnitOfWork(session)
    yield uow


UowDep = Annotated[UnitOfWork, Depends(get_uow)]
```

```python
class CreateProjectWorkflow:
    def __init__(
        self,
        uow: UnitOfWork,
        projects: ProjectService,
        notifier: NotificationService,
    ) -> None:
        self.uow = uow
        self.projects = projects
        self.notifier = notifier

    def execute(self, *, payload: ProjectCreate) -> ProjectPublic:
        with self.uow.transaction():
            project = self.projects.create(payload=payload)

        self.notifier.notify_created(project_id=project.id)
        return ProjectPublic.from_model(project)
```

规则：

```text
1. 跨多个写操作必须由 Application / Workflow Service 控制事务。
2. 事务内只做数据库操作。
3. 邮件、HTTP 请求、消息推送等外部副作用放在事务提交之后。
4. self-committing 方法必须在 docstring 或注释中标明 Transaction: self-committing。
5. self-committing 方法不得参与跨模块原子用例。
```

## 跨模块调用规范

跨模块调用只能通过对方模块的 `public.py` 和稳定 schema。

```python
# modules/project/src/fast_project/public.py
from sqlmodel import Session

from fast_project.schemas import ProjectPublic


class ProjectPublicApi:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_user(self, *, user_id: str) -> list[ProjectPublic]:
        ...
```

允许：

```python
from fast_project.public import ProjectPublicApi
from fast_project.deps import ProjectPublicApiDep
from fast_project.schemas import ProjectPublic
```

禁止：

```python
from fast_project.services.project_service import ProjectService
from fast_project.repositories.project_repository import ProjectRepository
from fast_project.models import Project
from fast_project.routers.project_router import router
```

规则：

```text
1. public API 应少而稳定。
2. public API 返回稳定 schema 或普通值，不返回内部 ORM table 对象。
3. 跨模块依赖必须能从 import 语句追踪，并由 import-linter 强制。
4. 如果两个模块互相需要能力，优先抽出更底层模块或新增 Workflow，而不是互相 import。
```

## 循环依赖处理

禁止循环依赖。处理顺序：

```text
1. 共享能力抽到更底层模块或 packages/core。
2. 跨业务流程抽成 Application / Workflow Service。
3. 只读依赖拆成 Query Service 或 public query API。
4. 副作用通知在有基础设施后改为 Event / outbox。
5. 仍无法解决时，再考虑 Protocol 接口倒置。
```

禁止把 lazy import、setter 注入、运行时读取 app.state 作为正式方案。

## 应用启动与路由注册

模块目录存在不代表应用已加载。所有 router 必须显式注册。

```python
# apps/api/app/bootstrap.py
from fastapi import FastAPI

from app.api_router import api_router
from app.exception_handlers import register_exception_handlers


def create_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(api_router, prefix="/api")
    return app
```

```python
# apps/api/app/api_router.py
from fastapi import APIRouter

from fast_auth.module import auth_module
from fast_project.module import project_module

api_router = APIRouter()
api_router.include_router(auth_module.router)
api_router.include_router(project_module.router)
```

所有业务模块通过 `module.py` 提供单一入口。应用层只导入 `<feature>_module` 并注册 `<feature>_module.router`，不直接导入模块内 `router.py` 或 `routers/*`。

应用默认 API base path 为 `/api`。`api_router.py` 负责聚合模块 router，具体版本段由模块 router 显式声明：

```python
# modules/project/src/fast_project/routers/projects.py
from fastapi import APIRouter

router = APIRouter(tags=["projects"])

@router.get("/projects")
def list_projects(...):
    ...

@router.get("/v1/projects/{project_id}")
def get_v1_project(project_id: str, ...):
    ...
```

使用这个约定后，未版本化接口路径为 `/api/projects`，版本化接口路径为 `/api/v1/projects/{project_id}`。兼容旧路径时使用单独 legacy router，并在 OpenAPI 中隐藏或标注废弃。

`module.py` 只做模块聚合，不做参数化依赖装配：

```python
# modules/auth/src/fast_auth/module.py
from dataclasses import dataclass
from collections.abc import Callable

from fastapi import APIRouter

from fast_auth.deps import get_current_active_superuser, get_current_user
from fast_auth.models import User
from fast_auth.routers import login, users


@dataclass(frozen=True)
class AuthModule:
    router: APIRouter
    get_current_user: Callable[..., User]
    get_current_active_superuser: Callable[..., User]


def create_auth_module() -> AuthModule:
    router = APIRouter()
    router.include_router(login.router)
    router.include_router(users.router)

    return AuthModule(
        router=router,
        get_current_user=get_current_user,
        get_current_active_superuser=get_current_active_superuser,
    )


auth_module = create_auth_module()
```

禁止在模块入口暴露 `create_module(get_session=..., settings=..., send_email=...)` 这类 wiring API。固定依赖应在 `deps.py` 中一次定义好。

## Models 与 Alembic 规范

如果模块拥有数据库表，必须同时声明表归属、导入路径和 migration。

`models.py` 和 `schemas.py` 必须分工明确：

```text
models.py
  -> SQLModel table=True ORM model、显式数据库字段、relationship、数据库默认值函数。

schemas.py
  -> API DTO、request body、response model、分页响应、Message、Token 等非 table schema。
```

`app.models` 不是全局 schema 出口。它只能承载 app 自己尚未模块化的数据库表，或作为旧代码迁移期的 ORM/model 注册兼容层。业务代码需要 schema 时必须从源头模块导入，例如 `fast_auth.schemas.UserCreate`，不能从 `app.models` 转引。

如果 Alembic 或 `SQLModel.metadata.create_all(...)` 需要注册全部 table model，应使用显式 import 路径或专门的 model registry。registry 只负责 import table model，不导出 API schema，也不作为业务代码依赖入口。

规则：

```text
1. 每个表只能有一个模块 owner。
2. 模块 model 放在本模块 models.py 或 models/ 下。
3. models.py 不定义 API schema；schema 必须放在同模块 schemas.py。
4. app.models 不 re-export 模块 schema；旧兼容也只能保留 ORM/model 注册相关导出。
5. Alembic env.py 必须在生成 target_metadata 前 import 所有模块 table model。
6. 新增或修改 table 必须提交 migration 文件。
7. PR 描述必须说明表 owner、migration 文件、autogenerate 是否覆盖预期 diff。
8. public API 不返回跨模块内部 ORM table 对象。
```

示例：

```python
# apps/api/app/model_registry.py
from fast_auth.models import User
from fast_items.models import Item
from fast_project.models import Project

__all__ = ["Item", "User", "Project"]
```

```python
# apps/api/app/alembic/env.py
import app.model_registry  # noqa: F401

from sqlmodel import SQLModel

target_metadata = SQLModel.metadata
```

如果忘记 import 模块 model，Alembic autogenerate 可能漏表或漏字段。

## import-linter 约束

依赖方向与模块边界必须由 import-linter 在 CI 中强制。示例：

```ini
# .importlinter
[importlinter]
root_packages =
    app
    fast_core
    fast_auth
    fast_user
    fast_project

[importlinter:contract:core-layer]
name = core 不依赖业务模块
source_modules = fast_core
forbidden_modules =
    app
    fast_auth
    fast_user
    fast_project

[importlinter:contract:module-internals]
name = 模块间只能走 public/deps/schemas
type = forbidden
source_modules =
    fast_auth
    fast_user
    fast_project
forbidden_modules =
    fast_auth.services
    fast_auth.repositories
    fast_auth.routers
    fast_user.services
    fast_user.repositories
    fast_user.routers
    fast_project.services
    fast_project.repositories
    fast_project.routers
```

规则：

```text
1. import-linter 必须作为 CI 必过检查。
2. 新增模块时同步更新 root_packages 与 forbidden_modules。
3. 跨模块只允许 import public / deps / schemas。
4. 如果需要例外，必须在文档中说明原因和退出条件。
```

## 测试规范

Service 单测不启动 FastAPI：

```python
def test_login() -> None:
    projects = FakeProjectPublicApi()
    users = UserService(session=FakeSession(), projects=projects)
    auth = AuthService(session=FakeSession(), users=users)

    result = auth.login(email="a@b.com", password="pw")

    assert result.user_id == "u1"
```

API 测试通过 `dependency_overrides` 替换工厂函数：

```python
def test_login_route() -> None:
    app = create_app()
    app.dependency_overrides[get_auth_service] = lambda: FakeAuthService()

    client = TestClient(app)
    response = client.post("/api/auth/login", json={"email": "a@b.com", "password": "pw"})

    assert response.status_code == 200
```

测试规则：

```text
1. Service 单测直接构造实例，注入 Fake。
2. Repository 测试使用测试数据库 session，不访问生产配置。
3. API 测试通过 dependency_overrides 替换工厂函数。
4. 不 monkeypatch 全局单例。
5. 不依赖真实第三方服务。
6. request 级 yield dependency 的生命周期必须在测试中显式覆盖或使用 TestClient 触发。
```

## 新增业务能力流程

```text
1. 明确模块 owner 和表 owner。
2. 如需数据库表，新增 models.py 或 models/，只放 ORM/table model，并接入 Alembic model import 或 model registry。
3. 新增 schemas.py，放 API DTO、request body、response model、Message/Token 等非 table schema。
4. 新增 repository.py 或 repositories/，只写数据访问。
5. 新增 service.py 或 services/，使用 constructor injection。
6. 在 deps.py 增加 get_xxx 工厂函数和 XxxDep 类型别名，直接依赖稳定的项目级/模块级 Dep。
7. 删除或避免新增模块内 crud.py；如需兼容旧 app.crud，在 app/legacy 边界转调 Service / Repository。
8. 新增 routers/ 下的具体路由文件，endpoint 使用 `xxx_service: XxxServiceDep` 注入服务。
9. 新增 module.py 作为模块单一入口，聚合 routers/ 并导出模块能力，不做 `create_module(...依赖参数...)` wiring。
10. 在 apps/api 的 api_router 显式 include `<feature>_module.router`。
11. 如需跨模块调用，在 public.py 暴露稳定 API，并在 deps.py 暴露对应 PublicApiDep。
12. 更新 import-linter 配置。
13. 提交 migration、Service 单测、API 测试。
```

开发者不需要：

```text
1. 手动 new 多层 Service。
2. 在 Service 方法之间传递 Session / Request。
3. 在业务层访问 app.state 或 container。
4. 编写第三方 DI provider。
5. 处理 FastAPI dependency 生命周期细节。
```

## 与第三方 DI 容器的边界

本方案适合以 HTTP API 为主、依赖图可由 FastAPI Depends 表达的后端。出现以下情况时，应重新评估引入第三方 DI 容器方案：

```text
1. 大量非 HTTP 入口需要复用同一套装配，例如 worker、consumer、CLI、scheduler。
2. 需要 app / request 之外的复杂 scope，例如 tenant scope、job scope、session scope。
3. 依赖图非常深，且需要容器级静态校验、循环依赖检测和自动 wiring。
4. 业务团队明确要求接近 Spring Boot / NestJS 的模块与注入体验。
5. FastAPI dependency 工厂数量增长到难以维护。
```

在这些条件出现前，FastAPI 原生 Depends + 每模块 deps.py + import-linter 可以作为低复杂度方案。

## 验收清单

新增或重构模块合入前必须检查：

```text
[ ] Router 只处理 HTTP 输入输出，没有业务编排。
[ ] Service / Repository 没有 import fastapi。
[ ] Service 使用 constructor injection，构造参数都有类型注解。
[ ] Repository 不 commit，不调用 Service。
[ ] 模块内不存在 crud.py；旧 CRUD 兼容入口只允许留在 app/legacy 边界。
[ ] deps.py 中每个可注入对象都有稳定 get_xxx 工厂和 XxxDep 别名。
[ ] deps.py 没有通过 create_get_xxx/get_session/settings 参数化方式层层传递固定依赖。
[ ] Router 中 Service 参数命名为 xxx_service，类型为 XxxServiceDep。
[ ] Endpoint 参数顺序符合 Path -> Body/Form/File -> Query -> Request Context Dep -> Service Dep。
[ ] 只用于鉴权/校验且返回值不使用的 dependency 放在 route decorator 的 dependencies 中。
[ ] Body 参数使用请求 DTO 表达，不散写多个 body 标量参数。
[ ] module.py 是模块单一入口，只聚合 routers/、导出模块能力，不接收 get_session/settings/send_email 等 wiring 参数。
[ ] 跨模块调用只 import public / deps / schemas。
[ ] apps/api 只 include `<feature>_module.router`，不直接 include 模块内 router.py 或 routers/*。
[ ] models.py 只包含 ORM/table 和数据库相关定义，不包含 API schema/DTO。
[ ] schemas.py 承载 API DTO、request body、response model、Message/Token 等非 table schema。
[ ] app.models 不 re-export 模块 schema；业务代码从源头模块 schemas.py 引入 schema。
[ ] 新 model 已被 Alembic env.py import，migration 已提交。
[ ] import-linter 配置覆盖新模块。
[ ] Service 单测和 API 测试覆盖主要路径。
[ ] dependency_overrides 使用工厂函数作为 key。
```

## 最终约定

本项目若选择 FastAPI 原生分层架构，则以本文档为新代码标准。

FastAPI 负责 HTTP 与 dependency 装配；app 级对象走 lifespan + app.state；请求级对象走 Depends 自动缓存；业务代码按 Router -> Service -> Repository 分层；Service 与 Repository 保持纯净并可脱离 FastAPI 单测；装配集中在每个模块的 `deps.py`；跨模块通过 `public.py` 暴露稳定 API；依赖方向、模块边界、模型注册、路由注册和测试替换都必须显式可检查。
