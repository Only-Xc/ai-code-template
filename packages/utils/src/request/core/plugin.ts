import { normalizeRequestError } from './error.js'
import type { RequestConfig, RequestContext, RequestPlugin } from '../types.js'

/**
 * 创建自定义请求插件。
 */
export function createRequestPlugin<TPlugin extends RequestPlugin>(
  plugin: TPlugin,
): TPlugin {
  return plugin
}

/**
 * 按顺序执行请求插件。
 */
export async function runRequestPlugins<TData>(
  config: RequestConfig<TData>,
  context: RequestContext<TData>,
  plugins: readonly RequestPlugin[],
): Promise<RequestConfig<TData>> {
  let nextConfig = config as RequestConfig

  for (const plugin of plugins) {
    const result = await plugin.onRequest?.(
      nextConfig,
      context as RequestContext,
    )

    if (result) {
      nextConfig = result
      context.config = result as RequestConfig<TData>
    }
  }

  return nextConfig as RequestConfig<TData>
}

/**
 * 按顺序执行响应插件。
 */
export async function runResponsePlugins(
  response: unknown,
  context: RequestContext,
  plugins: readonly RequestPlugin[],
) {
  let value: unknown = response

  for (const plugin of plugins) {
    const result = await plugin.onResponse?.(value, context)

    if (result !== undefined) {
      value = result
    }
  }

  return value
}

/**
 * 归一化错误后按顺序执行错误插件。
 */
export async function runErrorPlugins(
  error: unknown,
  context: RequestContext,
  plugins: readonly RequestPlugin[],
) {
  let requestError = normalizeRequestError(error, context.config)

  for (const plugin of plugins) {
    const result = await plugin.onError?.(requestError, context)

    if (result) {
      requestError = result
    }
  }

  return requestError
}

/**
 * 按顺序执行请求结束插件。
 */
export async function runFinallyPlugins(
  context: RequestContext,
  plugins: readonly RequestPlugin[],
) {
  for (const plugin of plugins) {
    await plugin.onFinally?.(context)
  }
}
