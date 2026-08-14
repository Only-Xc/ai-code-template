# Redis / Cache 架构说明

本文档说明本仓库 Redis 与缓存基础能力的架构边界、运行期生命周期、封装层次和业务模块使用方式。它是 `docs/architecture.md` 中“运行期基础能力”和 `packages/core` 公共能力规则在 Redis 场景下的具体化。

## 设计目标

Redis 在本项目中定位为应用级运行期基础设施，不是业务模块的直接实现细节。

目标：

- 应用层负责 Redis client 的创建、生命周期和就绪检查。
- `fast_core.cache` 只提供跨模块复用的薄基础设施封装。
- 业务模块不直接散落 `redis.get`、`redis.set`、key 拼接和序列化逻辑。
- Router 不直接操作 Redis；Router 只注入语义化 Service / Cache / Store 依赖。
- 缓存失败默认不影响核心业务流程，除非该能力本身是强一致业务约束，例如限流、锁、幂等或会话校验。

## 总体架构

```text
┌──────────────────────────────────────────────┐
│ apps/api                                      │
│ - lifespan 创建 Redis client                  │
│ - app.state.redis 持有 APP scope 资源          │
│ - /readyz 检查 Redis PING                     │
└───────────────────────┬──────────────────────┘
                        │ RedisDep
┌───────────────────────▼──────────────────────┐
│ packages/core/src/fast_core/cache               │
│ - redis.py: create / close / get dependency   │
│ - client.py: 按值形态封装 Redis 常用操作       │
│ - service.py: namespace key + best-effort 缓存 │
│ - keys.py: 环境隔离 key builder 与敏感值 hash  │
│ - serializers.py: JSON / text 序列化           │
│ - health.py: Redis readiness helper           │
└───────────────────────┬──────────────────────┘
                        │ CacheClient / CacheService
┌───────────────────────▼──────────────────────┐
│ modules/<feature>                             │
│ - XxxCache / XxxStore 定义业务 key 和 TTL      │
│ - deps.py 统一装配语义化依赖                  │
│ - Service 使用 XxxCache / XxxStore             │
└───────────────────────┬──────────────────────┘
                        │ XxxServiceDep
┌───────────────────────▼──────────────────────┐
│ Router                                        │
│ - 不直接 import Redis 或 CacheClient           │
│ - 只调用业务 Service                           │
└──────────────────────────────────────────────┘
```

## 文件职责

当前 Redis/cache 基础能力位于 `packages/core/src/fast_core/cache/`。

- `redis.py`
  - `create_redis(settings)`：根据 Settings 创建 `redis.asyncio.Redis`。
  - `close_redis(redis)`：应用 shutdown 时关闭 Redis client。
  - `get_redis(request)`：从 `request.app.state.redis` 读取 APP scope Redis client。
  - `RedisDep`：FastAPI dependency alias。

- `client.py`
  - `CacheClient`：面向 Redis 值形态的薄封装。
  - `CacheClientDep`：注入 `CacheClient`。
  - 提供 `get_text/set_text`、`get_json/set_json`、`get_bytes/set_bytes`、`get_int/set_int`、`incr`、`exists`、`delete`、`ttl`、`expire` 等基础操作。

- `service.py`
  - `CacheService`：提供 namespace + key builder + JSON 缓存的通用 best-effort 能力。
  - 适合通用查询缓存场景，不承载业务命名、业务 TTL 或业务一致性规则。

- `keys.py`
  - `CacheKeyBuilder`：统一 key 前缀、环境隔离和 namespace 拼接。

- `serializers.py`
  - JSON 和 text 编解码 helper。
  - 不强制所有缓存值都 JSON 化。

- `health.py`
  - `check_redis(redis)`：就绪检查使用的 Redis PING helper。

## 生命周期管理

Redis client 属于 APP scope 基础设施，由应用层 lifespan 统一管理。

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    redis = create_redis(settings)
    app.state.redis = redis
    try:
        yield
    finally:
        await close_redis(redis)
