import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u

/** 请求级上下文：通过 AsyncLocalStorage 在异步调用链内传递 requestId。 */
@Injectable()
export class RequestContext {
  private readonly storage = new AsyncLocalStorage<string>()

  currentRequestId(): string | undefined {
    return this.storage.getStore()
  }

  run<T>(requestId: string, callback: () => T): T {
    return this.storage.run(requestId, callback)
  }

  requestIdOrCreate(): string {
    return this.currentRequestId() ?? createRequestId()
  }
}

/** 校验外部传入的 x-request-id，格式非法返回 undefined（由调用方生成新的）。 */
export function acceptedRequestId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const candidate = value.trim()
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : undefined
}

export function createRequestId(): string {
  return `req_${randomUUID().replaceAll('-', '')}`
}
