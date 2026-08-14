import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import {
  runErrorPlugins,
  runFinallyPlugins,
  runRequestPlugins,
  runResponsePlugins,
} from './plugin.js'
import type {
  CreateRequestClientOptions,
  RequestConfig,
  RequestContext,
  RequestClient,
} from '../types.js'

const DEFAULT_REQUEST_TIMEOUT = 15000
const REQUEST_CONTEXT_KEY: unique symbol = Symbol('requestContext')

type RequestConfigWithContext<TData = unknown> = RequestConfig<TData> & {
  [REQUEST_CONTEXT_KEY]?: RequestContext<TData>
}

/**
 * 创建插件式 axios client。
 */
export function createRequestClient(
  options: CreateRequestClientOptions = {},
): RequestClient {
  const httpClient = axios.create({
    baseURL: options.baseURL ?? '',
    headers: options.headers,
    timeout: options.timeout ?? DEFAULT_REQUEST_TIMEOUT,
    withCredentials: options.withCredentials,
  })

  const plugins = [...(options.plugins ?? [])]

  httpClient.interceptors.request.use(async (config) => {
    const requestConfig = config as RequestConfigWithContext
    const context = createRequestContext(requestConfig)

    requestConfig[REQUEST_CONTEXT_KEY] = context

    const nextConfig = await runRequestPlugins(requestConfig, context, plugins)
    const nextRequestConfig = nextConfig as RequestConfigWithContext

    nextRequestConfig[REQUEST_CONTEXT_KEY] = context
    context.config = nextConfig

    return nextConfig as InternalAxiosRequestConfig
  })

  const onResponse = async (response: AxiosResponse<unknown>) => {
    const context = readRequestContext(response.config)

    try {
      const value = await runResponsePlugins(response, context, plugins)

      return unwrapAxiosResponse(value)
    } catch (error) {
      throw await runErrorPlugins(error, context, plugins)
    } finally {
      await runFinallyPlugins(context, plugins)
      cleanupRequestContext(context)
    }
  }
  const onResponseError = async (error: unknown) => {
    const context = readErrorRequestContext(error)

    try {
      throw await runErrorPlugins(error, context, plugins)
    } finally {
      await runFinallyPlugins(context, plugins)
      cleanupRequestContext(context)
    }
  }

  httpClient.interceptors.response.use(
    onResponse as unknown as (
      response: AxiosResponse,
    ) => AxiosResponse | Promise<AxiosResponse>,
    onResponseError,
  )

  return httpClient as unknown as RequestClient
}

function unwrapAxiosResponse(value: unknown): unknown {
  return isAxiosResponse(value) ? value.data : value
}

function isAxiosResponse(value: unknown): value is AxiosResponse<unknown> {
  return (
    isRecord(value) &&
    'config' in value &&
    'data' in value &&
    'headers' in value &&
    'status' in value
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function createRequestContext<TData>(
  config: RequestConfig<TData>,
): RequestContext<TData> {
  return {
    config,
    metadata: {},
    startedAt: Date.now(),
  }
}

function readRequestContext<TData>(
  config: RequestConfig<TData>,
): RequestContext<TData> {
  const requestConfig = config as RequestConfigWithContext<TData>

  return (
    requestConfig[REQUEST_CONTEXT_KEY] ?? createRequestContext(requestConfig)
  )
}

function readErrorRequestContext(error: unknown): RequestContext {
  if (!axios.isAxiosError(error) || !error.config) {
    return createRequestContext({})
  }

  return readRequestContext(error.config as RequestConfig)
}

function cleanupRequestContext(context: RequestContext) {
  delete (context.config as RequestConfigWithContext)[REQUEST_CONTEXT_KEY]
}
