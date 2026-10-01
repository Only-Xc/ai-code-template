/**
 * 把树按深度优先展平为单个列表。防环：若节点已存在于当前祖先链中则跳过，
 * 因此畸形的层级数据会终止而不会无限递归。
 */
export function flattenTree<T extends { children?: readonly T[] }>(
  items: readonly T[],
): readonly T[] {
  const flattened: T[] = []
  const visit = (level: readonly T[], ancestors: ReadonlySet<unknown>) => {
    for (const item of level) {
      if (ancestors.has(item)) continue
      flattened.push(item)
      if (item.children) visit(item.children, new Set(ancestors).add(item))
    }
  }
  visit(items, new Set())
  return flattened
}
