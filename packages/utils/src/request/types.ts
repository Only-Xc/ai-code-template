import type { AxiosInstance, AxiosRequestConfig } from 'axios'

import type { RequestError } from './core/error.js'

/**
 * 同步或异步返回值。
 */
export type MaybePromise<T> = T | Promise<T>

/**
 * 请求配置。
 */
export type RequestConfig<TData = unknown> = AxiosRequestConfig<TData> & {
  skipAuth?: boolean
  skipDedupe?: boolean
  skipErrorHandler?: boolean
  meta?: Record<string, unknown>
}

/**
 * token 提供函数。
 */
export type RequestTokenProvider = () => MaybePromise<string | null | undefined>

/**
 * 单次请求的插件上下文。
 */
export interface RequestContext<TData = unknown> {
  config: RequestConfig<TData>
  startedAt: number
  metadata: Record<string, unknown>
}

/**
 * 请求插件。
 */
export interface RequestPlugin {
  name: string
  onRequest?(
    config: RequestConfig,
    context: RequestContext,
  ): MaybePromise<RequestConfig | void>
  onResponse?(response: unknown, context: RequestContext): MaybePromise<unknown>
  onError?(
    error: RequestError,
    context: RequestContext,
  ): MaybePromise<RequestError | void>
  onFinally?(context: RequestContext): MaybePromise<void>
}

type AxiosRequestClientBase = Omit<AxiosInstance, 'request'>

/**
 * 插件处理后直接返回数据的 axios client。
 */
export interface RequestClient extends AxiosRequestClientBase {
  <T = unknown, TData = unknown>(config: RequestConfig<TData>): Promise<T>
  request<T = unknown, TData = unknown>(
    config: RequestConfig<TData>,
  ): Promise<T>
}

/**
 * 创建请求客户端的配置。
 */
export interface CreateRequestClientOptions {
  baseURL?: string
  timeout?: number
  headers?: AxiosRequestConfig['headers']
  withCredentials?: AxiosRequestConfig['withCredentials']
  plugins?: readonly RequestPlugin[]
}

export interface AuthPluginOptions {
  getToken: RequestTokenProvider
  headerName: string
  format?: (token: string) => string
}

export interface I18nPluginOptions {
  getLocale: RequestTokenProvider
  headerName?: string
  format?: (token: string) => string
}

export type ResponseCode = number | string

export interface UnwrapCodeDataPluginOptions {
  successCode: ResponseCode | readonly ResponseCode[]
  codeKey: string
  messageKey: string
  dataKey: string
  defaultErrorMessage?: string
}

export interface ErrorHandlerPluginOptions {
  handleCanceled?: boolean
}

export type RequestErrorHandler = (
  error: RequestError,
  config?: RequestConfig,
) => MaybePromise<void>

export type ResponseRestfulHandler = (data: unknown) => MaybePromise<void>
