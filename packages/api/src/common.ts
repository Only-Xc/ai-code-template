export interface PaginationQuery {
  skip: number
  limit: number
}

export interface ListResult<T> {
  data: T[]
  count: number
}
