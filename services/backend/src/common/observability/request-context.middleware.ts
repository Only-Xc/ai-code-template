import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { ServerResponse } from 'node:http'

import {
  RequestContext,
  acceptedRequestId,
  createRequestId,
} from './request-context'

interface RequestWithId {
  headers: Record<string, string | string[] | undefined>
}

/** 为每个请求生成/校验 x-request-id 并回显，同时在 ALS 中建立请求上下文。 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requests: RequestContext) {}

  use(
    request: RequestWithId,
    response: ServerResponse,
    next: () => void,
  ): void {
    const requestId =
      acceptedRequestId(request.headers['x-request-id']) ?? createRequestId()
    request.headers['x-request-id'] = requestId
    response.setHeader('x-request-id', requestId)

    this.requests.run(requestId, () => {
      next()
    })
  }
}
