import type { AxiosResponse } from 'axios'

import { createRequestPlugin } from '../core/plugin.js'
import type { RequestPlugin, ResponseRestfulHandler } from '../types.js'

/**
 * 创建 RESTful 响应插件。
 */
export function restfulPlugin(handler?: ResponseRestfulHandler): RequestPlugin {
  return createRequestPlugin({
    name: 'restful',
    onResponse: async (value) => {
      const data = isAxiosResponseLike(value) ? value.data : value

      if (handler) {
        await handler(data)
      }

      return data
    },
  })
}

function isAxiosResponseLike(value: unknown): value is AxiosResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'config' in value &&
    'data' in value &&
    'status' in value
  )
}
