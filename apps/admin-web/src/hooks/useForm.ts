import { Form } from 'antd'
import { useCallback } from 'react'

import { useFormData } from './useFormData.js'

/**
 * antd Form 的表单数据控制：antd form 实例与由初始值播种的 `useFormData`
 * 模型保持同步。
 *
 * - `formRef` — 传给 `<Form form={formRef}>`（antd form 实例）
 * - `model` — 当前值快照（由 setValues/updateValues/resetFields 更新）
 * - `getValues()` — 当前全部表单值
 * - `setValues(values)` — 替换整份值集合
 * - `updateValues(partial)` — 把部分补丁合并进当前值
 * - `resetFields(values?)` — antd 重置 + 恢复初始模型，可选重新播种
 * - `validate()` — antd validateFields
 */
export function useForm<T extends object>(initValues: T) {
  const [form] = Form.useForm<T>()
  const {
    model,
    getValues: getDataValues,
    setValues: setDataValues,
    updateValues: updateDataValues,
    resetFields: resetDataFields,
  } = useFormData(initValues)

  const getValues = useCallback((): T => {
    const formValues = form.getFieldsValue(true) as Partial<T>
    return { ...getDataValues(), ...formValues }
  }, [form, getDataValues])

  const setValues = useCallback(
    (values: T) => {
      setDataValues(values)
      form.setFieldsValue(values)
    },
    [form, setDataValues],
  )

  const updateValues = useCallback(
    (values: Partial<T>) => {
      updateDataValues(values)
      form.setFieldsValue(values)
    },
    [form, updateDataValues],
  )

  const resetFields = useCallback(
    (values?: T) => {
      form.resetFields()
      resetDataFields()
      if (values) {
        setDataValues(values)
        form.setFieldsValue(values)
      }
    },
    [form, resetDataFields, setDataValues],
  )

  const validate = useCallback(() => form.validateFields(), [form])

  return {
    formRef: form,
    model,
    getValues,
    setValues,
    updateValues,
    resetFields,
    validate,
  }
}
