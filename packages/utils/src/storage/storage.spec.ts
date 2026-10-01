import { beforeEach, describe, expect, it, vi } from 'vitest'

/** 内存 Storage 桩：与 DOM Storage 接口对齐，足以驱动 createStorageApi。 */
function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

const memory = {
  localStorage: createMemoryStorage(),
  sessionStorage: createMemoryStorage(),
}

vi.stubGlobal('window', memory)

const { local, session } = await import('./storage.js')

describe('storage 容错', () => {
  beforeEach(() => {
    memory.localStorage.clear()
    memory.sessionStorage.clear()
  })

  it('正常往返与过期清理', () => {
    local.set('k', { v: 1 })
    expect(local.get('k')).toEqual({ v: 1 })

    local.set('expired', 'x', { expiresIn: -1 })
    expect(local.get('expired')).toBeUndefined()
    expect(memory.localStorage.getItem('expired')).toBeNull()
  })

  it('损坏 JSON 清理坏条目并返回 undefined', () => {
    memory.localStorage.setItem('broken', '{not-json')
    expect(local.get('broken')).toBeUndefined()
    expect(memory.localStorage.getItem('broken')).toBeNull()
  })

  it('非对象值（数字/字符串）视为坏条目清理', () => {
    memory.localStorage.setItem('scalar', '42')
    expect(local.get('scalar')).toBeUndefined()

    memory.localStorage.setItem('str', '"hello"')
    expect(local.get('str')).toBeUndefined()
  })

  it('非法 expiresAt（非数字/NaN）视为坏条目清理', () => {
    memory.localStorage.setItem(
      'bad-expires',
      JSON.stringify({ expiresAt: 'soon', value: 1 }),
    )
    expect(local.get('bad-expires')).toBeUndefined()

    memory.localStorage.setItem(
      'nan-expires',
      JSON.stringify({ expiresAt: Number.NaN, value: 1 }),
    )
    expect(local.get('nan-expires')).toBeUndefined()
  })

  it('session 与 local 相互隔离', () => {
    session.set('shared-key', 'session-value')
    local.set('shared-key', 'local-value')
    expect(session.get('shared-key')).toBe('session-value')
    expect(local.get('shared-key')).toBe('local-value')
  })
})