```

规则：

- `packages/core` 不主动创建全局 Redis 单例。
- Service / Repository 不读取 `app.state`。
- Redis client 不在业务模块内自行创建或关闭。
- `get_redis()` 只作为 FastAPI dependency accessor，从 app state 获取已初始化资源。
- 如果 `app.state.redis` 未初始化，`get_redis()` 应抛出明确运行期错误，便于发现应用装配问题。

## API 封装原则

`CacheClient` 采用按值形态拆分的方法，而不是一个泛型 `get_value/set_value`。

推荐保留：

- `get_bytes/set_bytes`：二进制内容、压缩内容、外部协议 payload。
- `get_text/set_text`：普通字符串、短文本标记。
- `get_json/set_json`：结构化缓存对象。
- `get_int/set_int`：计数器或整数状态读取。
- `incr`：Redis 原子计数语义。

原因：

- Redis 底层虽然主要存储 bytes/string，但业务值形态不同。
- 不同形态的序列化、反序列化、错误边界和测试断言不同。
- 企业级基础设施更强调显式语义，避免“一个方法猜所有类型”。
- 不强制 JSON envelope，避免计数器、锁、rate limit、bytes payload 等场景变得别扭。

不推荐：

- 用一个 `get()` 自动猜测返回类型。
- 所有值统一包装为 `{"value": ...}`。
- 在 `CacheClient` 中加入业务 key、业务 TTL 或业务降级逻辑。
- Router 直接调用 `CacheClient` 操作具体业务 key。

## Key 设计规范

Redis key 使用环境隔离和 namespace 分层。

推荐格式：

```text
fast:{environment}:{namespace}:{resource}:{id}
```

示例：

```text
fast:production:auth:login-attempts:8f14e45fceea...
fast:development:project:detail:123
fast:test:agent:snapshot:abc
```

规则：

- `fast` 是项目级前缀。
- `{environment}` 来自 Settings，避免 development/test/production 互相污染。
- `{namespace}` 表达能力或模块边界，例如 `auth`、`project`、`agent`。
- 业务模块自己的 `XxxCache` / `XxxStore` 负责定义后续 key 结构。
- 不能把 token、email、手机号、外部凭证等敏感值明文放入 key；调用方应先生成不可逆摘要或稳定非敏感标识。
- key 不能包含临时调试信息、用户可控长文本或高敏原文。

## 模块使用方式

业务模块应封装自己的缓存类，而不是在 Service 中散落 key 拼接。

推荐结构：

```text
modules/<feature>/src/fast_<feature>/
├── cache.py      # XxxCache / XxxStore
├── deps.py       # XxxCacheDep / XxxServiceDep
├── service.py    # 使用 XxxCache
└── routers/      # 只注入 XxxServiceDep
```

示例：

```python
class ProjectCache:
    def __init__(self, cache: CacheClient, keys: CacheKeyBuilder) -> None:
        self.cache = cache
        self.keys = keys

    def detail_key(self, project_id: str) -> str:
        return self.keys.build("project", "detail", project_id)

    async def get_detail(self, project_id: str) -> dict[str, object] | None:
        return await self.cache.get_json(self.detail_key(project_id))

    async def set_detail(self, project_id: str, value: dict[str, object]) -> None:
        await self.cache.set_json(self.detail_key(project_id), value, ttl_seconds=300)
```

模块 `deps.py` 负责装配：

```python
def get_project_cache(cache: CacheClientDep, settings: SettingsDep) -> ProjectCache:
    return ProjectCache(
        cache=cache,
        keys=CacheKeyBuilder.from_settings(settings),
    )

ProjectCacheDep = Annotated[ProjectCache, Depends(get_project_cache)]
```

Router 不应写成：

```python
async def endpoint(redis: RedisDep) -> dict[str, object]:
    value = await redis.get("fast:production:project:detail:123")
    ...
