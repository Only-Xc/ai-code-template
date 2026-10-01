export type ConfigurationRecord = Record<string, unknown>

// YAML 解析产物只可能是纯对象、数组或标量，直接用 typeof/Array.isArray 判别

/**
 * 深合并两份配置记录：对象递归合并，数组与标量由 override 整体替换。
 * 通过 Object.fromEntries 构建结果，杜绝 __proto__ 键篡改原型；
 * 输入对象不被修改，返回值不共享引用。
 */
export function mergeSafeRecords(
  base: ConfigurationRecord,
  override: ConfigurationRecord,
): ConfigurationRecord {
  const entries: [string, unknown][] = []

  for (const [key, baseValue] of Object.entries(base)) {
    if (!Object.hasOwn(override, key)) {
      entries.push([key, copyValue(baseValue)])
      continue
    }

    const overrideValue = override[key]
    const bothRecords =
      typeof baseValue === 'object' &&
      baseValue !== null &&
      !Array.isArray(baseValue) &&
      typeof overrideValue === 'object' &&
      overrideValue !== null &&
      !Array.isArray(overrideValue)
    entries.push([
      key,
      bothRecords
        ? mergeSafeRecords(
            baseValue as ConfigurationRecord,
            overrideValue as ConfigurationRecord,
          )
        : copyValue(overrideValue),
    ])
  }

  for (const [key, overrideValue] of Object.entries(override)) {
    if (!Object.hasOwn(base, key)) {
      entries.push([key, copyValue(overrideValue)])
    }
  }

  return Object.fromEntries(entries)
}

function copyValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(copyValue)
  }
  if (typeof value === 'object' && value !== null) {
    const entries: [string, unknown][] = []
    for (const [key, child] of Object.entries(value)) {
      entries.push([key, copyValue(child)])
    }
    return Object.fromEntries(entries)
  }
  return value
}
