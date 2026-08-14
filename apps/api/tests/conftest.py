from collections.abc import Generator
from typing import Any

import pytest
from app.main import app
from fast_core.database import create_engine_from_settings
from fast_core.deps import get_db
from fast_core.settings import settings
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session

from tests.utils.user import authentication_token_from_email, ensure_test_superuser
from tests.utils.utils import get_superuser_token_headers


class FakeRedis:
    """API 测试使用的 Redis 替身，覆盖限流、refresh token 和缓存依赖。"""

    def __init__(self) -> None:
        self.values: dict[str, Any] = {}
        self.expires: dict[str, int] = {}
        self.deleted: list[str] = []

    async def get(self, key: str) -> Any | None:
        return self.values.get(key)

    async def set(self, key: str, value: Any, *, ex: int | None = None) -> None:
        self.values[key] = value
        if ex is not None:
            self.expires[key] = ex

    async def incrby(self, key: str, amount: int) -> int:
        current = int(self.values.get(key, 0)) + amount
        self.values[key] = str(current)
        return current

    async def ttl(self, key: str) -> int:
        return self.expires.get(key, -1)

    async def expire(self, key: str, ttl_seconds: int) -> bool:
        self.expires[key] = ttl_seconds
        return True

    async def exists(self, key: str) -> int:
        return int(key in self.values)

    async def delete(self, *keys: str) -> int:
        deleted = 0
        for key in keys:
            self.deleted.append(key)
            if key in self.values:
                deleted += 1
                del self.values[key]
        return deleted

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


@pytest.fixture(scope="session")
def engine() -> Generator[Engine]:
    # engine 创建成本较高，测试进程内复用；数据隔离交给每个测试的事务回滚。
    engine = create_engine_from_settings(settings)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Generator[Session]:
    connection = engine.connect()
    transaction = connection.begin()
    # 路由和测试代码共享同一连接事务，测试结束后整体回滚数据库状态。
    with Session(bind=connection) as session:
        yield session
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient]:
    def override_get_db() -> Generator[Session]:
        yield db

    # 每个测试都准备基线超级用户，事务回滚后不会污染其他测试。
    ensure_test_superuser(db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        # TestClient 进入上下文后 lifespan 已完成，此时覆盖 app.state 资源最稳定。
        app.state.redis = FakeRedis()
        yield c
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def superuser_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    ensure_test_superuser(db)
    return get_superuser_token_headers(client)


@pytest.fixture
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )
