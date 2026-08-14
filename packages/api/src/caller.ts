import type { RequestClient } from '@ai-app/utils'

import type { ApiRequest } from './client.js'

export function createApiCaller(client: RequestClient) {
  return function <TArgs extends unknown[], TResponse, TData = unknown>(
    requestFactory: (...args: TArgs) => ApiRequest<TResponse, TData>,
  ) {
    return (...args: TArgs): Promise<TResponse> => {
      const { adaptResponse, ...config } = requestFactory(...args)
      const promise = client<unknown, TData>(config)

      return adaptResponse
        ? promise.then(adaptResponse)
        : (promise as unknown as Promise<TResponse>)
    }
  }
}
