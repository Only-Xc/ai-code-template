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
 *
 * 错误处理器属于观察性副作用：单个处理器抛错被隔离，不覆盖原请求错误。
 */
export async function runErrorPlugins(
  error: unknown,
  context: RequestContext,
  plugins: readonly RequestPlugin[],
) {
  let requestError = normalizeRequestError(error, context.config)

  for (const plugin of plugins) {
    try {
      const result = await plugin.onError?.(requestError, context)

      if (result) {
        requestError = result
      }
    } catch {
      // 请求失败本身才是最终结果
    }
  }

  return requestError
}

/**
 * 按顺序执行请求结束插件。
 *
 * 逐个隔离清理 hook 的异常，全部执行完后抛出首个清理错误，
 * 避免单个失败的 cleanup 跳过后续清理。
 */
export async function runFinallyPlugins(
  context: RequestContext,
  plugins: readonly RequestPlugin[],
) {
  let cleanupError: unknown
  let hasCleanupError = false

  for (const plugin of plugins) {
    try {
      await plugin.onFinally?.(context)
    } catch (error) {
      if (!hasCleanupError) {
        cleanupError = error
        hasCleanupError = true
      }
    }
  }

  if (hasCleanupError) {
    throw cleanupError instanceof Error
      ? cleanupError
      : new Error('Request cleanup hook failed', { cause: cleanupError })
  }
}
