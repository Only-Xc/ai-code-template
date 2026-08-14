import asyncio
from dataclasses import dataclass
from time import monotonic
from typing import Any, Literal

from fast_core.cache.health import check_redis
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Engine
from starlette.concurrency import run_in_threadpool

HealthStatus = Literal["ok", "error"]
READINESS_SUCCESS_TTL_SECONDS = 1.0
READINESS_FAILURE_TTL_SECONDS = 0.5


class HealthCheck(BaseModel):
    name: str
    status: HealthStatus
    detail: str | None = None


class HealthResponse(BaseModel):
    status: HealthStatus
    checks: list[HealthCheck]


@dataclass(frozen=True)
class ReadinessTargets:
    engine: Engine
    redis: Any
    object_storage: Any | None = None
    object_storage_bucket: str | None = None
    object_storage_enabled: bool = False


class ReadinessCache:
    def __init__(self) -> None:
        self.expires_at = 0.0
        self.health: HealthResponse | None = None

    def get(self, *, now: float | None = None) -> HealthResponse | None:
        current_time = monotonic() if now is None else now
        if self.health is None or self.expires_at <= current_time:
            return None
        return self.health

    def set(self, health: HealthResponse, *, now: float | None = None) -> None:
        current_time = monotonic() if now is None else now
        # readiness 会被编排系统高频调用，短 TTL 缓存可以削峰且保留故障恢复速度。
        ttl_seconds = (
            READINESS_SUCCESS_TTL_SECONDS
            if health.status == "ok"
            else READINESS_FAILURE_TTL_SECONDS
        )
        self.health = health
        self.expires_at = current_time + ttl_seconds


def liveness_response() -> HealthResponse:
    return HealthResponse(status="ok", checks=[HealthCheck(name="app", status="ok")])


def readiness_checks(engine: Engine) -> list[HealthCheck]:
    try:
        # migration 版本和数据库连通性一起检查，避免未迁移实例接入流量。
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            version = connection.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            ).scalar_one_or_none()
    except Exception:
        return [
            HealthCheck(
                name="database",
                status="error",
                detail="Database unavailable",
            ),
            HealthCheck(name="migration", status="error", detail="Skipped"),
        ]

    checks = [HealthCheck(name="database", status="ok")]
    if not version:
        checks.append(
            HealthCheck(
                name="migration",
                status="error",
                detail="No migration version found",
            )
        )
    else:
        checks.append(HealthCheck(name="migration", status="ok", detail=str(version)))
    return checks


async def redis_readiness_check(redis: Any) -> HealthCheck:
    ok, detail = await check_redis(redis)
    if ok:
        return HealthCheck(name="redis", status="ok")
    return HealthCheck(name="redis", status="error", detail=detail)


def object_storage_readiness_check(
    object_storage: Any,
    *,
    bucket: str,
) -> HealthCheck:
    try:
        if object_storage.bucket_exists(bucket=bucket):
            return HealthCheck(name="object_storage", status="ok")
        return HealthCheck(
            name="object_storage",
            status="error",
            detail="Bucket not found",
        )
    except Exception:
        return HealthCheck(
            name="object_storage",
            status="error",
            detail="Object storage unavailable",
        )


async def readiness_response_for_dependencies(
    *,
    targets: ReadinessTargets,
) -> HealthResponse:
    # DB 检查是同步阻塞调用，放入线程池后和 Redis / 对象存储检查并发执行。
    checks = [
        run_in_threadpool(readiness_checks, targets.engine),
        redis_readiness_check(targets.redis),
    ]
    if targets.object_storage_enabled:
        checks.append(
            run_in_threadpool(
                object_storage_readiness_check,
                targets.object_storage,
                bucket=targets.object_storage_bucket or "",
            )
        )

    results = await asyncio.gather(*checks)
    database_checks = results[0]
    dependency_checks = results[1:]
    return readiness_response(checks=[*database_checks, *dependency_checks])


async def cached_readiness_response(
    *,
    cache: ReadinessCache,
    targets: ReadinessTargets,
) -> HealthResponse:
    cached = cache.get()
    if cached is not None:
        return cached

    # cache miss 时才触发真实依赖检查，响应结果按成功/失败使用不同 TTL。
    health = await readiness_response_for_dependencies(targets=targets)
    cache.set(health)
    return health


def readiness_response(*, checks: list[HealthCheck]) -> HealthResponse:
    status: HealthStatus = (
        "ok" if all(check.status == "ok" for check in checks) else "error"
    )
    return HealthResponse(status=status, checks=checks)


def readiness_http_status(health: HealthResponse) -> int:
    if health.status == "ok":
        return 200
    return 503
