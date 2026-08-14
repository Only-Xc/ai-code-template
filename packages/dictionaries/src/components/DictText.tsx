import { useDict } from '../useDict.js'
import { isEmptyDictValue, renderEmpty, renderFallback } from '../utils.js'
import type { DictTextProps } from './types.js'

export function DictText({
  className,
  emptyText,
  fallback,
  locale,
  type,
  value,
}: DictTextProps) {
  const dict = useDict(type, { locale })

  if (isEmptyDictValue(value)) {
    return <span className={className}>{renderEmpty(emptyText)}</span>
  }

  const item = dict.item(value)

  return (
    <span className={className}>
      {item ? dict.label(value) : renderFallback(fallback, value)}
    </span>
  )
}
