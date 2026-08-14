import type { ComponentPropsWithoutRef } from 'react'

export type PageContainerProps = ComponentPropsWithoutRef<'div'> & {
  bordered?: boolean
}

export function PageContainer({
  bordered = true,
  className,
  ...rest
}: PageContainerProps) {
  const mergedClassName = [
    'bg-(--ant-color-bg-container) rounded-xl',
    bordered && 'border border-(--ant-color-border-secondary)',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={mergedClassName} {...rest} />
}
