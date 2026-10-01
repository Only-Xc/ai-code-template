import type { ComponentType, ReactNode } from 'react'
import { useCallback, useRef, useState } from 'react'

import { showUnexpectedError } from '@/utils/error'

export interface ModalComponentProps<Props, Result> {
  open: boolean
  onOk: (result: Result) => void
  onCancel: () => void
  /** 由 modal 在其离场动画结束后调用（antd `afterOpenChange` 传入 `false`）。 */
  onClosed: () => void
  /** 页面提供的 `init.onSubmit` 运行期间为 true。 */
  submitting: boolean
  init: Props
}

interface ModalState<Props> {
  props: Props
  open: boolean
}

/**
 * hook 侧对页面提供的 submit 的视图：声明了 `onSubmit` 的 init 必须接收该组件
 * 的 `Result`，而未声明 `onSubmit` 的 init 则不得带 Result 打开。
 */
type InitSubmit<Props, Result> = 'onSubmit' extends keyof Props
  ? { onSubmit?: (values: Result) => Promise<void> }
  : { onSubmit?: never }

/** 打开时的 props 加上 `InitSubmit`，从而让 `open` 保持类型检查。 */
type SubmittableInit<Props, Result> = Props & InitSubmit<Props, Result>

/**
 * 带 Promise 接口的命令式 modal。组件仍由调用方以声明式渲染——此 hook 只负责
 * 打开/关闭生命周期与 ok/cancel 的兑现，因此不存在第二个数据源。`render(extra)`
 * 在渲染时合并响应式 props（例如 mutation pending）。
 *
 * `close` 只把 `open` 置为 false，让 modal 在 antd 播放离场动画期间保持其
 * 子树挂载；组件通过 `onClosed` 上报动画结束，只有这时才丢弃该会话。
 *
 * 当打开时的 props 带有 `onSubmit` 时，`onOk(values)` 感知提交：modal 保持
 * 打开，`onSubmit` 运行期间 `submitting` 始终为 true，promise 只在其 resolve
 * 后才兑现。若 reject 则会被上报，modal 保持打开（输入保留，OK 可重试）。
 * 没有 `onSubmit` 时——确认弹窗与自驱动 modal——`onOk` 立即兑现。
 */
export function useModal<Props extends object, Result>(
  Component: ComponentType<ModalComponentProps<Props, Result>>,
) {
  const [state, setState] = useState<ModalState<
    SubmittableInit<Props, Result>
  > | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const settleRef = useRef<((value: Result | null) => void) | null>(null)

  const open = useCallback(
    (props: SubmittableInit<Props, Result>): Promise<Result | null> => {
      // 上一个会话绝不会把其 pending 状态泄漏到新会话。
      setSubmitting(false)
      setState({ props, open: true })
      return new Promise((resolve) => {
        settleRef.current = resolve
      })
    },
    [],
  )

  const close = useCallback((result: Result | null) => {
    const settle = settleRef.current
    settleRef.current = null
    settle?.(result)
    setState((current) => (current ? { ...current, open: false } : current))
  }, [])

  const handleClosed = useCallback(() => {
    // 在离场动画期间重新打开，不得卸载新会话。
    setState((current) => (current && !current.open ? null : current))
  }, [])

  const handleOk = useCallback(
    async (result: Result) => {
      const submit = state?.props.onSubmit
      if (!submit) {
        close(result)
        return
      }
      setSubmitting(true)
      try {
        await submit(result)
        close(result)
      } catch (error) {
        showUnexpectedError(error)
      } finally {
        setSubmitting(false)
      }
    },
    [state, close],
  )

  const render = useCallback(
    (extra?: Record<string, unknown>): ReactNode =>
      state ? (
        <Component
          init={state.props}
          open={state.open}
          submitting={submitting}
          onCancel={() => close(null)}
          onOk={(result) => void handleOk(result)}
          onClosed={handleClosed}
          {...extra}
        />
      ) : null,
    [Component, state, submitting, close, handleOk, handleClosed],
  )

  return { open, close, render }
}
