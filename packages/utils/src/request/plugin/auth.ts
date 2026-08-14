import { AxiosHeaders } from 'axios'

import { createRequestPlugin } from '../core/plugin.js'
import type { AuthPluginOptions, RequestPlugin } from '../types.js'

type AxiosHeadersInput = Parameters<typeof AxiosHeaders.from>[0]

/**
 * 创建 header token 认证插件。
 */
export function authPlugin(options: AuthPluginOptions): RequestPlugin {
  return createRequestPlugin({
    name: 'auth',
    async onRequest(config) {
      if (config.skipAuth) {
        return config
      }

      const token = await options.getToken()

      if (!token) {
        return config
      }

      const headers = AxiosHeaders.from(config.headers as AxiosHeadersInput)

      headers.set(
        options.headerName,
        options.format ? options.format(token) : token,
      )

      return {
        ...config,
        headers,
      }
    },
  })
}
