import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatNumber, formatSignedDelta } from '@/lib/utils/formatters'
import type { KPIKind, KPIStatus } from '@/features/kpi/utils/kpiCalculations'

interface KPICardProps {
  label: string
  sublabel?: string
  value: number
  unit?: string
  target?: number
  type: KPIKind
  delta?: number
  status: KPIStatus
  className?: string
  previousLabel?: string
  onClick?: () => void
  selected?: boolean
}

const STATUS_TEXT: Record<KPIStatus, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

const BORDER: Record<KPIKind, string> = {
  TD: 'border-l-warning',
  IPE: 'border-l-success',
  EMJ: 'border-l-info',
  RCO2: 'border-l-pollutant-pm',
}

export function KPICard({
  label,
  sublabel,
  value,
  unit,
  target,
  type,
  delta,
  status,
  className,
  previousLabel = 'mois préc.',
  onClick,
  selected,
}: KPICardProps) {
  const statusColor = STATUS_TEXT[status]

  const DeltaIcon = delta === undefined || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown

  const formattedValue =
    type === 'IPE' ? (
      <>
        {formatNumber(value, 1)}
        <span className="ml-0.5 text-[10px] text-text-secondary">/100</span>
      </>
    ) : (
      <>
        {formatNumber(value, 1)}
        {unit && <span className="ml-0.5 text-[10px] text-text-secondary">{unit}</span>}
      </>
    )

  const comparator = type === 'IPE' ? '≥' : '≤'

  const interactive = typeof onClick === 'function'
  const Tag = interactive ? 'button' : 'article'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      role={interactive ? 'button' : 'group'}
      aria-label={`${label}: ${formatNumber(value, 1)}${unit ?? ''}`}
      aria-pressed={interactive ? !!selected : undefined}
      onClick={onClick}
      className={cn(
        'card border-l-4 px-3 py-2 text-left w-full',
        BORDER[type],
        interactive && 'cursor-pointer transition-smooth hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected && 'ring-2 ring-accent shadow-md',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            {label}
          </div>
          {sublabel && (
            <div className="mt-0.5 truncate text-[10px] text-text-tertiary">{sublabel}</div>
          )}
        </div>
        <div className={cn('shrink-0 text-xl font-semibold leading-none', statusColor)}>
          {formattedValue}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
        {delta !== undefined && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', statusColor)}>
            <DeltaIcon className="h-3 w-3" aria-hidden="true" />
            {formatSignedDelta(delta, 1, unit ?? '%')} {previousLabel}
          </span>
        )}
        {target !== undefined && Number.isFinite(target) && (
          <span className="text-text-secondary">
            cible {comparator} {formatNumber(target, 1)}
            {unit ?? ''}
            {status === 'success' && <span className="ml-1 text-success">✓</span>}
          </span>
        )}
      </div>
    </Tag>
  )
}
