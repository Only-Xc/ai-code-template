import anyio
from app.platform.rate_limit import RedisRateLimiter, match_rate_limited_path


class FakeCache:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.ttls: dict[str, int] = {}

    async def incr(self, key: str, *, ttl_seconds: int) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        self.ttls[key] = ttl_seconds
        return self.counts[key]


def test_rate_limiter_allows_within_window() -> None:
    async def run() -> None:
        cache = FakeCache()
        limiter = RedisRateLimiter(
            cache=cache,  # type: ignore[arg-type]
            max_requests=2,
            window_seconds=60,
        )

        assert await limiter.check_and_register("client")
        assert await limiter.check_and_register("client")
        assert cache.ttls["ratelimit:client"] == 60

    anyio.run(run)


def test_rate_limiter_rejects_after_limit() -> None:
    async def run() -> None:
        limiter = RedisRateLimiter(
            cache=FakeCache(),  # type: ignore[arg-type]
            max_requests=1,
            window_seconds=60,
        )

        assert await limiter.check_and_register("client")
        assert not await limiter.check_and_register("client")

    anyio.run(run)


def test_rate_limit_path_matching_supports_exact_and_prefix_paths() -> None:
    paths = {"/api/v1/login/access-token", "/api/v1/password-recovery/"}

    assert (
        match_rate_limited_path("/api/v1/login/access-token", paths)
        == "/api/v1/login/access-token"
    )
    assert (
        match_rate_limited_path("/api/v1/password-recovery/user@example.com", paths)
        == "/api/v1/password-recovery/"
    )
    assert match_rate_limited_path("/api/v1/users/me", paths) is None
