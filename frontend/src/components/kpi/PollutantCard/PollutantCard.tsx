import { cn } from '@/lib/utils/cn'
import { formatNumber } from '@/lib/utils/formatters'
import { statusFromLimit, STATUS_TEXT } from '@/lib/utils/colorUtils'
import { MiniTrendChart } from '@/components/charts/MiniTrendChart/MiniTrendChart'
import { POLLUTANTS, type PollutantCode } from '@/lib/constants/pollutants'

interface PollutantCardProps {
  code: PollutantCode
  value: number
  limit: number
  trend?: number[]
  className?: string
  onClick?: () => void
  selected?: boolean
}

export function PollutantCard({
  code,
  value,
  limit,
  trend,
  className,
  onClick,
  selected,
}: PollutantCardProps) {
  const meta =
    POLLUTANTS[code] ??
    ({
      code,
      label: String(code ?? '—'),
      longLabel: String(code ?? '—'),
      unit: 'mg/Nm³',
      color: '#64748B',
      tailwindColor: 'text-text-secondary',
    } as (typeof POLLUTANTS)[PollutantCode])
  const status = statusFromLimit(value, limit)
  const percent = limit > 0 ? (value / limit) * 100 : 0

  const interactive = typeof onClick === 'function'
  const Tag = interactive ? 'button' : 'article'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      role={interactive ? 'button' : 'group'}
      aria-label={`${meta.longLabel}: ${formatNumber(value, 1)} ${meta.unit}`}
      aria-pressed={interactive ? !!selected : undefined}
      onClick={onClick}
      className={cn(
        'card p-3 text-left w-full',
        interactive && 'cursor-pointer transition-smooth hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected && 'ring-2 ring-accent shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: meta.color }}
            />
            <div className="text-sm font-semibold text-text-primary">{meta.label}</div>
          </div>
          <div className="mt-0.5 text-[10px] text-text-tertiary">{meta.longLabel}</div>
        </div>
        <div className="text-right">
          <div className={cn('text-xl font-semibold', STATUS_TEXT[status])}>
            {formatNumber(value, 1)}
          </div>
          <div className="text-[10px] text-text-secondary">{meta.unit}</div>
        </div>
      </div>

      <div className="mt-2">
        {trend && trend.length > 1 ? (
          <MiniTrendChart values={trend} color={meta.color} height={36} label={meta.label} />
        ) : (
          <div className="h-[36px] rounded bg-bg" aria-hidden="true" />
        )}
      </div>

      <div className="mt-2">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, percent)}
          aria-label={`Charge vs limite: ${formatNumber(percent, 0)} %`}
        >
          <div
            className="transition-smooth h-full rounded-full"
            style={{
              width: `${Math.min(100, percent)}%`,
              backgroundColor:
                status === 'danger' ? '#B71C1C' : status === 'warning' ? '#E65100' : '#1B5E20',
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-text-tertiary">
          <span>0</span>
          <span>
            Limite: {formatNumber(limit, 0)} {meta.unit}
          </span>
        </div>
      </div>
    </Tag>
  )
}
