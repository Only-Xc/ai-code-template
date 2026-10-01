import { readTrustedProxyIps } from './trusted-proxy'
import { mergeSafeRecords } from './configuration-files'

describe('mergeSafeRecords', () => {
  it('override 标量与数组整体替换，对象递归合并', () => {
    const base = {
      server: { port: 3000, hosts: ['a'] },
      logger: { level: 'info' },
    }
    const override = {
      server: { port: 3001, hosts: ['b', 'c'] },
    }

    const merged = mergeSafeRecords(base, override)

    expect(merged).toEqual({
      server: { port: 3001, hosts: ['b', 'c'] },
      logger: { level: 'info' },
    })
  })

  it('override 新增键并入结果', () => {
    const merged = mergeSafeRecords({ a: 1 }, { b: { c: 2 } })
    expect(merged).toEqual({ a: 1, b: { c: 2 } })
  })

  it('输入对象不被修改，结果与输入不共享引用', () => {
    const base = { nested: { value: 1 } }
    const override = { nested: { extra: 2 } }

    const merged = mergeSafeRecords(base, override)

    expect(base).toEqual({ nested: { value: 1 } })
    expect(override).toEqual({ nested: { extra: 2 } })
    ;(merged.nested as Record<string, unknown>).value = 99
    expect(base.nested.value).toBe(1)
  })

  it('__proto__ 键不篡改 Object.prototype', () => {
    const polluted = JSON.parse(
      '{"__proto__":{"polluted":true},"safe":1}',
    ) as Record<string, unknown>

    const merged = mergeSafeRecords({}, polluted)

    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.keys(merged)).toContain('__proto__')
    expect((Object.getPrototypeOf(merged) as object).constructor).toBe(Object)
  })
})

describe('readTrustedProxyIps', () => {
  it('undefined 返回空数组（不信任任何转发头）', () => {
    expect(readTrustedProxyIps(undefined)).toEqual([])
  })

  it('接受精确 IP 并去重', () => {
    expect(readTrustedProxyIps(['10.0.0.1', '10.0.0.1', '::1'])).toEqual([
      '10.0.0.1',
      '::1',
    ])
  })

  it('接受受控 CIDR，拒绝过宽网段', () => {
    expect(readTrustedProxyIps(['10.0.0.0/24'])).toEqual(['10.0.0.0/24'])
    expect(() => readTrustedProxyIps(['10.0.0.0/16'])).toThrow(
      'server.trustedProxyIps',
    )
    expect(readTrustedProxyIps(['2001:db8::/64'])).toEqual(['2001:db8::/64'])
    expect(() => readTrustedProxyIps(['2001:db8::/48'])).toThrow(
      'server.trustedProxyIps',
    )
  })

  it('拒绝非数组与非法地址', () => {
    expect(() => readTrustedProxyIps('10.0.0.1')).toThrow(
      'server.trustedProxyIps',
    )
    expect(() => readTrustedProxyIps([''])).toThrow('server.trustedProxyIps')
    expect(() => readTrustedProxyIps(['not-an-ip'])).toThrow(
      'server.trustedProxyIps',
    )
  })
})
