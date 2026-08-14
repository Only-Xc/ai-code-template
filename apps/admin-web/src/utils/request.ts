import { useAuthStore } from '@/store/useAuth'
import {
  authPlugin,
  i18nPlugin,
  createRequestClient,
  dedupePlugin,
  errorHandlerPlugin,
  normalizeRequestError,
  restfulPlugin,
  type RequestConfig,
} from '@ai-app/utils'
import { globalMessage } from '@/utils/message'
import { useAppStore } from '@/store/useApp'
import { i18n } from '@/i18n'

function shouldSkipGlobalErrorToast(config?: RequestConfig) {
  return config?.meta?.skipGlobalErrorToast === true
}

function handleRequestError(error: unknown, config?: RequestConfig) {
  const { status, message, canceled } = normalizeRequestError(error)

  if (canceled) return

  const skipToast = shouldSkipGlobalErrorToast(config)

  switch (status) {
    case 401:
      useAuthStore.getState().clearAuth()
      window.location.assign('/login')
      return

    case 403:
      globalMessage.error(i18n.t('common.errors.noPermission'))
      return

    case 500:
    case 502:
    case 503:
    case 504:
      if (!skipToast) {
        globalMessage.error(message || i18n.t('common.errors.serverError'))
      }
      return
    default: {
      if (!skipToast) {
        globalMessage.error(message || i18n.t('common.errors.requestFailed'))
      }
    }
  }
}

export const requestClient = createRequestClient({
  plugins: [
    dedupePlugin(),
    authPlugin({
      format: (token) => `Bearer ${token}`,
      getToken: () => useAuthStore.getState().accessToken,
      headerName: 'Authorization',
    }),
    i18nPlugin({
      getLocale: () => useAppStore.getState().locale,
    }),
    restfulPlugin(),
    errorHandlerPlugin(handleRequestError),
  ],
})

export type { RequestConfig }
