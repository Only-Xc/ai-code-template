from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.engine import Engine
from sqlmodel import Session

from fast_core.cache import CacheClientDep as CacheClientDep
from fast_core.cache import CacheServiceDep as CacheServiceDep
from fast_core.cache import RedisDep as RedisDep
from fast_core.database import get_session
from fast_core.settings import Settings, get_settings
from fast_core.storage import ObjectStorage


def get_engine(request: Request) -> Engine:
    # engine 由应用 lifespan 创建，dependency 只负责从 app.state 读取。
    return request.app.state.engine


def get_object_storage(request: Request) -> ObjectStorage:
    object_storage = getattr(request.app.state, "object_storage", None)
    if object_storage is None:
        # 启动装配错误要尽早暴露，避免业务代码拿到 None 后产生隐蔽失败。
        raise RuntimeError(
            "Object storage client is not initialized on app.state.object_storage"
        )
    return object_storage


def get_db(engine: Annotated[Engine, Depends(get_engine)]) -> Generator[Session]:
    # 每个请求独立 Session，事务提交由 Service / Application Service 显式控制。
    yield from get_session(engine)


SettingsDep = Annotated[Settings, Depends(get_settings)]
EngineDep = Annotated[Engine, Depends(get_engine)]
ObjectStorageDep = Annotated[ObjectStorage, Depends(get_object_storage)]
SessionDep = Annotated[Session, Depends(get_db)]
