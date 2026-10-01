/** 与后端约定的统一响应信封。 */
export interface ApiEnvelope<T> {
  code: number
  message: string
  success: boolean
  data: T
}

/** 解包成功信封；失败信封或非信封形态抛 TypeError。 */
export function unwrapApiEnvelope<T>(value: unknown): T {
  if (
    !value ||
    typeof value !== 'object' ||
    !('success' in value) ||
    value.success !== true ||
    !('data' in value)
  ) {
    throw new TypeError('Invalid API envelope')
  }
  return value.data as T
}

export interface PaginationQuery {
  skip: number
  limit: number
}

export interface ListResult<T> {
  data: T[]
  count: number
}
