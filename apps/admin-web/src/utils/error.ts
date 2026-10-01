import { isRequestError } from '@ai-app/utils'

import { globalMessage } from './message.js'

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/** 只对请求层尚未上报过的错误弹出提示（RequestError 已由 error-handler 插件上报）。 */
export function showUnexpectedError(error: unknown): void {
  if (!isRequestError(error)) {
    globalMessage.error(errorMessage(error, String(error)))
  }
}
