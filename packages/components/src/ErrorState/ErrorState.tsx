import { ExclamationCircleOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import type { ReactNode } from 'react'

export interface ErrorStateProps {
  title?: ReactNode
  hint?: ReactNode
  onRetry?: () => void
  retryText?: ReactNode
  className?: string
}

/** 统一错误态：错误可表达、可重试，避免失败后页面空白或无限转圈。 */
export function ErrorState({
  title,
  hint,
  onRetry,
  retryText,
  className,
}: ErrorStateProps) {
  const mergedClassName = [
    'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={mergedClassName}>
      <ExclamationCircleOutlined className="text-2xl text-(--ant-color-error)" />
      {title ? (
        <p className="m-0 text-sm font-semibold text-(--ant-color-text)">
          {title}
        </p>
      ) : null}
      {hint ? (
        <p className="m-0 max-w-sm text-xs text-(--ant-color-text-secondary)">
          {hint}
        </p>
      ) : null}
      {onRetry ? (
        <Button onClick={onRetry}>{retryText ?? 'Retry'}</Button>
      ) : null}
    </div>
  )
}
