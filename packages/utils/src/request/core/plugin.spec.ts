import { describe, expect, it } from 'vitest'

import {
  createRequestPlugin,
  runErrorPlugins,
  runFinallyPlugins,
} from './plugin.js'
import type { RequestContext } from '../types.js'

function createContext(): RequestContext {
  return { config: {}, metadata: {}, startedAt: Date.now() }
}

describe('runFinallyPlugins', () => {
  it('逐个隔离清理 hook，全部执行后抛首个清理错误', async () => {
    const calls: string[] = []
    const plugins = [
      createRequestPlugin({
        name: 'first',
        onFinally() {
          calls.push('first')
          throw new Error('first cleanup failed')
        },
      }),
      createRequestPlugin({
        name: 'second',
        onFinally() {
          calls.push('second')
        },
      }),
    ]

    await expect(runFinallyPlugins(createContext(), plugins)).rejects.toThrow(
      'first cleanup failed',
    )
    expect(calls).toEqual(['first', 'second'])
  })
})

describe('runErrorPlugins', () => {
  it('抛错的错误处理器被隔离，不覆盖原请求错误', async () => {
    const plugins = [
      createRequestPlugin({
        name: 'observer',
        onError() {
          throw new Error('handler bug')
        },
      }),
    ]

    const error = await runErrorPlugins(
      new Error('network down'),
      createContext(),
      plugins,
    )
    expect(error.message).toBe('network down')
  })
})
