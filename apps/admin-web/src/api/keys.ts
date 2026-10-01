/**
 * query key 工厂纪律：
 * - 前缀即失效域：key 从宽到窄 `['域','细分',...参数]`，前缀失效依赖这个层级
 * - 结构只有一个 owner（本工厂）：调用点不 spread 拼接 key
 * - 参数归一化在工厂内做（如 `?? 'none'`），避免 undefined 变成独立缓存槽
 * - key 只放影响结果的参数；纯 UI 状态（排序、tab）不进 key
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: (range: string) => [...dashboardKeys.all, 'stats', range] as const,
  records: (scope: string | null) =>
    [...dashboardKeys.all, 'records', scope ?? 'none'] as const,
}
