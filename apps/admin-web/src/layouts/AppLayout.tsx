import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { Button, Drawer, Layout, Tooltip } from 'antd'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router'

import { useLocale } from '@/i18n/useLocale'
import { appRoutes } from '@/router/routes'
import { useAppStore } from '@/store/useApp'
import { getCurrentRouteMeta, getRouteTitle } from '@/utils/routeMeta'
import { Header } from './components/Header'
import { buildNavItems, getActiveNavKey } from './components/Sidebar/layoutNav'
import { Sidebar } from './components/Sidebar'

const {
  Header: LayoutHeader,
  Sider: LayoutSider,
  Content: LayoutContent,
} = Layout

const SIDEBAR_WIDTH = 220
const SIDEBAR_COLLAPSED_WIDTH = 80

const sidebarTriggerStyle: CSSProperties = {
  width: 24,
  minWidth: 24,
  height: 24,
  padding: 0,
  fontSize: 12,
}

export function AppLayout() {
  const location = useLocation()
  const { direction } = useLocale()
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed)
  const toggleSidebarCollapsed = useAppStore(
    (state) => state.toggleSidebarCollapsed,
  )
  const navItems = useMemo(() => buildNavItems(appRoutes, t), [t])
  const activeKey = useMemo(
    () => getActiveNavKey(location.pathname, navItems),
    [location.pathname, navItems],
  )
  const sidebarWidth = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_WIDTH
  const sidebarToggleLabel = sidebarCollapsed
    ? t('layout.sidebar.expand')
    : t('layout.sidebar.collapse')

  useEffect(() => {
    const current = getCurrentRouteMeta(appRoutes, location.pathname)
    const title = current ? getRouteTitle(current.meta, t) : ''
    const appTitle = t('common.appTitle')

    document.title = title ? `${title} - ${appTitle}` : appTitle
  }, [location.pathname, t])

  return (
    <Layout className="min-h-full">
      <LayoutHeader
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          height: 'var(--ant-layout-header-height)',
          paddingInline: 16,
          background: 'var(--ant-color-bg-container)',
          borderBottom: '1px solid var(--ant-color-border-secondary)',
        }}
      >
        <Header onOpenMenu={() => setMenuOpen(true)} />
      </LayoutHeader>

      <Layout hasSider>
        <LayoutSider
          className="max-lg:hidden"
          collapsible
          collapsed={sidebarCollapsed}
          collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
          trigger={null}
          width={SIDEBAR_WIDTH}
          style={{
            position: 'sticky',
            top: 'var(--ant-layout-header-height)',
            height: 'calc(100vh - var(--ant-layout-header-height))',
            overflow: 'auto',
            background: 'var(--ant-color-bg-container)',
            borderInlineEnd: '1px solid var(--ant-color-border-secondary)',
          }}
        >
          <Sidebar
            activeKey={activeKey}
            collapsed={sidebarCollapsed}
            navItems={navItems}
          />
          <div
            className="max-lg:hidden"
            style={{
              position: 'fixed',
              bottom: 20,
              insetInlineStart: sidebarWidth - 12,
              zIndex: 10,
              transition: 'inset-inline-start 160ms ease',
            }}
          >
            <Tooltip
              title={sidebarToggleLabel}
              placement={direction === 'rtl' ? 'left' : 'right'}
            >
              <Button
                aria-label={sidebarToggleLabel}
                shape="circle"
                style={sidebarTriggerStyle}
                icon={
                  sidebarCollapsed ? (
                    <MenuUnfoldOutlined />
                  ) : (
                    <MenuFoldOutlined />
                  )
                }
                onClick={toggleSidebarCollapsed}
              />
            </Tooltip>
          </div>
        </LayoutSider>

        <LayoutContent style={{ background: 'var(--ant-color-bg-layout)' }}>
          <main className="h-full w-full">
            <Outlet />
          </main>
        </LayoutContent>
      </Layout>

      <Drawer
        placement={direction === 'rtl' ? 'right' : 'left'}
        open={menuOpen}
        size={SIDEBAR_WIDTH}
        onClose={() => setMenuOpen(false)}
        styles={{
          body: { padding: 0 },
          header: { display: 'none' },
        }}
      >
        <Sidebar
          activeKey={activeKey}
          navItems={navItems}
          onNavigate={() => setMenuOpen(false)}
        />
      </Drawer>
    </Layout>
  )
}
