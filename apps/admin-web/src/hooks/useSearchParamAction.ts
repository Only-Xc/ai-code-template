import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

/**
 * 当 URL 中出现 `?key=value` 时触发 `onTrigger`，随后用 replace 导航移除该参数。
 * 该参数是一次性消费的：刷新、分享和浏览器后退都不会重新触发动作。`ready` 会
 * 推迟触发，直到调用方的数据（例如已加载的实体）可用。
 *
 * 注意区分三种 URL 参数语义：一次性指令（本 hook）、持续驱动（参数在 =
 * 行为在，留在页面里）、可恢复状态（刷新后要还在，留在 URL 里）。只有第一种
 * 值得抽象。
 */
export function useSearchParamAction(
  key: string,
  value: string,
  onTrigger: () => void,
  ready?: boolean,
): void
/**
 * 动态值形态：`value` 为 `null` 时匹配任意非空值，并把原始参数交给
 * `onTrigger`。只有当回调未返回 `false` 时才消费该参数，因此尚无法解析原始值
 * 的调用方（例如实体还不在已加载列表中）会把深链留在 URL 中，而不是将它吃掉。
 * 当 `ready`、key 或 URL 变化时会重新求值——数据到位后翻转 `ready` 即可重试。
 */
export function useSearchParamAction(
  key: string,
  value: null,
  onTrigger: (raw: string) => boolean | void,
  ready?: boolean,
): void
export function useSearchParamAction(
  key: string,
  value: string | null,
  onTrigger: (raw: string) => boolean | void,
  ready = true,
): void {
  const [searchParams, setSearchParams] = useSearchParams()
  // 只有精确的 `false` 哨兵值会被读取，因此该 ref 类型为
  // `unknown`，而不是回调的 `void | boolean` 联合类型。
  const onTriggerRef = useRef<(raw: string) => unknown>(onTrigger)

  // Latest-ref：把回调排除在触发 effect 的依赖之外，这样调用方
  // 可以传入内联闭包，而不会在每次渲染时重新触发动作。
  useEffect(() => {
    onTriggerRef.current = onTrigger
  }, [onTrigger])

  useEffect(() => {
    if (!ready) return
    const raw = searchParams.get(key)
    if (raw === null || raw === '') return
    if (value !== null && raw !== value) return
    if (onTriggerRef.current(raw) === false) return
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete(key)
        return next
      },
      { replace: true },
    )
  }, [key, ready, searchParams, setSearchParams, value])
}
