from redis.asyncio import Redis

REDIS_UNAVAILABLE_DETAIL = "Redis unavailable"


async def check_redis(redis: Redis) -> tuple[bool, str | None]:
    try:
        pong = await redis.ping()
    except Exception:
        return False, REDIS_UNAVAILABLE_DETAIL
    if pong is True:
        return True, None
    return False, "Unexpected Redis PING response"
