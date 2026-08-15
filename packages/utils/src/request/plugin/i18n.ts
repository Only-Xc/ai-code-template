import { AxiosHeaders } from 'axios'

import { createRequestPlugin } from '../core/plugin.js'
import type { I18nPluginOptions, RequestPlugin } from '../types'

type AxiosHeadersInput = Parameters<typeof AxiosHeaders.from>[0]

export function i18nPlugin({
  getLocale,
  headerName = 'Accept-Language',
  format,
}: I18nPluginOptions): RequestPlugin {
  return createRequestPlugin({
    name: 'i18n',
    async onRequest(config) {
      const locale = await getLocale()

      if (!locale) {
        return config
      }

      const headers = AxiosHeaders.from(config.headers as AxiosHeadersInput)

      headers.set(headerName, format ? format(locale) : locale)

      return {
        ...config,
        headers,
      }
    },
  })
}
