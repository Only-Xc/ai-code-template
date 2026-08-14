from unittest.mock import MagicMock

import anyio
from app.platform.health import (
    HealthCheck,
    HealthResponse,
    ReadinessCache,
    ReadinessTargets,
    cached_readiness_response,
    readiness_checks,
    readiness_http_status,
    readiness_response_for_dependencies,
)


class FakeRedis:
    async def ping(self) -> bool:
        return True


class FakeObjectStorage:
    def __init__(self, exists: bool | Exception = True) -> None:
        self.exists = exists

    def bucket_exists(self, *, bucket: str) -> bool:
        if isinstance(self.exists, Exception):
            raise self.exists
        return self.exists


def make_healthy_engine() -> MagicMock:
    connection = MagicMock()
    connection.execute.return_value.scalar_one_or_none.return_value = "head"
    connection_context = MagicMock()
    connection_context.__enter__.return_value = connection
    engine = MagicMock()
    engine.connect.return_value = connection_context
    return engine


def test_readiness_checks_uses_single_connection() -> None:
    connection = MagicMock()
    connection.execute.return_value.scalar_one_or_none.return_value = "head"
    connection_context = MagicMock()
    connection_context.__enter__.return_value = connection
    engine = MagicMock()
    engine.connect.return_value = connection_context

    checks = readiness_checks(engine)

    assert [check.name for check in checks] == ["database", "migration"]
    assert [check.status for check in checks] == ["ok", "ok"]
    assert checks[1].detail == "head"
    engine.connect.assert_called_once()
    assert connection.execute.call_count == 2


def test_readiness_checks_reports_missing_migration() -> None:
    connection = MagicMock()
    connection.execute.return_value.scalar_one_or_none.return_value = None
    connection_context = MagicMock()
    connection_context.__enter__.return_value = connection
    engine = MagicMock()
    engine.connect.return_value = connection_context

    checks = readiness_checks(engine)

    assert checks[0].status == "ok"
    assert checks[1].name == "migration"
    assert checks[1].status == "error"
    assert checks[1].detail == "No migration version found"


def test_readiness_checks_reports_database_error() -> None:
    engine = MagicMock()
    engine.connect.side_effect = RuntimeError(
        "postgresql://user:secret@db:5432/app unavailable"
    )

    checks = readiness_checks(engine)

    assert checks[0].name == "database"
    assert checks[0].status == "error"
    assert checks[0].detail == "Database unavailable"
    assert checks[1].name == "migration"
    assert checks[1].status == "error"
    assert checks[1].detail == "Skipped"


def test_readiness_cache_returns_cached_health_before_expiry() -> None:
    cache = ReadinessCache()
    health = HealthResponse(status="ok", checks=[HealthCheck(name="app", status="ok")])

    cache.set(health, now=10.0)

    assert cache.get(now=10.5) is health


def test_readiness_cache_expires_success_after_short_ttl() -> None:
    cache = ReadinessCache()
    health = HealthResponse(status="ok", checks=[HealthCheck(name="app", status="ok")])

    cache.set(health, now=10.0)

    assert cache.get(now=11.1) is None


def test_readiness_cache_expires_failure_faster() -> None:
    cache = ReadinessCache()
    health = HealthResponse(
        status="error",
        checks=[HealthCheck(name="database", status="error", detail="db down")],
    )

    cache.set(health, now=10.0)

    assert cache.get(now=10.4) is health
    assert cache.get(now=10.6) is None


def test_readiness_http_status_maps_health_status() -> None:
    assert (
        readiness_http_status(
            HealthResponse(status="ok", checks=[HealthCheck(name="app", status="ok")])
        )
        == 200
    )
    assert (
        readiness_http_status(
            HealthResponse(
                status="error",
                checks=[HealthCheck(name="app", status="error", detail="down")],
            )
        )
        == 503
    )


def test_cached_readiness_response_returns_cached_health() -> None:
    async def run() -> None:
        cache = ReadinessCache()
        health = HealthResponse(
            status="ok",
            checks=[HealthCheck(name="cached", status="ok")],
        )
        cache.set(health)
        targets = ReadinessTargets(engine=MagicMock(), redis=object())

        result = await cached_readiness_response(cache=cache, targets=targets)

        assert result is health

    anyio.run(run)


def test_readiness_response_omits_object_storage_by_default() -> None:
    async def run() -> None:
        targets = ReadinessTargets(engine=make_healthy_engine(), redis=FakeRedis())

        result = await readiness_response_for_dependencies(targets=targets)

        assert result.status == "ok"
        assert [check.name for check in result.checks] == [
            "database",
            "migration",
            "redis",
        ]

    anyio.run(run)


def test_readiness_response_includes_object_storage_when_enabled() -> None:
    async def run() -> None:
        targets = ReadinessTargets(
            engine=make_healthy_engine(),
            redis=FakeRedis(),
            object_storage=FakeObjectStorage(True),
            object_storage_bucket="fast-platform",
            object_storage_enabled=True,
        )

        result = await readiness_response_for_dependencies(targets=targets)

        assert result.status == "ok"
        assert [check.name for check in result.checks] == [
            "database",
            "migration",
            "redis",
            "object_storage",
        ]

    anyio.run(run)


def test_readiness_response_reports_object_storage_failure() -> None:
    async def run() -> None:
        targets = ReadinessTargets(
            engine=make_healthy_engine(),
            redis=FakeRedis(),
            object_storage=FakeObjectStorage(False),
            object_storage_bucket="fast-platform",
            object_storage_enabled=True,
        )

        result = await readiness_response_for_dependencies(targets=targets)

        assert result.status == "error"
        assert result.checks[-1] == HealthCheck(
            name="object_storage",
            status="error",
            detail="Bucket not found",
        )

    anyio.run(run)


def test_readiness_response_sanitizes_object_storage_exceptions() -> None:
    async def run() -> None:
        targets = ReadinessTargets(
            engine=make_healthy_engine(),
            redis=FakeRedis(),
            object_storage=FakeObjectStorage(
                RuntimeError("http://minio:9000 access key failed")
            ),
            object_storage_bucket="fast-platform",
            object_storage_enabled=True,
        )

        result = await readiness_response_for_dependencies(targets=targets)

        assert result.status == "error"
        assert result.checks[-1] == HealthCheck(
            name="object_storage",
            status="error",
            detail="Object storage unavailable",
        )

    anyio.run(run)
