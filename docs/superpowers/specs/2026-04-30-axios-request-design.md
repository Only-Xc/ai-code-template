# Axios 请求库设计

## 背景

这个 monorepo 将共享运行时工具放在 `packages/utils`。请求库位于 `packages/utils/src/request`，基于 axios 提供可组合的请求基础设施。各应用在自己的 `src/utils/request.ts` 中组合项目专属 client，再由业务 API 使用。

当前设计采用 `core` 和 `plugin` 分层：

- `core` 负责 axios client 创建、拦截器接线、插件生命周期执行、错误归一化和核心类型。
- `plugin` 提供内置插件：认证、重复请求取消、响应解包、统一错误处理。
- `types.ts` 位于 `request` 根目录，集中维护对外类型。
- `index.ts` 作为唯一公共出口，业务侧从 `@ai-app/utils/request` 导入。

## 目标

- 提供基于 axios 的共享请求库。
- 通过 `createRequestClient()` 创建带插件能力的 axios client。
- 通过 `createRequestPlugin()` 创建自定义插件。
- 支持多个项目、多个后端协议和多个 token 来源。
- 统一将失败归一为 `RequestError`。
- 通过插件支持 token 注入、响应解包、重复请求取消、全局错误处理。
- 保持应用层对 401、toast、登录态等业务逻辑的控制权。

## 目录结构

```text
packages/utils/src/request/
  index.ts
  types.ts
  core/
    client.ts
    error.ts
    plugin.ts
  plugin/
    auth.ts
    dedupe.ts
    error-handler.ts
    response.ts
```

## 模块职责

`core/client.ts` 创建 axios 实例，安装请求和响应拦截器，并返回 `httpClient`。插件生命周期在拦截器中执行。

`core/plugin.ts` 提供 `createRequestPlugin()`，并集中维护插件执行方法：

- `runRequestPlugins()`
- `runResponsePlugins()`
- `runErrorPlugins()`
- `runFinallyPlugins()`

`core/error.ts` 定义 `RequestError`、`isRequestError()`、`normalizeRequestError()`。

`types.ts` 定义 `RequestConfig`、`RequestClient`、`RequestPlugin`、`RequestContext`、插件配置类型。

`plugin/auth.ts` 提供 `authPlugin()`，通过 token provider 注入 header。

`plugin/dedupe.ts` 提供 `dedupePlugin()` 和 `getPendingRequestKey()`，按 method、url、params、data 生成 key 并取消同 key 上一条请求。

`plugin/response.ts` 提供 `unwrapCodeDataPlugin()` 和 `dataPlugin()`。

`plugin/error-handler.ts` 提供 `errorHandlerPlugin()`，在错误归一化后执行应用传入的错误处理函数。

## 公共 API

核心导出：

```ts
createRequestClient(options)
createRequestPlugin(plugin)
RequestError
isRequestError(error)
normalizeRequestError(error)

authPlugin(options)
dedupePlugin()
errorHandlerPlugin(handler, options)
unwrapCodeDataPlugin(options)
dataPlugin()
getPendingRequestKey(config)
```

`createRequestClient()` 返回安装了插件拦截器的 axios client。axios instance 本身可直接作为 request 方法调用，文档主推直接调用：

```ts
const request = createRequestClient({
  baseURL: '/api',
  timeout: 15000,
  plugins: [
    dedupePlugin(),
    authPlugin({
      headerName: 'Authorization',
      format: (token) => `Bearer ${token}`,
      getToken: () => accessToken,
    }),
    unwrapCodeDataPlugin({
      codeKey: 'code',
      dataKey: 'data',
      messageKey: 'message',
      successCode: 200,
    }),
  ],
})

const profile = await request<UserProfile>({
  method: 'GET',
  url: '/user/profile',
})
```

`RequestConfig` 继承 axios 配置，并扩展请求库控制字段：

```ts
type RequestConfig<TData = unknown> = AxiosRequestConfig<TData> & {
  skipAuth?: boolean
  skipDedupe?: boolean
  skipErrorHandler?: boolean
  meta?: Record<string, unknown>
}
```

## 插件模型

插件结构：

```ts
type RequestPlugin = {
  name: string
  onRequest?(config, context): MaybePromise<RequestConfig | void>
  onResponse?(response, context): MaybePromise<unknown>
  onError?(error, context): MaybePromise<RequestError | void>
  onFinally?(context): MaybePromise<void>
}
```

自定义插件通过 `createRequestPlugin()` 创建：

```ts
const logPlugin = createRequestPlugin({
  name: 'log',
  onRequest(config) {
    console.log(config.url)
    return config
  },
})
```

内置插件也通过 `createRequestPlugin()` 创建，确保内置插件和自定义插件使用同一入口。

插件执行顺序：

1. 请求拦截器创建 `RequestContext`。
2. `runRequestPlugins()` 按配置顺序执行。
3. axios 发起请求。
4. 成功响应进入 `runResponsePlugins()`。
5. 失败或响应插件抛错进入 `runErrorPlugins()`。
6. `runFinallyPlugins()` 执行清理逻辑。

`RequestContext` 保存本次请求的共享数据：

```ts
type RequestContext<TData = unknown> = {
  config: RequestConfig<TData>
  startedAt: number
  metadata: Record<string, unknown>
}
```

## 响应处理

`unwrapCodeDataPlugin()` 支持不同后端响应协议：

```ts
unwrapCodeDataPlugin({
  codeKey: 'code',
  dataKey: 'data',
  messageKey: 'message',
  successCode: 200,
})
```

当响应体中的 code 匹配 `successCode` 时，插件返回 data 字段。

当 code 匹配失败时，插件抛出 `RequestError`，并带上 `code`、`status`、`data`、`config`。

`dataPlugin()` 直接返回 axios response 的 `data` 字段。

## 错误处理

请求库统一抛出 `RequestError`：

```ts
class RequestError extends Error {
  code?: number | string
  status?: number
  data?: unknown
  config?: RequestConfig
  canceled?: boolean
}
```

错误来源：

- 业务失败：`unwrapCodeDataPlugin()` 抛出。
- HTTP 失败：axios error 带 response。
- 网络失败：axios error 无 response。
- 超时：axios error code 为 `ECONNABORTED` 或 `ETIMEDOUT`。
- 取消：axios cancel error。

`errorHandlerPlugin()` 在错误归一化后执行：

```ts
errorHandlerPlugin((error, config) => {
  message.error(error.message)
})
```

单次请求可通过 `skipErrorHandler: true` 跳过错误处理插件。

## 应用适配层

应用侧组合具体 client。`apps/admin-web/src/utils/request.ts` 创建唯一 `requestClient`，组合 `dedupePlugin()`、`authPlugin()`、`i18nPlugin()`、`restfulPlugin()` 和 `errorHandlerPlugin()`。`apps/admin-web/src/api/_request.ts` 通过 `createApiCaller(requestClient)` 生成业务 API 调用入口。

`authPlugin()` 从 `useAuthStore` 读取 accessToken，注入 `Authorization: Bearer <token>`。401 时 `errorHandlerPlugin()` 清理登录态并跳转登录页。

请求库核心只负责错误归一化和插件调度，应用侧保留 401、toast、登录态等业务逻辑的控制权。

## 验证

当前验证命令：

```bash
pnpm --filter @ai-app/utils typecheck
pnpm --filter @ai-app/admin-web typecheck
pnpm --filter @ai-app/utils lint
pnpm --filter @ai-app/admin-web lint
pnpm --filter @ai-app/utils build
pnpm --filter @ai-app/admin-web build
```

测试命令沿用当前约定跳过。
