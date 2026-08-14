export type DictType = 'demo'

export type DictLocale = 'zh-CN' | 'en-US' | 'ar' | (string & {})

export interface DictItem<Value extends string = string> {
  label: string
  labels?: Partial<Record<DictLocale, string>>
  value: Value
  color?: string
  disabled?: boolean
  sort?: number
  raw?: Record<string, unknown>
}

export type DictRegistry = Record<DictType, readonly DictItem[]>
