import { Spin } from 'antd'
import type { ReactNode } from 'react'

export interface LoadingStateProps {
  /**
   * 有 children 时以遮罩形式包裹内容（内容不卸载、不闪空，用于已有数据后的刷新）；
   * 无 children 时渲染居中占位（用于初次加载，内容还不存在）。
   */
  children?: ReactNode
  tip?: ReactNode
  className?: string
}

/** 统一加载态：初载用占位，有数据后的刷新用遮罩。 */
export function LoadingState({ children, tip, className }: LoadingStateProps) {
  if (children === undefined) {
    const mergedClassName = [
      'flex min-h-40 items-center justify-center',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={mergedClassName}>
        <Spin tip={tip} />
      </div>
    )
  }

  const mergedClassName = ['relative', className].filter(Boolean).join(' ')

  return (
    <div className={mergedClassName}>
      {children}
      <div className="absolute inset-0 flex items-center justify-center bg-(--ant-color-bg-container) opacity-70">
        <Spin tip={tip} />
      </div>
    </div>
  )
}
