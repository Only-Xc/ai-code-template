import { Menu, type MenuProps } from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { getOpenNavKeys, getPathByNavKey, type NavTreeItem } from './layoutNav'

interface SidebarProps {
  activeKey: string
  navItems: NavTreeItem[]
  collapsed?: boolean
  onNavigate?: () => void
}

type MenuItem = Required<MenuProps>['items'][number]

function toMenuItems(navItems: NavTreeItem[]): MenuItem[] {
  return navItems.map((item) => {
    const children = item.children ? toMenuItems(item.children) : undefined

    if (item.kind === 'group') {
      return {
        key: item.key,
        label: item.label,
        type: 'group',
        children,
      }
    }

    return {
      key: item.key,
      label: item.label,
      icon: item.icon,
      children,
    }
  })
}

export function Sidebar({
  activeKey,
  collapsed = false,
  navItems,
  onNavigate,
}: SidebarProps) {
  const navigate = useNavigate()
  const defaultOpenKeys = useMemo(
    () => getOpenNavKeys(activeKey, navItems),
    [activeKey, navItems],
  )
  const [manualOpenKeys, setManualOpenKeys] = useState<string[]>([])
  const openKeys = useMemo(
    () => Array.from(new Set([...defaultOpenKeys, ...manualOpenKeys])),
    [defaultOpenKeys, manualOpenKeys],
  )

  const items = useMemo<MenuItem[]>(() => toMenuItems(navItems), [navItems])
  const pathByKey = useMemo(() => getPathByNavKey(navItems), [navItems])

  return (
    <Menu
      mode="inline"
      inlineCollapsed={collapsed}
      items={items}
      openKeys={collapsed ? undefined : openKeys}
      selectedKeys={activeKey ? [activeKey] : []}
      theme="light"
      style={{ height: '100%', borderInlineEnd: 'none' }}
      onOpenChange={setManualOpenKeys}
      onClick={({ key }) => {
        const path = pathByKey.get(key)

        if (path) {
          void navigate(path)
          onNavigate?.()
        }
      }}
    />
  )
}
