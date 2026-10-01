import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 未开启 vitest globals，RTL 自动清理不生效，这里显式注册
afterEach(() => cleanup())

/** antd v6 组件在 jsdom 下依赖 matchMedia，这里提供最小桩实现。 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })
}
