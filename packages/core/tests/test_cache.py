from typing import Any

import anyio
from fast_core.cache.client import CacheClient
from fast_core.cache.health import REDIS_UNAVAILABLE_DETAIL, check_redis
from fast_core.cache.keys import CacheKeyBuilder
from fast_core.cache.redis import (
    REDIS_HEALTH_CHECK_INTERVAL_SECONDS,
    REDIS_MAX_CONNECTIONS,
    REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS,
    REDIS_SOCKET_TIMEOUT_SECONDS,
    get_redis,
)
from fast_core.cache.serializers import decode_json, decode_text, encode_json
from fast_core.cache.service import CacheService
from fast_core.settings import Settings
from pydantic import SecretStr


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, Any] = {}
        self.expires: dict[str, int] = {}
        self.deleted: list[str] = []
        self.ping_result: bool | Exception = True
        self.fail_operations: set[str] = set()

    async def get(self, key: str) -> Any | None:
        if "get" in self.fail_operations:
            raise RuntimeError("redis get failed")
        return self.values.get(key)

    async def set(self, key: str, value: Any, *, ex: int | None = None) -> None:
        if "set" in self.fail_operations:
            raise RuntimeError("redis set failed")
        self.values[key] = value
        if ex is not None:
            self.expires[key] = ex

    async def incrby(self, key: str, amount: int) -> int:
        if "incrby" in self.fail_operations:
            raise RuntimeError("redis incr failed")
        current = int(self.values.get(key, 0))
        current += amount
        self.values[key] = str(current)
        return current

    async def exists(self, key: str) -> int:
        if "exists" in self.fail_operations:
            raise RuntimeError("redis exists failed")
        return int(key in self.values)

    async def delete(self, *keys: str) -> int:
        if "delete" in self.fail_operations:
            raise RuntimeError("redis delete failed")
        deleted = 0
        for key in keys:
            self.deleted.append(key)
            if key in self.values:
                deleted += 1
                del self.values[key]
        return deleted

    async def ttl(self, key: str) -> int:
        return self.expires.get(key, -1)

    async def expire(self, key: str, ttl: int) -> bool:
        if key not in self.values:
            return False
        self.expires[key] = ttl
        return True

    async def ping(self) -> bool:
        if isinstance(self.ping_result, Exception):
            raise self.ping_result
        return self.ping_result

    def pipeline(self, *, transaction: bool) -> "FakeRedisPipeline":
        return FakeRedisPipeline(self, transaction=transaction)


class FakeRedisPipeline:
    def __init__(self, redis: FakeRedis, *, transaction: bool) -> None:
        self.redis = redis
        self.is_transaction = transaction
        self.commands: list[tuple[str, tuple[Any, ...]]] = []

    async def __aenter__(self) -> "FakeRedisPipeline":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    def incrby(self, key: str, amount: int) -> None:
        self.commands.append(("incrby", (key, amount)))

    def ttl(self, key: str) -> None:
        self.commands.append(("ttl", (key,)))

    async def execute(self) -> list[Any]:
        results: list[Any] = []
        for command, args in self.commands:
            method = getattr(self.redis, command)
            results.append(await method(*args))
        return results


def make_settings() -> Settings:
    unsafe_default = "change" + "this"
    return Settings(
        PROJECT_NAME="Test",
        POSTGRES_SERVER="localhost",
        POSTGRES_USER="postgres",
        POSTGRES_PASSWORD=SecretStr(unsafe_default),
        POSTGRES_DB="app",
        FIRST_SUPERUSER="admin@example.com",
        FIRST_SUPERUSER_PASSWORD=SecretStr(unsafe_default),
        SECRET_KEY=SecretStr(unsafe_default),
        OBJECT_STORAGE_ACCESS_KEY="minio-access-key",
        OBJECT_STORAGE_SECRET_KEY=SecretStr("minio-secret-key"),
    )


