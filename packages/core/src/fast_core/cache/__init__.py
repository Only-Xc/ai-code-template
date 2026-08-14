"""Shared cache infrastructure."""

from fast_core.cache.client import CacheClient, CacheClientDep, get_cache_client
from fast_core.cache.redis import RedisDep, close_redis, create_redis, get_redis
from fast_core.cache.service import CacheService, CacheServiceDep, get_cache_service

__all__ = [
    "CacheClient",
    "CacheClientDep",
    "CacheService",
    "CacheServiceDep",
    "RedisDep",
    "close_redis",
    "create_redis",
    "get_cache_client",
    "get_cache_service",
    "get_redis",
]
