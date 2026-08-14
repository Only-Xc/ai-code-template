from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from fast_core.cache.client import CacheClient
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse


@dataclass
class RedisRateLimiter:
    cache: CacheClient
    max_requests: int
    window_seconds: int

    async def check_and_register(self, key: str) -> bool:
        # Redis 计数器让多个 worker 共享同一个限流窗口。
        count = await self.cache.incr(
            f"ratelimit:{key}",
            ttl_seconds=self.window_seconds,
        )
        return count <= self.max_requests


def client_key(request: Request) -> str:
    # 反向代理部署时优先使用 X-Forwarded-For 中最前面的原始客户端 IP。
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", maxsplit=1)[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def create_rate_limit_middleware(
    *,
    max_requests: int,
    window_seconds: int,
    paths: set[str],
) -> Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]:
    async def rate_limit_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        matched_path = match_rate_limited_path(request.url.path, paths)
        if matched_path is not None:
            # 在 call_next 前拦截，请求超过阈值时不会进入下游业务逻辑。
            limiter = RedisRateLimiter(
                cache=CacheClient(redis=request.app.state.redis),
                max_requests=max_requests,
                window_seconds=window_seconds,
            )
            key = f"{matched_path}:{client_key(request)}"
            if not await limiter.check_and_register(key):
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many requests"},
                )
        return await call_next(request)

    return rate_limit_middleware


def match_rate_limited_path(path: str, paths: set[str]) -> str | None:
    # 密码恢复路径包含邮箱动态段，所以这里支持前缀匹配。
    for limited_path in paths:
        if path == limited_path or path.startswith(limited_path):
            return limited_path
    return None
