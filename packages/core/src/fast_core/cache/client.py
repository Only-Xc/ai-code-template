from typing import Annotated, Any, TypeAlias

from fastapi import Depends
from redis.asyncio import Redis

from fast_core.cache.redis import RedisDep
from fast_core.cache.serializers import decode_json, decode_text, encode_json


class CacheClient:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    async def get_bytes(self, key: str) -> bytes | None:
        value = await self.redis.get(key)
        if value is None:
            return None
        if isinstance(value, bytes):
            return value
        return str(value).encode("utf-8")

    async def set_bytes(
        self,
        key: str,
        value: bytes,
        *,
        ttl_seconds: int | None = None,
    ) -> None:
        await self.redis.set(key, value, ex=ttl_seconds)

    async def get_text(self, key: str) -> str | None:
        return decode_text(await self.redis.get(key))

    async def set_text(
        self,
        key: str,
        value: str,
        *,
        ttl_seconds: int | None = None,
    ) -> None:
        await self.redis.set(key, value, ex=ttl_seconds)

    async def get_json(self, key: str) -> Any | None:
        return decode_json(await self.redis.get(key))

    async def set_json(
        self,
        key: str,
        value: Any,
        *,
        ttl_seconds: int | None = None,
    ) -> None:
        await self.redis.set(key, encode_json(value), ex=ttl_seconds)

    async def get_int(self, key: str) -> int | None:
        value = await self.get_text(key)
        if value is None:
            return None
        return int(value)

    async def set_int(
        self,
        key: str,
        value: int,
        *,
        ttl_seconds: int | None = None,
    ) -> None:
        await self.redis.set(key, value, ex=ttl_seconds)

    async def incr(
        self,
        key: str,
        *,
        amount: int = 1,
        ttl_seconds: int | None = None,
    ) -> int:
        if ttl_seconds is not None:
            return await self._incr_with_ttl(
                key, amount=amount, ttl_seconds=ttl_seconds
            )

        value = await self.redis.incrby(key, amount)
        return int(value)

    async def _incr_with_ttl(
        self,
        key: str,
        *,
        amount: int,
        ttl_seconds: int,
    ) -> int:
        async with self.redis.pipeline(transaction=True) as pipe:
            pipe.incrby(key, amount)
            pipe.ttl(key)
            result = await pipe.execute()
        value = int(result[0])
        ttl = int(result[1])
        if ttl < 0:
            await self.redis.expire(key, ttl_seconds)
        return value

    async def exists(self, key: str) -> bool:
        return bool(await self.redis.exists(key))

    async def delete(self, *keys: str) -> int:
        if not keys:
            return 0
        return int(await self.redis.delete(*keys))

    async def ttl(self, key: str) -> int:
        return int(await self.redis.ttl(key))

    async def expire(self, key: str, ttl_seconds: int) -> bool:
        return bool(await self.redis.expire(key, ttl_seconds))


def get_cache_client(redis: RedisDep) -> CacheClient:
    return CacheClient(redis=redis)


CacheClientDep: TypeAlias = Annotated[CacheClient, Depends(get_cache_client)]
