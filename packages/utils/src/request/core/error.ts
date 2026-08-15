import axios from 'axios'
import type { AxiosError } from 'axios'

import type { RequestConfig } from '../types.js'

const DEFAULT_REQUEST_ERROR_MESSAGE = '请求失败，请稍后重试'
const DEFAULT_NETWORK_ERROR_MESSAGE = '网络异常，请检查网络连接'
const DEFAULT_TIMEOUT_ERROR_MESSAGE = '请求超时，请稍后重试'
const DEFAULT_CANCELED_ERROR_MESSAGE = '请求已取消'

/**
 * 创建 RequestError 的入参。
 *
 * code 表示应用错误码，status 表示 HTTP 状态码，data 保留原始错误数据，
 * canceled 用于标记请求取消场景，cause 保留底层错误对象便于调试。
 */
export interface RequestErrorOptions {
  message: string
  code?: number | string
  status?: number
  data?: unknown
  canceled?: boolean
  cause?: unknown
  config?: RequestConfig
}

/**
 * 请求库对外抛出的统一错误类型。
 *
 * 页面、React Query、表单提交逻辑都可以只判断 RequestError，
 * 再按 code/status/canceled 做细分处理。
 */
export class RequestError extends Error {
  override name = 'RequestError'

  code?: number | string
  status?: number
  data?: unknown
  canceled?: boolean
  config?: RequestConfig

  constructor(options: RequestErrorOptions) {
    super(options.message, { cause: options.cause })

    // 只在字段有值时挂载，保持错误对象精简，也方便调用方用 undefined 判断来源。
    if (options.code !== undefined) {
      this.code = options.code
    }

    if (options.status !== undefined) {
      this.status = options.status
    }

    if (options.data !== undefined) {
      this.data = options.data
    }

    if (options.canceled !== undefined) {
      this.canceled = options.canceled
    }

    if (options.config !== undefined) {
      this.config = options.config
    }

    // 修正继承内置 Error 时的原型链，保证 instanceof RequestError 稳定生效。
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * 判断未知错误是否已经是请求库标准错误。
 */
export function isRequestError(error: unknown): error is RequestError {
  return error instanceof RequestError
}

/**
 * 将任意错误归一化为 RequestError。
 *
 * 入口统一处理四类来源：
 * - 已经标准化过的 RequestError
 * - axios 取消请求
 * - axios HTTP、网络、超时错误
 * - 普通 Error 或未知值
 */
export function normalizeRequestError(
  error: unknown,
  fallbackConfig?: RequestConfig,
): RequestError {
  if (isRequestError(error)) {
    if (!error.config && fallbackConfig) {
      error.config = fallbackConfig
    }

    return error
  }

  if (axios.isCancel(error)) {
    return new RequestError({
      canceled: true,
      cause: error,
      config: readAxiosErrorConfig(error) ?? fallbackConfig,
      message: DEFAULT_CANCELED_ERROR_MESSAGE,
    })
  }

  if (axios.isAxiosError(error)) {
    return normalizeAxiosError(error)
  }

  if (error instanceof Error) {
    return new RequestError({
      cause: error,
      config: fallbackConfig,
      message: error.message || DEFAULT_REQUEST_ERROR_MESSAGE,
    })
  }

  return new RequestError({
    config: fallbackConfig,
    data: error,
    message: DEFAULT_REQUEST_ERROR_MESSAGE,
  })
}

/**
 * 处理 axios 抛出的错误。
 *
 * error.response 存在时代表服务端返回了 HTTP 响应；
 * response 为空时通常是超时、断网、跨域失败等网络层问题。
 */
function normalizeAxiosError(error: AxiosError<unknown>): RequestError {
  if (error.response) {
    const responseData = error.response.data

    return new RequestError({
      cause: error,
      config: error.config as RequestConfig | undefined,
      data: responseData,
      message:
        readRestfulErrorMessage(responseData) ??
        readErrorMessage(error) ??
        DEFAULT_REQUEST_ERROR_MESSAGE,
      status: error.response.status,
    })
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new RequestError({
      cause: error,
      config: error.config as RequestConfig | undefined,
      message: DEFAULT_TIMEOUT_ERROR_MESSAGE,
    })
  }

  return new RequestError({
    cause: error,
    config: error.config as RequestConfig | undefined,
    message:
      error.message === 'Network Error'
        ? DEFAULT_NETWORK_ERROR_MESSAGE
        : (readErrorMessage(error) ?? DEFAULT_REQUEST_ERROR_MESSAGE),
  })
}

function readAxiosErrorConfig(error: unknown): RequestConfig | undefined {
  return axios.isAxiosError(error)
    ? (error.config as RequestConfig | undefined)
    : undefined
}

/**
 * 读取 Error.message，并把空字符串视为无可用文案。
 */
function readErrorMessage(error: Error): string | undefined {
  return error.message.trim() ? error.message : undefined
}

function readRestfulErrorMessage(data: unknown): string | undefined {
  if (!isRecord(data)) {
    return undefined
  }

  return (
    readNonEmptyString(data.message) ??
    readNonEmptyString(data.detail) ??
    readNonEmptyString(data.error)
  )
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
