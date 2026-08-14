from collections.abc import Iterable

from fast_core.settings import Settings


def normalize_key_part(value: object) -> str:
    # key 只做轻量规范化；敏感值应由调用方先转换为不可逆摘要或非敏感标识。
    return str(value).strip().replace(" ", "-")


class CacheKeyBuilder:
    def __init__(self, *, environment: str, prefix: str = "fast") -> None:
        self.environment = environment
        self.prefix = prefix

    @classmethod
    def from_settings(cls, settings: Settings) -> "CacheKeyBuilder":
        return cls(environment=settings.ENVIRONMENT)

    def build(self, namespace: str, *parts: object) -> str:
        # 前缀 + 环境隔离 Redis key，避免开发、测试、生产互相污染。
        key_parts: Iterable[object] = (self.prefix, self.environment, namespace, *parts)
        return ":".join(normalize_key_part(part) for part in key_parts)
