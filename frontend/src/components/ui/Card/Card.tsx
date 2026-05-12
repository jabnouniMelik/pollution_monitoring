import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
  elevated?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padded = true, elevated, className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-card border border-border bg-card',
        elevated ? 'shadow-elevated' : 'shadow-card',
        padded && 'p-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
})

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}

export function CardHeader({ title, subtitle, action, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...props}>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
