import { cn } from '@/lib/utils/cn'
import { formatNumber } from '@/lib/utils/formatters'
import { statusFromLimit, STATUS_TEXT, type Status } from '@/lib/utils/colorUtils'
import { MiniTrendChart } from '@/components/charts/MiniTrendChart/MiniTrendChart'
import { POLLUTANTS } from '@/lib/constants/pollutants'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface PollutantCardMeta {
  label: string
  longLabel: string
  unit: string
  color: string
}

interface PollutantCardProps {
  /** Pollutant code (e.g. "CO2") or any metric code like "TEMPERATURE". */
  code: string
  value: number
  /** Regulatory limit for pollutants, or upper bound of normal range for env metrics. */
  limit: number
  /** Optional lower bound (used for env metrics with a normal range). */
  min?: number
  trend?: number[]
  /** Override label/unit/color when `code` isn't a known pollutant. */
  meta?: PollutantCardMeta
  /** Custom label for the bottom-right "Limite" text (defaults to "Limite"). */
  limitLabel?: string
  /** Override the computed status (e.g. for env metrics using a range). */
  status?: Status
  className?: string
  onClick?: () => void
  selected?: boolean
  showEnhanced?: boolean
}

export function PollutantCard({
  code,
  value,
  limit,
  min,
  trend,
  meta: metaOverride,
  limitLabel = 'Limite',
  status: statusOverride,
  className,
  onClick,
  selected,
  showEnhanced = false,
}: PollutantCardProps) {
  const knownMeta = (POLLUTANTS as Record<string, PollutantCardMeta | undefined>)[code]
  const meta: PollutantCardMeta = metaOverride ??
    knownMeta ?? {
      label: String(code ?? '—'),
      longLabel: String(code ?? '—'),
      unit: '',
      color: '#64748B',
    }

  const status: Status = statusOverride ?? statusFromLimit(value, limit)

  // Progress bar: relative position within [min, limit] if min provided,
  // otherwise simple value/limit ratio (regulatory mode).
  const percent = (() => {
    if (min !== undefined && limit > min) {
      const pct = ((value - min) / (limit - min)) * 100
      return Math.max(0, Math.min(100, pct))
    }
    if (limit <= 0) return 0
    return Math.min(100, (value / limit) * 100)
  })()

  // Calculate trend direction
  const trendDirection = (() => {
    if (!trend || trend.length < 2) return null
    const first = trend[0]
    const last = trend[trend.length - 1]
    if (last > first * 1.02) return 'up'
    if (last < first * 0.98) return 'down'
    return 'stable'
  })()

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
        'card w-full p-4 text-left',
        interactive &&
          'transition-smooth cursor-pointer hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected && 'shadow-md ring-2 ring-accent',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: meta.color }}
            />
            <div className="text-base font-semibold text-text-primary">{meta.label}</div>
          </div>
          <div className="mt-0.5 text-[11px] text-text-tertiary">{meta.longLabel}</div>
        </div>
        {trendDirection && (
          <div className="flex items-center gap-1">
            {trendDirection === 'up' && (
              <TrendingUp className="h-4 w-4 text-red-500" aria-label="En hausse" />
            )}
            {trendDirection === 'down' && (
              <TrendingDown className="h-4 w-4 text-green-600" aria-label="En baisse" />
            )}
            {trendDirection === 'stable' && (
              <Minus className="h-4 w-4 text-gray-500" aria-label="Stable" />
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div>
          <div className={cn('text-3xl font-bold', STATUS_TEXT[status])}>
            {formatNumber(value, 1)}
          </div>
          <div className="text-xs text-text-secondary">{meta.unit}</div>
        </div>
        <div className="text-right text-xs">
          <div className="font-medium text-text-secondary">{formatNumber(percent, 0)}%</div>
          <div className="text-[10px] text-text-tertiary">limite</div>
        </div>
      </div>

      <div className="mt-3">
        {trend && trend.length > 1 ? (
          <MiniTrendChart values={trend} color={meta.color} height={48} label={meta.label} />
        ) : (
          <div className="h-[48px] rounded bg-bg" aria-hidden="true" />
        )}
      </div>

      <div className="mt-3">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, percent)}
          aria-label={`Charge vs ${limitLabel.toLowerCase()}: ${formatNumber(percent, 0)} %`}
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
        <div className="mt-1.5 flex justify-between text-[10px] text-text-tertiary">
          <span>{min !== undefined ? formatNumber(min, 0) : '0'}</span>
          <span>
            {limitLabel}: {formatNumber(limit, 0)} {meta.unit}
          </span>
        </div>
      </div>
    </Tag>
  )
}
