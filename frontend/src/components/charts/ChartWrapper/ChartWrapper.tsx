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
    <section className={cn('card p-4', className)} aria-busy={loading || undefined}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            {title && (
              <h3 className="text-sm font-semibold leading-snug text-text-primary">{title}</h3>
            )}
            {subtitle && <p className="text-xs leading-relaxed text-text-secondary">{subtitle}</p>}
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
