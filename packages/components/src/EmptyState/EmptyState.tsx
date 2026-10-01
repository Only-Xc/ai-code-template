import { Empty } from 'antd'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title?: ReactNode
  hint?: ReactNode
  action?: ReactNode
  className?: string
}

/** 统一空状态：标题、可选提示与操作，收口到 components 避免各页面手写。 */
export function EmptyState({
  title,
  hint,
  action,
  className,
}: EmptyStateProps) {
  const mergedClassName = ['m-0!', className].filter(Boolean).join(' ')

  return (
    <Empty
      className={mergedClassName}
      description={
        <div className="flex flex-col gap-1">
          {title ? (
            <p className="m-0 text-sm font-semibold text-(--ant-color-text)">
              {title}
            </p>
          ) : null}
          {hint ? (
            <p className="m-0 text-xs text-(--ant-color-text-secondary)">
              {hint}
            </p>
          ) : null}
        </div>
      }
    >
      {action}
    </Empty>
  )
}
