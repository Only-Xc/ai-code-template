import type { PaginationProps } from 'antd'
import { useCallback, useMemo, useState } from 'react'

const DEFAULT_PAGE_SIZE_OPTIONS: PaginationProps['pageSizeOptions'] = [
  10, 20, 50, 100,
]

export interface UsePaginationParamsOptions {
  defaultCurrent?: number
  defaultPageSize?: number
  pageSizeOptions?: PaginationProps['pageSizeOptions']
  showQuickJumper?: PaginationProps['showQuickJumper']
  showSizeChanger?: PaginationProps['showSizeChanger']
}

export function usePaginationParams({
  defaultCurrent = 1,
  defaultPageSize = 20,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showQuickJumper = true,
  showSizeChanger = true,
}: UsePaginationParamsOptions = {}) {
  const [current, setCurrent] = useState(defaultCurrent)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const skip = useMemo(() => (current - 1) * pageSize, [current, pageSize])
  const limit = pageSize

  const reset = useCallback(() => {
    setCurrent(defaultCurrent)
  }, [defaultCurrent])

  const handleChange = useCallback<NonNullable<PaginationProps['onChange']>>(
    (nextCurrent, nextPageSize) => {
      if (nextPageSize !== pageSize) {
        setPageSize(nextPageSize)
        setCurrent(defaultCurrent)
        return
      }

      setCurrent(nextCurrent)
    },
    [defaultCurrent, pageSize],
  )

  const paginationProps = useMemo<
    Pick<
      PaginationProps,
      | 'current'
      | 'onChange'
      | 'pageSize'
      | 'pageSizeOptions'
      | 'showQuickJumper'
      | 'showSizeChanger'
    >
  >(
    () => ({
      current,
      pageSize,
      pageSizeOptions,
      showQuickJumper,
      showSizeChanger,
      onChange: handleChange,
    }),
    [
      current,
      handleChange,
      pageSize,
      pageSizeOptions,
      showQuickJumper,
      showSizeChanger,
    ],
  )

  const query = useMemo(
    () => ({
      skip,
      limit,
    }),
    [limit, skip],
  )

  return {
    current,
    handleChange,
    limit,
    pageSize,
    props: paginationProps,
    query,
    reset,
    setCurrent,
    setPageSize,
    skip,
  }
}
