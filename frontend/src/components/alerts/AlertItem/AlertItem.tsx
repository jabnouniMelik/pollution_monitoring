import type { ReactNode } from 'react'
import { AlertTriangle, Info, Siren } from 'lucide-react'
import { Badge } from '@/components/ui/Badge/Badge'
import { formatNumber, formatRelative } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { Alert } from '@/features/alerts/types/alert.types'

interface AlertItemProps {
  alert: Alert
  actions?: ReactNode
  onClick?: () => void
  className?: string
}

const SEV_META = {
  critical: {
    badge: 'danger' as const,
    icon: Siren,
    label: 'Critique',
    border: 'border-l-danger',
  },
  warning: {
    badge: 'warning' as const,
    icon: AlertTriangle,
    label: 'Alerte',
    border: 'border-l-warning',
  },
  info: {
    badge: 'info' as const,
    icon: Info,
    label: 'Info',
    border: 'border-l-info',
  },
}

export function AlertItem({ alert, actions, onClick, className }: AlertItemProps) {
  const severityKey = (alert.severity ?? 'info') as keyof typeof SEV_META
  const meta = SEV_META[severityKey] ?? SEV_META.info
  const Icon = meta.icon

  return (
    <article
      role="article"
      aria-label={`${meta.label} ${alert.pollutant}: ${alert.message}`}
      onClick={onClick}
      className={cn(
        'card border-l-4 p-3 transition-smooth',
        meta.border,
        onClick && 'cursor-pointer hover:shadow-elevated',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            alert.severity === 'critical' && 'bg-danger-light text-danger',
            alert.severity === 'warning' && 'bg-warning-light text-warning',
            alert.severity === 'info' && 'bg-info-light text-info',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={meta.badge}>{meta.label}</Badge>
            <span className="text-xs font-semibold text-text-primary">{alert.pollutant}</span>
            <span className="text-[10px] text-text-tertiary">• {formatRelative(alert.timestamp)}</span>
            {alert.resolved ? (
              <Badge variant="success" className="ml-auto">
                {alert.resolvedBy ? 'Résolue' : 'Auto-résolue'}
              </Badge>
            ) : alert.acknowledged ? (
              <Badge variant="neutral" className="ml-auto">
                Acquittée
              </Badge>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-text-primary truncate-2">{alert.message}</p>

          <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-secondary">
            <div>
              <dt className="inline">Mesure: </dt>
              <dd className="inline font-semibold text-text-primary">
                {formatNumber(alert.value, 1)}
              </dd>
            </div>
            <div>
              <dt className="inline">Seuil: </dt>
              <dd className="inline font-semibold text-text-primary">
                {formatNumber(alert.threshold, 1)}
              </dd>
            </div>
            {alert.zoneName && (
              <div>
                <dt className="inline">Zone: </dt>
                <dd className="inline font-semibold text-text-primary">{alert.zoneName}</dd>
              </div>
            )}
            {alert.nodeName && (
              <div>
                <dt className="inline">Nœud: </dt>
                <dd className="inline">{alert.nodeName}</dd>
              </div>
            )}
            {alert.sensorId && !alert.nodeName && (
              <div>
                <dt className="inline">Capteur: </dt>
                <dd className="inline">{alert.sensorId}</dd>
              </div>
            )}
          </dl>
        </div>

        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </article>
  )
}
