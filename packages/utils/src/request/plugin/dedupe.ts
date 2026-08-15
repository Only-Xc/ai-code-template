import type { GenericAbortSignal } from 'axios'

import { createRequestPlugin } from '../core/plugin.js'
import type { RequestConfig, RequestContext, RequestPlugin } from '../types.js'

/**
 * pending 请求记录。
 *
 * controller 用于取消请求，signal 用于在响应阶段确认清理的是同一条请求，
 * cleanup 用于解除外部 signal 监听，避免保留多余监听器。
 */
interface PendingRequest {
  controller: AbortController
  signal: AbortSignal
  cleanup: () => void
}

const noop = () => {
  return undefined
}

const DEDUPE_METADATA_KEY = 'request:dedupe'

/**
 * 创建重复请求取消插件。
 */
export function dedupePlugin(): RequestPlugin {
  const pendingRequests = new Map<string, PendingRequest>()

  const cancelPendingRequest = (key: string) => {
    const pendingRequest = pendingRequests.get(key)

    if (!pendingRequest) {
      return
    }

    pendingRequest.controller.abort('重复请求已取消')
    pendingRequest.cleanup()
    pendingRequests.delete(key)
  }

  return createRequestPlugin({
    name: 'dedupe',
    onRequest(config, context) {
      if (config.skipDedupe) {
        return config
      }

      const key = getPendingRequestKey(config)

      cancelPendingRequest(key)

      const controller = new AbortController()
      const cleanup = bindAbortSignal(config.signal, controller)

      config.signal = controller.signal
      pendingRequests.set(key, {
        cleanup,
        controller,
        signal: controller.signal,
      })
      context.metadata[DEDUPE_METADATA_KEY] = {
        key,
        signal: controller.signal,
      }

      return {
        ...config,
        signal: controller.signal,
      }
    },
    onFinally(context) {
      const metadata = readDedupeMetadata(context)

      if (!metadata) {
        return
      }

      const pendingRequest = pendingRequests.get(metadata.key)

      if (!pendingRequest) {
        return
      }

      if (pendingRequest.signal !== metadata.signal) {
        return
      }

      pendingRequest.cleanup()
      pendingRequests.delete(metadata.key)
    },
  })
}

/**
 * 生成重复请求 key。
 *
 * method 和 url 表示接口身份，params 和 data 表示请求入参。
 * 入参会做稳定序列化，使对象 key 顺序变化时仍能生成一致结果。
 */
export function getPendingRequestKey(
  config: Pick<RequestConfig, 'data' | 'method' | 'params' | 'url'>,
): string {
  const method = (config.method ?? 'GET').toUpperCase()
  const url = config.url ?? ''
  const params = serializeValue(config.params)
  const data = serializeValue(config.data)

  return [method, url, params, data].join('&')
}

/**
 * 把调用方传入的 signal 与内部 AbortController 关联起来。
 *
 * 调用方主动 abort 时，内部 controller 也会 abort；
 * 请求结束后 cleanup 会移除监听关系。
 */
function bindAbortSignal(
  signal: GenericAbortSignal | undefined,
  controller: AbortController,
) {
  if (!signal) {
    return noop
  }

  if (signal.aborted) {
    controller.abort()
    return noop
  }

  const abortController = () => {
    controller.abort()
  }

  signal.addEventListener?.('abort', abortController, { once: true })

  return () => {
    signal.removeEventListener?.('abort', abortController)
  }
}

/**
 * 将请求参数序列化为字符串。
 *
 * undefined 会被 JSON.stringify 转成 undefined，这里统一落成空字符串，
 * 便于参与 key 拼接。
 */
function serializeValue(value: unknown): string {
  const serializedValue = JSON.stringify(normalizeSerializableValue(value))

  return serializedValue || ''
}

/**
 * 对参与 key 计算的数据做稳定化处理。
 *
 * Date 转 ISO 字符串，URLSearchParams 转查询字符串，FormData 转可比较数组，
 * 普通对象按 key 排序，确保同内容对象生成相同 key。
 */
function normalizeSerializableValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (
    typeof URLSearchParams !== 'undefined' &&
    value instanceof URLSearchParams
  ) {
    return value.toString()
  }

  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return Array.from(value.entries()).map(([key, entryValue]) => [
      key,
      typeof entryValue === 'string' ? entryValue : '[binary]',
    ])
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeSerializableValue(item))
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeSerializableValue(value[key])
        return result
      }, {})
  }

  return value
}

/**
 * 判断对象是否是普通对象，数组、Date、FormData 等类型会进入各自分支。
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function readDedupeMetadata(
  context: RequestContext,
): { key: string; signal: AbortSignal } | undefined {
  const value = context.metadata[DEDUPE_METADATA_KEY]

  if (
    isPlainObject(value) &&
    typeof value.key === 'string' &&
    value.signal instanceof AbortSignal
  ) {
    return value as { key: string; signal: AbortSignal }
  }

  return undefined
}
