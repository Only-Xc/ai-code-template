import { Tag } from 'antd'

import { useDict } from '../useDict.js'
import { isEmptyDictValue, renderEmpty, renderFallback } from '../utils.js'
import type { DictTagProps } from './types.js'

export function DictTag({
  className,
  color,
  emptyText,
  fallback,
  locale,
  type,
  value,
}: DictTagProps) {
  const dict = useDict(type, { locale })

  if (isEmptyDictValue(value)) {
    return <span className={className}>{renderEmpty(emptyText)}</span>
  }

  const item = dict.item(value)

  return (
    <Tag className={className} color={color ?? item?.color}>
      {item ? dict.label(value) : renderFallback(fallback, value)}
    </Tag>
  )
}
