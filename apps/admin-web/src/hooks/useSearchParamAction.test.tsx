import { renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { useEffect, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useSearchParamAction } from './useSearchParamAction.js'

let lastSearch = ''

function LocationProbe() {
  const location = useLocation()
  useEffect(() => {
    lastSearch = location.search
  }, [location.search])
  return null
}

function createWrapper(initialPath: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        {children}
      </MemoryRouter>
    )
  }
}

describe('useSearchParamAction', () => {
  it('匹配到参数时触发一次，并用 replace 抹掉参数', () => {
    const onTrigger = vi.fn()

    renderHook(() => useSearchParamAction('edit', '1', onTrigger), {
      wrapper: createWrapper('/page?edit=1'),
    })

    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(lastSearch).toBe('')
  })

  it('ready 为 false 时不触发，翻转后触发', () => {
    const onTrigger = vi.fn()
    let ready = false
    const wrapper = createWrapper('/page?edit=1')

    const { rerender } = renderHook(
      () => useSearchParamAction('edit', '1', onTrigger, ready),
      { wrapper },
    )
    expect(onTrigger).not.toHaveBeenCalled()

    ready = true
    rerender()
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('回调返回 false 时保留参数（深链留给下次解析）', () => {
    const onTrigger = vi.fn(() => false)

    renderHook(() => useSearchParamAction('target', null, onTrigger), {
      wrapper: createWrapper('/page?target=deep-1'),
    })

    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(lastSearch).toBe('?target=deep-1')
  })

  it('不匹配的参数不触发', () => {
    const onTrigger = vi.fn()

    renderHook(() => useSearchParamAction('edit', '1', onTrigger), {
      wrapper: createWrapper('/page?other=1'),
    })

    expect(onTrigger).not.toHaveBeenCalled()
  })
})