def test_redis_settings_defaults() -> None:
    settings = make_settings()

    assert settings.REDIS_URL.host == "localhost"
    assert settings.REDIS_URL.port == 6379


def test_redis_client_defaults_are_code_constants() -> None:
    assert REDIS_MAX_CONNECTIONS == 10
    assert REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS == 2.0
    assert REDIS_SOCKET_TIMEOUT_SECONDS == 2.0
    assert REDIS_HEALTH_CHECK_INTERVAL_SECONDS == 30


def test_serializers_preserve_text_and_json_shapes() -> None:
    payload = {"message": "你好", "count": 1}

    encoded = encode_json(payload)

    assert encoded == '{"message":"你好","count":1}'
    assert decode_json(encoded.encode("utf-8")) == payload
    assert decode_text(b"hello") == "hello"
    assert decode_json(None) is None
    assert decode_text(None) is None


def test_cache_key_builder_uses_environment_and_namespace() -> None:
    builder = CacheKeyBuilder(environment="test")

    key = builder.build("auth", "session", "abc 123")

    assert key == "fast:test:auth:session:abc-123"


def test_cache_service_get_or_set_deduplicates_concurrent_loads() -> None:
    async def run() -> None:
        redis = FakeRedis()
        service = CacheService(
            client=CacheClient(redis=redis),  # type: ignore[arg-type]
            keys=CacheKeyBuilder(environment="test"),
        )
        loader_calls = 0
        gate = anyio.Event()

        async def loader() -> dict[str, bool]:
            nonlocal loader_calls
            loader_calls += 1
            await gate.wait()
            return {"loaded": True}

        async def first() -> None:
            assert await service.get_or_set(
                "items:list",
                "active",
                loader=loader,
                ttl_seconds=30,
            ) == {"loaded": True}

        async def second() -> None:
            assert await service.get_or_set(
                "items:list",
                "active",
                loader=loader,
                ttl_seconds=30,
            ) == {"loaded": True}

        async with anyio.create_task_group() as task_group:
            task_group.start_soon(first)
            task_group.start_soon(second)
            await anyio.sleep(0)
            gate.set()

        assert loader_calls == 1

    anyio.run(run)


def test_cache_client_supports_common_value_shapes() -> None:
    async def run() -> None:
        redis = FakeRedis()
        cache = CacheClient(redis=redis)  # type: ignore[arg-type]

        await cache.set_text("text", "hello", ttl_seconds=10)
        await cache.set_json("json", {"ok": True}, ttl_seconds=20)
        await cache.set_bytes("bytes", b"raw")
        await cache.set_int("int", 3)

        assert await cache.get_text("text") == "hello"
        assert await cache.get_json("json") == {"ok": True}
        assert await cache.get_bytes("bytes") == b"raw"
        assert await cache.get_int("int") == 3
        assert redis.expires["text"] == 10
        assert redis.expires["json"] == 20

    anyio.run(run)


def test_cache_client_supports_counters_and_key_operations() -> None:
    async def run() -> None:
        redis = FakeRedis()
        cache = CacheClient(redis=redis)  # type: ignore[arg-type]

        assert await cache.incr("counter", ttl_seconds=30) == 1
        assert await cache.ttl("counter") == 30
        assert await cache.incr("counter", amount=2) == 3
        assert await cache.incr("offset-counter", amount=3, ttl_seconds=30) == 3
        assert await cache.ttl("offset-counter") == 30
        assert await cache.exists("counter")
        redis.expires["counter"] = 25
        assert await cache.incr("counter", ttl_seconds=30) == 4
        assert await cache.ttl("counter") == 25
        assert await cache.expire("counter", 60)
        assert await cache.ttl("counter") == 60
        assert await cache.delete("counter", "missing") == 1
        assert not await cache.exists("counter")

    anyio.run(run)


