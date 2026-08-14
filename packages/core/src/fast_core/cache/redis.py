from typing import Annotated, TypeAlias, cast

from fastapi import Depends, Request
from redis.asyncio import Redis

from fast_core.settings import Settings

REDIS_MAX_CONNECTIONS = 10
REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS = 2.0
REDIS_SOCKET_TIMEOUT_SECONDS = 2.0
REDIS_HEALTH_CHECK_INTERVAL_SECONDS = 30


def create_redis(settings: Settings) -> Redis:
    # decode_responses=False 统一按 bytes 读取，由 serializer 层决定文本或 JSON 解码。
    return Redis.from_url(
        str(settings.REDIS_URL),
        decode_responses=False,
        max_connections=REDIS_MAX_CONNECTIONS,
        socket_connect_timeout=REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS,
        socket_timeout=REDIS_SOCKET_TIMEOUT_SECONDS,
        health_check_interval=REDIS_HEALTH_CHECK_INTERVAL_SECONDS,
    )


async def close_redis(redis: Redis) -> None:
    await redis.aclose()


def get_redis(request: Request) -> Redis:
    redis = getattr(request.app.state, "redis", None)
    if redis is None:
        # Redis 是 app scope 资源，缺失说明应用 lifespan 或测试装配不完整。
        raise RuntimeError("Redis client is not initialized on app.state.redis")
    return cast(Redis, redis)


RedisDep: TypeAlias = Annotated[Redis, Depends(get_redis)]
