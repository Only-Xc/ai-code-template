from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import sentry_sdk
from fast_core.cache import close_redis, create_redis
from fast_core.database import create_engine_from_settings
from fast_core.settings import settings
from fast_core.storage.factory import create_object_storage
from fastapi import APIRouter, FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.exception_handlers import register_exception_handlers
from app.platform.health import ReadinessCache
from app.platform.logging import configure_json_logging
from app.platform.middleware import request_context_middleware
from app.platform.openapi import OPENAPI_TAGS
from app.platform.rate_limit import create_rate_limit_middleware
from app.platform.security_headers import security_headers_middleware


def custom_generate_unique_id(route: APIRoute) -> str:
    # OpenAPI operation_id 直接影响客户端 SDK 生成，使用 tag + 函数名保持稳定。
    return f"{route.tags[0]}-{route.name}"


def docs_url_for_environment(environment: str) -> str | None:
    if environment == "production":
        return None
    return "/docs"


def redoc_url_for_environment(environment: str) -> str | None:
    if environment == "production":
        return None
    return "/redoc"


def openapi_url_for_environment(environment: str) -> str | None:
    if environment == "production":
        return None
    return f"{settings.API_PREFIX}/openapi.json"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # app scope 资源只在进程生命周期内创建一次，请求内通过 dependency accessor 读取。
    engine = create_engine_from_settings(settings)
    redis = create_redis(settings)
    object_storage = create_object_storage(settings)
    app.state.engine = engine
    app.state.redis = redis
    app.state.object_storage = object_storage
    app.state.readiness_cache = ReadinessCache()
    try:
        yield
    finally:
        # 显式释放连接池，避免测试和容器滚动发布时留下未关闭连接。
        await close_redis(redis)
        engine.dispose()


def create_app(
    *,
    router: APIRouter | None = None,
    title: str | None = None,
    openapi_tags: list[dict[str, Any]] | None = None,
) -> FastAPI:
    configure_json_logging()

    if settings.SENTRY_DSN and settings.ENVIRONMENT == "production":
        sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

    app = FastAPI(
        title=title or settings.PROJECT_NAME,
        docs_url=docs_url_for_environment(settings.ENVIRONMENT),
        redoc_url=redoc_url_for_environment(settings.ENVIRONMENT),
        openapi_url=openapi_url_for_environment(settings.ENVIRONMENT),
        openapi_tags=openapi_tags or OPENAPI_TAGS,
        generate_unique_id_function=custom_generate_unique_id,
        lifespan=lifespan,
    )
    register_exception_handlers(app)
    # 敏感入口在路由执行前限流，避免认证、密码重置等逻辑被暴力触发。
    app.middleware("http")(
        create_rate_limit_middleware(
            max_requests=settings.LOGIN_RATE_LIMIT_REQUESTS,
            window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
            paths={
                f"{settings.API_PREFIX}/v1/login/access-token",
                f"{settings.API_PREFIX}/v1/password-recovery/",
                f"{settings.API_PREFIX}/v1/reset-password/",
            },
        )
    )
    app.middleware("http")(security_headers_middleware)
    # request context 放在最外层附近，保证后续日志 formatter 能拿到 request_id。
    app.middleware("http")(request_context_middleware)

    if settings.all_cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.all_cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    if router is not None:
        app.include_router(router, prefix=settings.API_PREFIX)
    return app
