import { Checkbox, Radio, Select } from 'antd'
import { useMemo } from 'react'

import { useDict } from '../useDict.js'
import type { DictSelectProps } from './types.js'

export function DictSelect<Value extends string = string>({
  checkboxProps,
  controlType,
  excludeValues,
  includeValues,
  locale,
  optionMapper,
  radioProps,
  type,
  ...props
}: DictSelectProps<Value>) {
  const resolvedControlType = controlType ?? 'select'
  const dict = useDict(type, { locale })

  const visibleItems = useMemo(() => {
    const includeSet = includeValues
      ? new Set<string>(includeValues)
      : undefined
    const excludeSet = excludeValues
      ? new Set<string>(excludeValues)
      : undefined
    const shouldUseValue = (value: string) => {
      if (includeSet && !includeSet.has(value)) return false
      if (excludeSet?.has(value)) return false

      return true
    }

    return dict.items.filter((item) => shouldUseValue(item.value))
  }, [dict.items, excludeValues, includeValues])

  const selectOptions = useMemo(() => {
    const defaultOptions = visibleItems.map((item) => ({
      label: dict.label(item.value),
      value: item.value as Value,
      disabled: item.disabled,
    }))

    if (optionMapper) {
      return visibleItems.map((item) =>
        optionMapper(item as Parameters<typeof optionMapper>[0]),
      )
    }

    return defaultOptions
  }, [dict, optionMapper, visibleItems])

  const groupOptions = useMemo(
    () =>
      visibleItems.map((item) => ({
        label: dict.label(item.value),
        value: item.value,
        disabled: item.disabled,
      })),
    [dict, visibleItems],
  )

  if (resolvedControlType === 'radio') {
    return (
      <Radio.Group
        {...radioProps}
        className={props.className}
        disabled={props.disabled ?? radioProps?.disabled}
        options={groupOptions}
        value={props.value}
        onChange={(event) => {
          props.onChange?.(event.target.value as Value, selectOptions)
          radioProps?.onChange?.(event)
        }}
      />
    )
  }

  if (resolvedControlType === 'checkbox') {
    return (
      <Checkbox.Group
        {...checkboxProps}
        className={props.className}
        disabled={props.disabled ?? checkboxProps?.disabled}
        options={groupOptions}
        value={props.value as string[] | undefined}
        onChange={(checkedValues) => {
          props.onChange?.(checkedValues as unknown as Value, selectOptions)
          checkboxProps?.onChange?.(checkedValues)
        }}
      />
    )
  }

  return <Select {...props} options={selectOptions} />
}