def test_cache_service_uses_built_keys_json_and_ttl() -> None:
    async def run() -> None:
        redis = FakeRedis()
        service = CacheService(
            client=CacheClient(redis=redis),  # type: ignore[arg-type]
            keys=CacheKeyBuilder(environment="test"),
        )

        await service.set("items:detail", 123, value={"id": 123}, ttl_seconds=60)

        assert redis.values["fast:test:items:detail:123"] == '{"id":123}'
        assert redis.expires["fast:test:items:detail:123"] == 60
        assert await service.get("items:detail", 123) == {"id": 123}

    anyio.run(run)


def test_cache_service_get_or_set_uses_cache_before_loader() -> None:
    async def run() -> None:
        redis = FakeRedis()
        service = CacheService(
            client=CacheClient(redis=redis),  # type: ignore[arg-type]
            keys=CacheKeyBuilder(environment="test"),
        )
        loader_calls = 0

        async def loader() -> dict[str, bool]:
            nonlocal loader_calls
            loader_calls += 1
            return {"loaded": True}

        assert await service.get_or_set(
            "items:list",
            "active",
            loader=loader,
            ttl_seconds=30,
        ) == {"loaded": True}
        assert loader_calls == 1
        assert redis.expires["fast:test:items:list:active"] == 30

        assert await service.get_or_set(
            "items:list",
            "active",
            loader=loader,
            ttl_seconds=30,
        ) == {"loaded": True}
        assert loader_calls == 1

    anyio.run(run)


def test_cache_service_preserves_flow_for_best_effort_operations() -> None:
    async def run() -> None:
        redis = FakeRedis()
        service = CacheService(
            client=CacheClient(redis=redis),  # type: ignore[arg-type]
            keys=CacheKeyBuilder(environment="test"),
        )

        redis.fail_operations = {"get", "set", "delete", "exists"}

        assert await service.get("items:detail", 123) is None
        assert not await service.exists("items:detail", 123)
        assert await service.delete("items:detail", 123) == 0
        await service.set("items:detail", 123, value={"id": 123}, ttl_seconds=60)

    anyio.run(run)


def test_cache_service_get_or_set_loads_when_get_fails() -> None:
    async def run() -> None:
        redis = FakeRedis()
        service = CacheService(
            client=CacheClient(redis=redis),  # type: ignore[arg-type]
            keys=CacheKeyBuilder(environment="test"),
        )
        redis.fail_operations = {"get"}

        async def loader() -> dict[str, bool]:
            return {"loaded": True}

        assert await service.get_or_set(
            "items:detail",
            123,
            loader=loader,
            ttl_seconds=30,
        ) == {"loaded": True}

    anyio.run(run)


def test_cache_service_incr_propagates_redis_errors() -> None:
    async def run() -> None:
        redis = FakeRedis()
        service = CacheService(
            client=CacheClient(redis=redis),  # type: ignore[arg-type]
            keys=CacheKeyBuilder(environment="test"),
        )
        redis.fail_operations = {"incrby"}

        try:
            await service.incr("auth:login-attempts", "user", ttl_seconds=60)
        except RuntimeError as exc:
            assert str(exc) == "redis incr failed"
        else:
            raise AssertionError("Expected Redis error")

    anyio.run(run)


def test_get_redis_reports_missing_app_state_client() -> None:
    class AppState:
        pass

    class App:
        state = AppState()

    class Request:
        app = App()

    try:
        get_redis(Request())  # type: ignore[arg-type]
    except RuntimeError as exc:
        assert str(exc) == "Redis client is not initialized on app.state.redis"
    else:
        raise AssertionError("Expected Redis initialization error")


def test_redis_health_check_reports_success_and_failure() -> None:
    async def run() -> None:
        redis = FakeRedis()

        assert await check_redis(redis) == (True, None)  # type: ignore[arg-type]

        redis.ping_result = RuntimeError("redis down")

        ok, detail = await check_redis(redis)  # type: ignore[arg-type]
        assert not ok
        assert detail == REDIS_UNAVAILABLE_DETAIL

    anyio.run(run)