```

Router 应通过 Service 间接使用缓存：

```python
async def get_project(
    project_id: UUID,
    project_service: ProjectServiceDep,
) -> ProjectPublic:
    return await project_service.get_project(project_id)
```

## 错误处理与降级策略

缓存类能力分为两类：best-effort 缓存和强约束 Redis 能力。

### Best-effort 缓存

适用场景：

- 查询结果缓存。
- 非关键页面聚合结果缓存。
- 可通过数据库或源服务重新加载的数据。

策略：

- `get` 失败时返回 miss，由 loader 或源数据路径继续执行。
- `set/delete/exists` 失败时记录 warning，不中断主流程。
- 日志只记录 operation、namespace、exception type，不记录敏感 key 原文。

`CacheService` 当前采用这一类策略。

### 强约束能力

适用场景：

- 登录限流。
- 分布式锁。
- 幂等键。
- 会话校验。
- 防重复提交。

策略：

- Redis 失败不能静默吞掉。
- 必须由专门类表达语义，例如 `RateLimiter`、`RedisLock`、`IdempotencyStore`、`SessionStore`。
- Router 仍不直接操作 Redis；业务 Service 或 middleware 注入对应语义类。
- 失败时按业务安全策略处理，例如 fail-closed 或返回明确错误。

## 计数器和 TTL

计数器使用 Redis 原子递增语义。

规则：

- 使用 `incr(key, amount=..., ttl_seconds=...)` 表达计数器更新。
- 设置 TTL 时必须保证新 key 能获得过期时间。
- 不应通过 `value == amount` 判断是否为新 key，因为 `amount > 1` 时容易遗漏 TTL。
- 已有 TTL 的 counter 不应在每次递增时被重置，避免滑动窗口误变成固定窗口或相反。

当前 `CacheClient.incr()` 的语义：

- 未传 `ttl_seconds`：只执行 `INCRBY`。
- 传入 `ttl_seconds`：递增后检查 TTL；只有 key 没有 TTL 时才设置过期时间。

## 健康检查

Redis 就绪检查属于应用 readiness，不属于 liveness。

规则：

- `/livez` 只判断进程是否可响应，不依赖 Redis。
- `/readyz` 可以检查 Redis PING。
- Redis 检查失败时，readyz 返回非 2xx，由编排系统暂停接流量。
- Redis 错误 detail 必须脱敏，不能输出连接 URL、密码或 token。

当前实现：

- `apps/api/app/platform/health.py` 调用 `fast_core.cache.health.check_redis()`。
- `apps/api/app/api/routes/health.py` 通过 `RedisDep` 获取已初始化 Redis client。

## 测试要求

修改 Redis/cache 基础能力时，必须更新 `packages/core/tests/test_cache.py` 或新增同层测试。

至少覆盖：

- Settings 中 Redis 默认配置。
- JSON/text/bytes/int 基础读写。
- counter + TTL 行为。
- key builder 环境隔离和敏感片段 hash。
- best-effort 缓存失败降级。
- Redis readiness 成功和失败。
- `get_redis()` 未初始化时的明确错误。

推荐验证命令：

```bash
uv run pytest packages/core/tests/test_cache.py
uv run ruff check packages/core/src/fast_core/cache packages/core/tests/test_cache.py
uv run pyright packages/core/src/fast_core/cache packages/core/tests/test_cache.py
```

## 演进方向

短期保持 `fast_core.cache` 薄封装，不把业务语义塞入公共包。

后续如有明确需求，可按独立文件扩展：

- `locks.py`：分布式锁。
- `rate_limit.py`：Redis-backed 限流。
- `idempotency.py`：幂等键存储。
- `sessions.py`：会话存储。
- `pubsub.py`：发布订阅。

扩展规则：

- 每个能力使用独立类和独立测试。
- 不把锁、限流、幂等全部塞进 `CacheClient`。
- 不引入 `packages/core -> apps/modules` 反向依赖。
- 涉及强约束能力时必须明确失败策略。
