import type { AxiosResponse } from 'axios'

import { RequestError } from '../core/error.js'
import { createRequestPlugin } from '../core/plugin.js'
import type {
  ResponseCode,
  RequestPlugin,
  UnwrapCodeDataPluginOptions,
} from '../types.js'

const DEFAULT_RESPONSE_ERROR_MESSAGE = '请求处理失败'

/**
 * 创建按 code/data 协议解包的响应插件。
 */
export function unwrapCodeDataPlugin(
  options: UnwrapCodeDataPluginOptions,
): RequestPlugin {
  return createRequestPlugin({
    name: 'unwrap-code-data',
    onResponse(value) {
      if (!isAxiosResponseLike(value)) {
        return value
      }

      const payload: unknown = value.data

      if (!isRecord(payload)) {
        return payload
      }

      const code = payload[options.codeKey]

      if (isSuccessCode(code, options.successCode)) {
        return payload[options.dataKey]
      }

      throw new RequestError({
        code: readResponseCode(code),
        config: value.config,
        data: payload,
        message:
          readResponseMessage(payload[options.messageKey]) ??
          options.defaultErrorMessage ??
          DEFAULT_RESPONSE_ERROR_MESSAGE,
        status: value.status,
      })
    },
  })
}

/**
 * 创建直接返回 response.data 的响应插件。
 */
export function dataPlugin(): RequestPlugin {
  return createRequestPlugin({
    name: 'data',
    onResponse: (value) => (isAxiosResponseLike(value) ? value.data : value),
  })
}

function isSuccessCode(
  code: unknown,
  successCode: ResponseCode | readonly ResponseCode[],
): boolean {
  const successCodes = Array.isArray(successCode) ? successCode : [successCode]

  return successCodes.some((successCodeItem) => successCodeItem === code)
}

function readResponseCode(code: unknown): ResponseCode | undefined {
  return typeof code === 'number' || typeof code === 'string' ? code : undefined
}

function readResponseMessage(message: unknown): string | undefined {
  if (typeof message !== 'string') {
    return undefined
  }

  return message.trim() ? message : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAxiosResponseLike(value: unknown): value is AxiosResponse<unknown> {
  return (
    isRecord(value) && 'config' in value && 'data' in value && 'status' in value
  )
}
