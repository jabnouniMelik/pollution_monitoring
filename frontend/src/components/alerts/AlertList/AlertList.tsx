import { BellOff } from 'lucide-react'
import { AlertItem } from '../AlertItem/AlertItem'
import { AlertActions } from '../AlertActions/AlertActions'
import { EmptyState } from '@/components/common/EmptyState/EmptyState'
import { SkeletonText } from '@/components/ui/Skeleton/Skeleton'
import type { Alert } from '@/features/alerts/types/alert.types'

interface AlertListProps {
  alerts: Alert[]
  isLoading?: boolean
  showActions?: boolean
  onSelect?: (alert: Alert) => void
}

export function AlertList({ alerts, isLoading, showActions = true, onSelect }: AlertListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-3">
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={<BellOff className="h-8 w-8" />}
        title="Aucune alerte"
        description="Aucune alerte ne correspond aux filtres sélectionnés."
      />
    )
  }

  return (
    <ul className="space-y-2" role="list">
      {alerts.map((a, i) => (
        <li key={a.id || `${a.timestamp}-${a.sensorId ?? 'na'}-${i}`}>
          <AlertItem
            alert={a}
            onClick={onSelect ? () => onSelect(a) : undefined}
            actions={showActions ? <AlertActions alert={a} compact /> : undefined}
          />
        </li>
      ))}
    </ul>
  )
}
