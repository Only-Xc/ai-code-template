import type { RequestConfig } from '@ai-app/utils'

declare const __apiResponse: unique symbol

type ResponseAdapter<TResponse> = {
  adapt(response: unknown): TResponse
}['adapt']
type RequestOverrides<TData = unknown> = Omit<
  RequestConfig<TData>,
  'url' | 'method'
>
type RequestMethod = NonNullable<RequestConfig['method']>
type PathParam = string | number | boolean

export type ApiRequest<TResponse, TData = unknown> = RequestConfig<TData> & {
  readonly [__apiResponse]?: TResponse
  adaptResponse?: ResponseAdapter<TResponse>
}

export function createRequest<TResponse, TData = unknown>(
  method: RequestMethod,
  url: string,
  overrides?: RequestOverrides<TData>,
  adaptResponse?: ResponseAdapter<TResponse>,
): ApiRequest<TResponse, TData> {
  const request = {
    url,
    method,
    ...overrides,
  }

  return adaptResponse ? { ...request, adaptResponse } : request
}

/** 拼接 URL 路径，自动 encode 动态路径段参数 */
export function path(
  strings: TemplateStringsArray,
  ...values: PathParam[]
): string {
  let result = strings[0] ?? ''

  values.forEach((value, index) => {
    result += encodeURIComponent(value)
    result += strings[index + 1] ?? ''
  })

  return result
}
