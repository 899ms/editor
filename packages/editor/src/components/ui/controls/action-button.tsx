'use client'

import { resolveBuiltInNodeUiText, usePascalTranslation } from '@pascal-app/i18n'
import { cn } from '../../../lib/utils'

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  label: string
}

export function ActionButton({ icon, label, className, ...props }: ActionButtonProps) {
  const { t } = usePascalTranslation('nodes')
  const localizedLabel = resolveBuiltInNodeUiText(label, t)
  const localizedProps = {
    ...props,
    'aria-label':
      typeof props['aria-label'] === 'string'
        ? resolveBuiltInNodeUiText(props['aria-label'], t)
        : props['aria-label'],
    title:
      typeof props.title === 'string' ? resolveBuiltInNodeUiText(props.title, t) : props.title,
  }
  return (
    <button
      {...localizedProps}
      className={cn(
        'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-[#2C2C2E] px-3 font-medium text-foreground text-xs transition-colors hover:bg-[#3e3e3e] active:bg-[#3e3e3e]',
        className,
      )}
    >
      {icon}
      <span>{localizedLabel}</span>
    </button>
  )
}

export function ActionGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('flex gap-1.5', className)}>{children}</div>
}
