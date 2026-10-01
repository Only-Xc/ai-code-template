const REDACTED_VALUE = '[REDACTED]'
const CIRCULAR_VALUE = '[Circular]'
const ACCESSOR_VALUE = '[Accessor]'
const SENSITIVE_KEY_PARTS = [
  'password',
  'token',
  'authorization',
  'apikey',
  'secret',
  'cookie',
  'signature',
  'credential',
] as const

type SeenObjects = WeakSet<object>

/** 返回可安全写入结构化日志的副本，不修改输入对象。 */
export function redact(value: unknown): unknown {
  return redactValue(value, new WeakSet())
}

function redactValue(value: unknown, seen: SeenObjects): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value)
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value !== 'object' || value === null) {
    return value
  }
  if (seen.has(value)) {
    return CIRCULAR_VALUE
  }

  seen.add(value)
  const redacted = redactObject(value, seen)
  seen.delete(value)
  return redacted
}

function redactObject(value: object, seen: SeenObjects): unknown {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
  }
  if (value instanceof URL) {
    return redactSensitiveText(value.toString())
  }
  if (value instanceof Error) {
    return redactError(value, seen)
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen))
  }

  return redactProperties(value, seen)
}

function redactError(error: Error, seen: SeenObjects): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: error.name,
    message: redactSensitiveText(error.message),
  }
  if (error.stack) {
    result.stack = redactSensitiveText(error.stack)
  }
  if (error.cause !== undefined) {
    result.cause = redactValue(error.cause, seen)
  }
  if (error instanceof AggregateError) {
    result.errors = redactValue(error.errors, seen)
  }

  return Object.assign(
    result,
    redactProperties(error, seen, ['cause', 'errors']),
  )
}

function redactProperties(
  value: object,
  seen: SeenObjects,
  omittedKeys: readonly string[] = [],
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const descriptors = Object.getOwnPropertyDescriptors(value)

  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable || omittedKeys.includes(key)) {
      continue
    }
    const normalizedKey = key.replace(/[^a-z0-9]/giu, '').toLowerCase()
    const isSensitive = SENSITIVE_KEY_PARTS.some((part) =>
      normalizedKey.includes(part),
    )
    if (isSensitive) {
      result[key] = REDACTED_VALUE
    } else if ('value' in descriptor) {
      result[key] = redactValue(descriptor.value, seen)
    } else {
      result[key] = ACCESSOR_VALUE
    }
  }

  return result
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s"'`,;]+/giu, 'Bearer [REDACTED]')
    .replace(
      /\b(password|token|authorization|api[_-]?key|secret|cookie|signature|credential)\s*([:=])\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
      '$1$2[REDACTED]',
    )
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^@\s/]+@/giu, '$1[REDACTED]@')
    .replace(
      /([?&#][^=&]*(?:password|token|authorization|api[_-]?key|secret|cookie|signature|credential)[^=&]*=)[^&#\s]*/giu,
      '$1[REDACTED]',
    )
}
