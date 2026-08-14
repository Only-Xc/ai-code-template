import type { TFunction } from 'i18next'
import { matchPath } from 'react-router'

import type { AppRouteObject, RouteMeta } from '@/router/routes'

export interface MatchedRouteMeta {
  path: string
  title: string
  meta: RouteMeta
  renderable: boolean
}

function joinPath(parentPath: string, path?: string) {
  if (!path) return parentPath
  if (path === '*') return '*'
  if (path.startsWith('/')) return path

  return `${parentPath.replace(/\/$/, '')}/${path}`.replace(/\/+/g, '/')
}

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  return pathname
}

function isRoutePatternMatch(
  routePath: string,
  pathname: string,
  end: boolean,
) {
  const normalizedRoutePath = normalizePath(routePath)
  const normalizedPathname = normalizePath(pathname)

  if (normalizedRoutePath.includes(':') || normalizedRoutePath.includes('*')) {
    return Boolean(
      matchPath({ path: normalizedRoutePath, end }, normalizedPathname),
    )
  }

  if (end) {
    return normalizedRoutePath === normalizedPathname
  }

  return normalizedPathname.startsWith(`${normalizedRoutePath}/`)
}

export function getRouteMatches(
  routes: AppRouteObject[],
  pathname: string,
  parentPath = '',
): MatchedRouteMeta[] {
  const normalizedPathname = normalizePath(pathname)

  for (const route of routes) {
    const routePath = joinPath(parentPath, route.path)
    const meta = route.handle

    if (routePath === '*' || !meta) continue

    const isExact = isRoutePatternMatch(routePath, normalizedPathname, true)
    const isParent =
      route.children &&
      isRoutePatternMatch(routePath, normalizedPathname, false)
    const isPathlessParent = !route.path && route.children

    if (isExact || isParent || isPathlessParent) {
      const current = meta.title
        ? [
            {
              path: routePath,
              title: meta.title,
              meta,
              renderable: Boolean(route.element),
            },
          ]
        : []

      if (route.children) {
        const childMatches = getRouteMatches(
          route.children,
          pathname,
          routePath,
        )

        if (!isExact && !childMatches.length) continue

        return [...current, ...childMatches]
      }

      return current
    }
  }

  return []
}

export function getCurrentRouteMeta(
  routes: AppRouteObject[],
  pathname: string,
) {
  const matches = getRouteMatches(routes, pathname)

  return matches.at(-1)
}

export function getRouteTitle(meta: RouteMeta, t: TFunction) {
  if (meta.titleKey) {
    const translated = t(meta.titleKey)

    if (translated && translated !== meta.titleKey) return translated
  }

  return meta.title ?? ''
}

export function buildBreadcrumbs(
  routes: AppRouteObject[],
  pathname: string,
  t: TFunction,
) {
  return getRouteMatches(routes, pathname)
    .filter((item) => !item.meta.hideInBreadcrumb)
    .map((item) => ({
      title: getRouteTitle(item.meta, t) || item.title,
      path: item.path,
      clickable: item.renderable,
    }))
}
