import { redact } from './redactor'

describe('redact', () => {
  it('敏感键整体替换，普通键保留', () => {
    expect(
      redact({ email: 'a@b.c', password: 'p@ss', accessToken: 'tok' }),
    ).toEqual({
      email: 'a@b.c',
      password: '[REDACTED]',
      accessToken: '[REDACTED]',
    })
  })

  it('脱敏 Bearer 与 key=value 形式的凭据文本', () => {
    // Authorization 标签值与 Bearer 令牌都被替换，日志中零残留
    expect(redact('Authorization: Bearer abc.def.ghi')).toBe(
      'Authorization:[REDACTED] [REDACTED]',
    )
    expect(redact('password=secret123')).toBe('password=[REDACTED]')
  })

  it('脱敏 URL 内嵌凭据与查询参数', () => {
    expect(redact('postgres://user:pass@db:5432/app')).toBe(
      'postgres://[REDACTED]@db:5432/app',
    )
    expect(redact('https://x.test/cb?access_token=abc&ok=1')).toBe(
      'https://x.test/cb?access_token=[REDACTED]&ok=1',
    )
  })

  it('Error 保留 name/message 结构并脱敏 cause', () => {
    const result = redact(
      new Error('login failed', { cause: { password: 'x' } }),
    ) as Record<string, unknown>

    expect(result.name).toBe('Error')
    expect(result.message).toBe('login failed')
    expect(result.cause).toEqual({ password: '[REDACTED]' })
  })

  it('循环引用不死循环', () => {
    const a: Record<string, unknown> = { name: 'a' }
    a.self = a
    expect(redact(a)).toEqual({ name: 'a', self: '[Circular]' })
  })

  it('数组与 bigint 安全处理', () => {
    expect(redact(['token=abc', 1n])).toEqual(['token=[REDACTED]', '1'])
  })
})
