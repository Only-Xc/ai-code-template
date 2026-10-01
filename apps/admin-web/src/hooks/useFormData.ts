import { useCallback, useState } from 'react'

/**
 * 独立的表单式数据控制，不依赖 antd Form。
 * 用于搜索/筛选/工具栏状态，以及后续会升级为真实表单的值
 * （`useForm` 建立在此 hook 之上）。
 *
 * - `model` — 当前值
 * - `getValues()` — 当前值快照
 * - `setValues(values)` — 替换整份值集合
 * - `updateValues(partial)` — 把部分补丁合并进当前值
 * - `resetFields(values?)` — 恢复初始值，可选重新播种
 */
export function useFormData<T extends object>(initValues: T) {
  const [model, setModel] = useState<T>(initValues)

  const getValues = useCallback((): T => model, [model])

  const setValues = useCallback((values: T) => {
    setModel(values)
  }, [])

  const updateValues = useCallback((values: Partial<T>) => {
    setModel((current) => ({ ...current, ...values }))
  }, [])

  const resetFields = useCallback(
    (values?: T) => {
      setModel(values ?? initValues)
    },
    [initValues],
  )

  return {
    model,
    getValues,
    setValues,
    updateValues,
    resetFields,
  }
}
