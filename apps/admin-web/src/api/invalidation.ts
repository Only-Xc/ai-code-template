import type { QueryClient } from '@tanstack/react-query'

import { dashboardKeys } from './keys'

/**
 * 共享服务端资源的跨页面缓存失效，集中在本文件维护。
 *
 * 各页面通过不同的 key 分支订阅同一资源；一次 mutation 必须让受影响资源的
 * 所有分支失效，否则其他路由会继续返回陈旧数据。mutation 成功路径调用本层，
 * 调用方不自行 invalidateQueries({ queryKey: [...] })。
 *
 * 按前缀失效是刻意为之：覆盖过度只会多触发几次重取。
 */
export function invalidateDashboardData(client: QueryClient): Promise<unknown> {
  return client.invalidateQueries({ queryKey: dashboardKeys.all })
}
