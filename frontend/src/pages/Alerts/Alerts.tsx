import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { AlertFiltersBar } from '@/components/alerts/AlertFilters/AlertFilters'
import { AlertList } from '@/components/alerts/AlertList/AlertList'
import { AlertDetailModal } from '@/components/alerts/AlertDetailModal/AlertDetailModal'
import { Card } from '@/components/ui/Card/Card'
import { Badge } from '@/components/ui/Badge/Badge'
import { Pagination } from '@/components/ui/Pagination/Pagination'
import { useAlerts, useAlertStats } from '@/features/alerts/hooks/useAlerts'
import { useAlertScope } from '@/features/alerts/hooks/useAlertScope'
import type {
  Alert,
  AlertFilters,
  AlertSeverity,
  AlertStatus,
} from '@/features/alerts/types/alert.types'
import { useWebSocketSubscription } from '@/features/websocket/useWebSocketSubscription'
import { useQueryClient } from '@tanstack/react-query'

const ALERT_SEVERITIES: AlertSeverity[] = ['critical', 'warning', 'info']
const ALERT_STATUSES: AlertStatus[] = ['open', 'acknowledged', 'escalated', 'resolved']

function parsePositiveInt(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.floor(n)
}

function isAlertSeverity(v: string | null): v is AlertSeverity {
  return Boolean(v && ALERT_SEVERITIES.includes(v as AlertSeverity))
}

function isAlertStatus(v: string | null): v is AlertStatus {
  return Boolean(v && ALERT_STATUSES.includes(v as AlertStatus))
}

export default function Alerts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const scope = useAlertScope() // role-aware scope filter

  const filters = useMemo<AlertFilters>(() => {
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const pollutant = searchParams.get('pollutant') ?? undefined
    const page = parsePositiveInt(searchParams.get('page'))
    const pageSize = parsePositiveInt(searchParams.get('pageSize')) ?? 20

    return {
      pageSize,
      page,
      pollutant,
      severity: isAlertSeverity(severity) ? severity : undefined,
      status: isAlertStatus(status) ? status : undefined,
      // Merge role-based scope (siteId/zoneId) with URL filters
      ...(scope ?? {}),
    }
  }, [searchParams, scope])

  const setFilters = useCallback(
    (next: AlertFilters) => {
      const nextParams = new URLSearchParams()
      const setIf = (key: string, value: string | number | undefined) => {
        if (value === undefined || value === '') return
        nextParams.set(key, String(value))
      }

      setIf('severity', next.severity)
      setIf('status', next.status)
      setIf('pollutant', next.pollutant)
      setIf('page', next.page)
      if ((next.pageSize ?? 20) !== 20) {
        setIf('pageSize', next.pageSize)
      }

      setSearchParams(nextParams, { replace: true })
    },
    [setSearchParams],
  )

  const alerts = useAlerts(filters, { enabled: scope !== null })
  const stats = useAlertStats({ ...(scope ?? {}) })
  const qc = useQueryClient()

  useWebSocketSubscription(['alerts:all'], () => {
    qc.invalidateQueries({ queryKey: ['alerts'] })
  })

  const items = alerts.data?.items ?? []

  const total = alerts.data?.total ?? 0
  const page = alerts.data?.page ?? 1
  const pageSize = alerts.data?.pageSize ?? 20
  const totalPages = Math.ceil(total / pageSize)

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage })
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setFilters({ ...filters, pageSize: newPageSize, page: 1 })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Alertes"
        subtitle="Gestion centralisée des alertes réglementaires et opérationnelles"
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
        <AlertList alerts={items} isLoading={alerts.isLoading} onSelect={setSelectedAlert} />
      </Card>

      {!alerts.isLoading && total > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          total={total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <AlertDetailModal
        alert={selectedAlert}
        open={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
      />
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
