import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Annotated, Any, TypeAlias

from fastapi import Depends

from fast_core.cache.client import CacheClient
from fast_core.cache.keys import CacheKeyBuilder
from fast_core.cache.redis import RedisDep
from fast_core.settings import Settings, get_settings

logger = logging.getLogger(__name__)


class CacheService:
    """Best-effort JSON cache service shared by modules and application code."""

    def __init__(self, *, client: CacheClient, keys: CacheKeyBuilder) -> None:
        self.client = client
        self.keys = keys
        self._locks: dict[str, asyncio.Lock] = {}

    def build_key(self, namespace: str, *parts: object) -> str:
        return self.keys.build(namespace, *parts)

    async def get(self, namespace: str, *parts: object) -> Any | None:
        key = self.build_key(namespace, *parts)
        try:
            return await self.client.get_json(key)
        except Exception as exc:
            self._log_cache_warning("get", namespace, exc)
            return None

    async def set(
        self,
        namespace: str,
        *parts: object,
        value: Any,
        ttl_seconds: int,
    ) -> None:
        key = self.build_key(namespace, *parts)
        try:
            await self.client.set_json(key, value, ttl_seconds=ttl_seconds)
        except Exception as exc:
            self._log_cache_warning("set", namespace, exc)

    async def get_or_set(
        self,
        namespace: str,
        *parts: object,
        loader: Callable[[], Awaitable[Any]],
        ttl_seconds: int,
    ) -> Any:
        key = self.build_key(namespace, *parts)
        try:
            cached = await self.client.get_json(key)
        except Exception as exc:
            # 缓存故障不应阻断主业务读取，退回 loader 保持功能可用。
            self._log_cache_warning("get", namespace, exc)
            return await loader()
        if cached is not None:
            return cached

        async with self._get_lock(key):
            # 锁内二次读取，避免并发请求在第一个 loader 写入后重复加载。
            try:
                cached = await self.client.get_json(key)
            except Exception as exc:
                self._log_cache_warning("get", namespace, exc)
                return await loader()
            if cached is not None:
                return cached
            value = await loader()
            try:
                await self.client.set_json(key, value, ttl_seconds=ttl_seconds)
            except Exception as exc:
                self._log_cache_warning("set", namespace, exc)
            return value

    async def delete(self, namespace: str, *parts: object) -> int:
        key = self.build_key(namespace, *parts)
        try:
            return await self.client.delete(key)
        except Exception as exc:
            self._log_cache_warning("delete", namespace, exc)
            return 0

    async def exists(self, namespace: str, *parts: object) -> bool:
        key = self.build_key(namespace, *parts)
        try:
            return await self.client.exists(key)
        except Exception as exc:
            self._log_cache_warning("exists", namespace, exc)
            return False

    async def incr(
        self,
        namespace: str,
        *parts: object,
        amount: int = 1,
        ttl_seconds: int | None = None,
    ) -> int:
        key = self.build_key(namespace, *parts)
        return await self.client.incr(
            key,
            amount=amount,
            ttl_seconds=ttl_seconds,
        )

    def _log_cache_warning(
        self,
        operation: str,
        namespace: str,
        exc: Exception,
    ) -> None:
        logger.warning(
            "Cache operation failed",
            extra={
                "operation": operation,
                "namespace": namespace,
                "exception_type": type(exc).__name__,
            },
        )

    def _get_lock(self, key: str) -> asyncio.Lock:
        # 本地锁只解决单进程雪崩；跨进程场景应升级为 Redis 分布式锁。
        lock = self._locks.get(key)
        if lock is None:
            lock = asyncio.Lock()
            self._locks[key] = lock
        return lock


SettingsDep: TypeAlias = Annotated[Settings, Depends(get_settings)]


def get_cache_service(redis: RedisDep, settings: SettingsDep) -> CacheService:
    return CacheService(
        client=CacheClient(redis=redis),
        keys=CacheKeyBuilder.from_settings(settings),
    )


CacheServiceDep: TypeAlias = Annotated[CacheService, Depends(get_cache_service)]
