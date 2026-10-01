/** 解析 http(s) 绝对地址；非 http(s) 协议、无法解析或空输入返回空字符串。 */
export function resolveHttpUrl(
  value: string | null | undefined,
  baseUrl?: string,
): string {
  const trimmed = value?.trim()
  const target = trimmed === '' ? undefined : trimmed
  const resolved = target ?? baseUrl?.trim()
  if (!resolved) return ''

  try {
    const url = new URL(resolved, baseUrl?.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : ''
  } catch {
    return ''
  }
}
