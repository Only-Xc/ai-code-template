from dataclasses import dataclass
from typing import Annotated

from fast_core.cache import RedisDep
from fast_core.deps import EngineDep, ObjectStorageDep, SettingsDep
from fast_core.openapi import merge_common_error_responses
from fastapi import APIRouter, Depends, Request, Response

from app.platform.health import (
    HealthResponse,
    ReadinessCache,
    ReadinessTargets,
    cached_readiness_response,
    liveness_response,
    readiness_http_status,
)

router = APIRouter(tags=["health"], responses=merge_common_error_responses())


@dataclass(frozen=True)
class ReadinessDeps:
    cache: ReadinessCache
    targets: ReadinessTargets


def get_readiness_deps(
    request: Request,
    engine: EngineDep,
    redis: RedisDep,
    object_storage: ObjectStorageDep,
    settings: SettingsDep,
) -> ReadinessDeps:
    # readiness 需要同时读取 app.state 资源和 settings，聚合后让 endpoint 保持轻量。
    return ReadinessDeps(
        cache=request.app.state.readiness_cache,
        targets=ReadinessTargets(
            engine=engine,
            redis=redis,
            object_storage=object_storage,
            object_storage_bucket=settings.OBJECT_STORAGE_BUCKET,
            object_storage_enabled=settings.OBJECT_STORAGE_READINESS_CHECK_ENABLED,
        ),
    )


ReadinessDep = Annotated[ReadinessDeps, Depends(get_readiness_deps)]


@router.get("/livez", response_model=HealthResponse)
def livez() -> HealthResponse:
    # liveness 只证明进程可响应，避免数据库或 Redis 抖动触发容器重启。
    return liveness_response()


@router.get("/readyz", response_model=HealthResponse)
async def readyz(
    readiness: ReadinessDep,
    response: Response,
) -> HealthResponse:
    # readiness 失败时返回 503，编排系统据此停止给实例分配流量。
    health = await cached_readiness_response(
        cache=readiness.cache,
        targets=readiness.targets,
    )
    response.status_code = readiness_http_status(health)
    return health
