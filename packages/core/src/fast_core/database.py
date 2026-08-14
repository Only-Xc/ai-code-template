from collections.abc import Generator
from contextlib import contextmanager

from sqlmodel import Session, create_engine

from fast_core.settings import Settings


def create_engine_from_settings(settings: Settings):
    # 连接池参数集中来自 Settings，部署环境可以独立调整容量和等待时间。
    return create_engine(
        str(settings.SQLALCHEMY_DATABASE_URI),
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
    )


def get_session(engine) -> Generator[Session]:
    # 作为 request dependency 使用时，FastAPI 会在响应完成后关闭 Session。
    with Session(engine) as session:
        yield session


@contextmanager
def make_test_session(test_engine) -> Generator[Session]:
    with Session(test_engine) as session:
        yield session
