import { App as AntdApp, ConfigProvider, theme } from 'antd'
import { setComponentsLocale } from '@ai-app/components'
import { setDictLocale } from '@ai-app/dictionaries'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useIsomorphicLayoutEffect } from 'usehooks-ts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import { defaultSettings } from '@/config/defaultSettings'
import { syncDayjsLocale } from '@/i18n/dayjs'
import { useLocale } from '@/i18n/useLocale'
import { useAppStore } from '@/store/useApp'
import { GlobalMessageRegister } from '@/utils/message'

interface Props {
  children: ReactNode
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function AppProvider({ children }: Props) {
  const colorPrimary = defaultSettings.colorPrimary

  // 深色模式
  const themeMode = useAppStore((state) => state.theme)
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = themeMode
    // 挂载 antd CSS 变量作用域，供 index.css 在 :root / body 上引用 --ant-* 变量
    root.classList.add('css-var-root')
  }, [themeMode])

  // 多语言
  const { antdLocale, direction, locale } = useLocale()

  useIsomorphicLayoutEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = direction
    syncDayjsLocale(locale)
    setDictLocale(locale)
    setComponentsLocale(locale)
  }, [direction, locale])

  // antd 主题配置（其余配色均用 antd 官方默认令牌）
  const antdTheme = useMemo(
    () => ({
      algorithm:
        themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      // 固定 CSS 变量作用域 key，让 index.css 可在 :root / body 上引用 --ant-* 变量
      cssVar: { key: 'css-var-root' },
      token: {
        colorPrimary,
      },
      components: {
        Layout: {
          headerHeight: 52,
        },
        Table: {
          headerBorderRadius: 0,
        },
      },
    }),
    [colorPrimary, themeMode],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        direction={direction}
        locale={antdLocale}
        theme={antdTheme}
      >
        <AntdApp className="h-full">
          <GlobalMessageRegister />
          {children}
        </AntdApp>
      </ConfigProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
