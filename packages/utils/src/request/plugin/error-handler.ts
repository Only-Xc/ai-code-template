import { createRequestPlugin } from '../core/plugin.js'
import type {
  ErrorHandlerPluginOptions,
  RequestErrorHandler,
  RequestPlugin,
} from '../types.js'

/**
 * 创建统一错误处理插件。
 */
export function errorHandlerPlugin(
  handler: RequestErrorHandler,
  options: ErrorHandlerPluginOptions = {},
): RequestPlugin {
  return createRequestPlugin({
    name: 'error-handler',
    async onError(error, context) {
      if (context.config.skipErrorHandler) {
        return error
      }

      if (error.canceled && !options.handleCanceled) {
        return error
      }

      await handler(error, error.config ?? context.config)

      return error
    },
  })
}
