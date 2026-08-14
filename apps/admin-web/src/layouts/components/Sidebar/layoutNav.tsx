import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'

import type { AppRouteObject, RouteMeta } from '@/router/routes'
import { getRouteTitle } from '@/utils/routeMeta'

export interface NavTreeItem {
  key: string
  label: string
  kind: 'group' | 'submenu' | 'menu'
  path?: string
  icon?: ReactNode
  children?: NavTreeItem[]
}

type NavTreeItemWithOrder = NavTreeItem & {
  order: number
  children?: NavTreeItemWithOrder[]
}

function joinPath(parentPath: string, path?: string) {
  if (!path) return parentPath
  if (path.startsWith('/')) return path

  return `${parentPath.replace(/\/$/, '')}/${path}`.replace(/\/+/g, '/')
}

function getNavKey(meta: RouteMeta, routePath: string) {
  return meta.navKey ?? routePath
}

function getMenuKind(
  meta: RouteMeta,
  hasChildren: boolean,
): NavTreeItem['kind'] {
  if (meta.menuType === 'catalog') {
    return meta.menuMode === 'submenu' ? 'submenu' : 'group'
  }

  if (meta.menuType === 'menu') return 'menu'

  return hasChildren ? 'submenu' : 'menu'
}

function stripOrder(item: NavTreeItemWithOrder): NavTreeItem {
  return {
    key: item.key,
    label: item.label,
    kind: item.kind,
    path: item.path,
    icon: item.icon,
    children: item.children?.map(stripOrder),
  }
}

function collectNavItems(
  routes: AppRouteObject[],
  t: TFunction,
  parentPath = '',
): NavTreeItemWithOrder[] {
  const items: NavTreeItemWithOrder[] = []
  let sortableItems: NavTreeItemWithOrder[] = []

  function flushSortableItems() {
    if (!sortableItems.length) return

    items.push(...sortableItems.sort((left, right) => left.order - right.order))
    sortableItems = []
  }

  for (const route of routes) {
    const routePath = joinPath(parentPath, route.path)
    const meta = route.handle
    const children = route.children
      ? collectNavItems(route.children, t, routePath)
      : []

    if (!meta?.title || meta.hideInMenu) {
      if (children.length) {
        flushSortableItems()
        items.push(...children)
      }

      continue
    }

    const kind = getMenuKind(meta, children.length > 0)
    const path = kind === 'menu' ? routePath : undefined

    sortableItems.push({
      key: getNavKey(meta, routePath),
      label: getRouteTitle(meta, t),
      kind,
      path,
      icon: meta.icon,
      order: meta.navOrder ?? 0,
      children: children.length ? children : undefined,
    })
  }

  flushSortableItems()

  return items
}

export function buildNavItems(
  routes: AppRouteObject[],
  t: TFunction,
): NavTreeItem[] {
  return collectNavItems(routes, t).map(stripOrder)
}

export function getPathByNavKey(navItems: NavTreeItem[]) {
  const pathByKey = new Map<string, string>()

  function collect(items: NavTreeItem[]) {
    for (const item of items) {
      if (item.path) pathByKey.set(item.key, item.path)
      if (item.children) collect(item.children)
    }
  }

  collect(navItems)

  return pathByKey
}

export function getActiveNavKey(pathname: string, navItems: NavTreeItem[]) {
  const pathEntries = Array.from(getPathByNavKey(navItems).entries())
  const exactMatch = pathEntries.find(([, path]) => path === pathname)

  if (exactMatch) return exactMatch[0]

  return (
    pathEntries
      .filter(([, path]) => pathname.startsWith(`${path}/`))
      .sort((left, right) => right[1].length - left[1].length)
      .at(0)?.[0] ?? ''
  )
}

export function getOpenNavKeys(activeKey: string, navItems: NavTreeItem[]) {
  const parents: string[] = []

  function findParents(items: NavTreeItem[], ancestors: string[]): boolean {
    for (const item of items) {
      if (item.key === activeKey) {
        parents.push(...ancestors)
        return true
      }

      if (
        item.children &&
        findParents(item.children, [...ancestors, item.key])
      ) {
        return true
      }
    }

    return false
  }

  findParents(navItems, [])

  return parents
}
