import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface ChartWrapperProps {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  height?: number | string
  className?: string
  children: ReactNode
  loading?: boolean
}

export function ChartWrapper({
  title,
  subtitle,
  action,
  height = 260,
  className,
  children,
  loading,
}: ChartWrapperProps) {
  return (
    <section className={cn('card', className)} aria-busy={loading || undefined}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div style={{ height }} className="relative">
        {children}
      </div>
    </section>
  )
}
