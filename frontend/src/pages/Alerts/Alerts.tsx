import { useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { AlertFiltersBar } from '@/components/alerts/AlertFilters/AlertFilters'
import { AlertList } from '@/components/alerts/AlertList/AlertList'
import { Card } from '@/components/ui/Card/Card'
import { Button } from '@/components/ui/Button/Button'
import { Badge } from '@/components/ui/Badge/Badge'
import { useAlerts, useAlertStats } from '@/features/alerts/hooks/useAlerts'
import type { AlertFilters } from '@/features/alerts/types/alert.types'
import { useWebSocketSubscription } from '@/features/websocket/useWebSocketSubscription'
import { useQueryClient } from '@tanstack/react-query'

export default function Alerts() {
  const [filters, setFilters] = useState<AlertFilters>({ pageSize: 20 })
  const alerts = useAlerts(filters)
  const stats = useAlertStats()
  const qc = useQueryClient()

  useWebSocketSubscription(['alerts:all'], () => {
    qc.invalidateQueries({ queryKey: ['alerts'] })
  })

  const filtered = useMemo(() => {
    const items = alerts.data?.items ?? []
    if (!filters.search) return items
    const needle = filters.search.toLowerCase()
    return items.filter(
      (a) =>
        a.message.toLowerCase().includes(needle) ||
        a.pollutant.toLowerCase().includes(needle) ||
        (a.sensorId ?? '').toLowerCase().includes(needle),
    )
  }, [alerts.data, filters.search])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Alertes"
        subtitle="Gestion centralisée des alertes réglementaires et opérationnelles"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => alerts.refetch()}
            >
              Actualiser
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>
              Exporter CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.data?.total ?? 0} variant="neutral" />
        <StatCard label="Critiques" value={stats.data?.critical ?? 0} variant="danger" />
        <StatCard label="Alertes" value={stats.data?.warning ?? 0} variant="warning" />
        <StatCard label="Résolues" value={stats.data?.resolved ?? 0} variant="success" />
      </div>

      <Card>
        <div className="mb-3">
          <AlertFiltersBar value={filters} onChange={setFilters} />
        </div>
        <AlertList alerts={filtered} isLoading={alerts.isLoading} />
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: 'danger' | 'warning' | 'success' | 'neutral'
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          {label}
        </div>
        <Badge variant={variant}>{variant}</Badge>
      </div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">{value}</div>
    </div>
  )
}
