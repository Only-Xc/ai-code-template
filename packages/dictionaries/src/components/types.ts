import type { RadioGroupProps, SelectProps } from 'antd'
import type { CSSProperties, ReactNode } from 'react'

import type { DictItem, DictLocale, DictType } from '../types.js'

export type DictValue = string | number | null | undefined
export type DictFallback = ReactNode | ((value: DictValue) => ReactNode)
export type DictCheckboxValue = string | number

export interface DictCheckboxGroupProps {
  className?: string
  defaultValue?: DictCheckboxValue[]
  disabled?: boolean
  name?: string
  style?: CSSProperties
  value?: DictCheckboxValue[]
  onChange?: (checkedValue: DictCheckboxValue[]) => void
}

export interface DictBaseProps {
  type: DictType
  value?: DictValue
  fallback?: DictFallback
  locale?: DictLocale
}

export interface DictTextProps extends DictBaseProps {
  className?: string
  emptyText?: ReactNode
}

export interface DictTagProps extends DictBaseProps {
  className?: string
  color?: string
  emptyText?: ReactNode
}

export type DictSelectControlType = 'checkbox' | 'radio' | 'select'

export interface DictSelectProps<Value extends string = string> extends Omit<
  SelectProps<Value>,
  'options' | 'type'
> {
  type: DictType
  locale?: DictLocale
  includeValues?: Value[]
  excludeValues?: Value[]
  controlType?: DictSelectControlType
  radioProps?: Omit<RadioGroupProps, 'options'>
  checkboxProps?: DictCheckboxGroupProps
  optionMapper?: (
    item: DictItem<Value>,
  ) => NonNullable<SelectProps<Value>['options']>[number]
}
