# 浏览器存储封装设计

## 背景

这个 monorepo 将共享运行时工具放在 `packages/utils`。`apps/admin-web` 通过共享存储 API 使用浏览器存储：

- `session` 用于浏览器会话生命周期数据。
- `local` 用于持久化浏览器数据。

当前实现直接封装原生浏览器 `Storage` API。它存储一个 JSON 载荷，其中包含保存的值和可选过期时间戳。

## 目标

- 在 `packages/utils` 中添加存储工具。
- 导出两个顶层辅助对象：`session` 和 `local`。
- 使用 `window.sessionStorage` 存储会话生命周期数据。
- 使用 `window.localStorage` 存储持久化本地数据。
- 保持公共 API 精简：`get`、`set`、`remove` 和 `clear`。
- 为 `get<T>()` 支持泛型返回类型。
- 通过 `set(key, value, { expiresIn })` 支持可选 TTL。
- 通过 `@ai-app/utils/storage` 导出存储工具。
- 让应用通过 `workspace:*` 消费 `@ai-app/utils`。
- 通过 typecheck 和 lint 验证实现。

## 目录结构

```text
packages/utils/
  package.json
  tsconfig.json
  src/
    index.ts
    storage/
      index.ts
      storage.ts
      types.ts
```

## 模块职责

`storage.ts` 基于原生浏览器 storage 创建 `session` 和 `local` 封装。

`types.ts` 定义 `StorageApi` 和 `StorageSetOptions`。

`index.ts` 导出公共存储 API。

包级 `src/index.ts` 重新导出 `./storage`，支持使用方从包根路径导入。

## 公共 API

```ts
import { local, session } from '@ai-app/utils/storage'

session.set('token', token)
const token = session.get<string>('token')
session.remove('token')
session.clear()

local.set('theme', 'dark', { expiresIn: 7 * 24 * 60 * 60 * 1000 })
const theme = local.get<string>('theme')
local.remove('theme')
local.clear()
```

存储类型为：

```ts
export interface StorageSetOptions {
  expiresIn?: number
}

export type StorageApi = {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, options?: StorageSetOptions): void
  remove(key: string): void
  clear(): void
}
```

## 行为

`session` 将值存储在 `window.sessionStorage`。数据遵循浏览器会话生命周期。

`local` 将值存储在 `window.localStorage`。数据会跨浏览器会话保留，直到被移除、清空或过期。

两个辅助对象都使用同步方法，与浏览器 `Storage` 行为保持一致。

值以 JSON 形式存储：

```ts
type StorageValue<T> = {
  expiresAt?: number
  value: T
}
```

`set()` 写入 `{ value, expiresAt }`。省略 `expiresIn` 时也会省略 `expiresAt`。

`expiresIn` 是以毫秒为单位的 TTL。封装层将 `expiresAt` 计算为 `Date.now() + expiresIn`。

`get()` 读取 JSON 载荷，移除过期条目，并在 key 缺失或已过期时返回 `undefined`。

## 错误处理

封装层保持 storage 行为透明。浏览器配额失败、storage 访问失败和 JSON 解析失败会传递给调用方。

`set()` 使用 `Number.isFinite()` 校验 `expiresIn`。无效 TTL 值会抛出 `RangeError('storage expiresIn must be a finite number')`。

## 依赖

Storage 直接使用浏览器 `Storage` API。

按当前 workspace 策略，将 `@ai-app/utils` 添加到应用依赖：

```json
{
  "@ai-app/utils": "workspace:*"
}
```

## 验证

当前验证命令：

```bash
pnpm --filter @ai-app/utils build
pnpm --filter @ai-app/utils typecheck
pnpm --filter @ai-app/utils lint
pnpm --filter @ai-app/admin-web typecheck
pnpm --filter @ai-app/admin-web lint
```

项目引入测试运行器后，可以补充聚焦单元测试。
