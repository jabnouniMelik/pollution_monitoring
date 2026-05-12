import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { ChartWrapper } from '@/components/charts/ChartWrapper/ChartWrapper'
import { HistoryChart, type HistorySeries } from '@/components/charts/HistoryChart/HistoryChart'
import { Select, type SelectOption } from '@/components/ui/Select/Select'
import { Card } from '@/components/ui/Card/Card'
import { QueryState } from '@/components/common/QueryState/QueryState'
import { HistorySkeleton } from '@/components/ui/Skeleton/SkeletonBlocks'
import { POLLUTANT_CODES, POLLUTANTS, type PollutantCode } from '@/lib/constants/pollutants'
import { TUNISIA_DECRET_LIMITS } from '@/lib/constants/tunisiaDecret'
import { useHistoricalReadings } from '@/features/readings/hooks/useReadings'
import { useSelectionStore } from '@/store/selectionStore'

const PERIOD_OPTIONS: SelectOption[] = [
  { value: 'hour', label: 'Dernière heure' },
  { value: 'day', label: '24 heures' },
  { value: 'week', label: '7 jours' },
  { value: 'month', label: '30 jours' },
  { value: 'year', label: '12 mois' },
]

const POLLUTANT_OPTIONS: SelectOption[] = POLLUTANT_CODES.map((code) => ({
  value: code,
  label: POLLUTANTS[code].label,
}))

function periodToRange(period: string): { from: string; to: string; limit: number } {
  const now = new Date()
  const to = now.toISOString()
  const limits: Record<string, number> = {
    hour: 500,
    day: 500,
    week: 500,
    month: 500,
    year: 500,
  }
  const offsets: Record<string, number> = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  }
  const from = new Date(now.getTime() - (offsets[period] ?? offsets.day)).toISOString()
  return { from, to, limit: limits[period] ?? 500 }
}

export default function History() {
  const { period, setPeriod, siteId, zoneId } = useSelectionStore()
  const [pollutant, setPollutant] = useState<PollutantCode>('NOX')

  const { from, to, limit } = periodToRange(period)

  const readings = useHistoricalReadings({
    siteId: siteId ?? undefined,
    zoneId: zoneId ?? undefined,
    pollutant,
    from,
    to,
    limit,
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Historique des émissions"
        subtitle="Analyse temporelle par polluant"
        actions={
          <div className="flex items-center gap-2">
            <Select
              aria-label="Polluant"
              options={POLLUTANT_OPTIONS}
              value={pollutant}
              onChange={(e) => setPollutant(e.target.value as PollutantCode)}
            />
            <Select
              aria-label="Période"
              options={PERIOD_OPTIONS}
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
            />
          </div>
        }
      />

      <QueryState
        query={readings}
        loadingSkeleton={<HistorySkeleton />}
        emptyTitle="Aucune donnée historique"
        emptyDescription={`Aucune mesure disponible pour ${POLLUTANTS[pollutant].label} sur la période sélectionnée.`}
        errorTitle="Erreur de chargement"
        errorDescription="Impossible de charger les données historiques."
      >
        {(data) => {
          const series: HistorySeries[] = [
            {
              label: POLLUTANTS[pollutant].label,
              color: POLLUTANTS[pollutant].color,
              points: data.map((r) => ({ t: r.timestamp, v: r.measurements[pollutant]?.value ?? 0 })),
              threshold: TUNISIA_DECRET_LIMITS[pollutant]?.limit,
            },
          ]

          return (
            <>
              <ChartWrapper
                title={`Concentration ${POLLUTANTS[pollutant].longLabel}`}
                subtitle={`Unité: ${POLLUTANTS[pollutant].unit} · VLE: ${TUNISIA_DECRET_LIMITS[pollutant]?.limit ?? '—'}`}
                height={420}
              >
                <HistoryChart series={series} unit={POLLUTANTS[pollutant].unit} />
              </ChartWrapper>

              <Card>
                <h3 className="text-sm font-semibold">Résumé statistique</h3>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Min, max, moyenne et écart-type calculés sur la période.
                </p>
                <Summary values={data.map((r) => r.measurements[pollutant]?.value ?? 0)} />
              </Card>
            </>
          )
        }}
      </QueryState>
    </div>
  )
}

function Summary({ values }: { values: number[] }) {
  const stats = useMemo(() => {
    if (values.length === 0) return null
    const n = values.length
    const sum = values.reduce((s, v) => s + v, 0)
    const mean = sum / n
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      mean,
      stddev: Math.sqrt(variance),
      count: n,
    }
  }, [values])

  if (!stats) return <p className="mt-3 text-sm text-text-tertiary">Aucune donnée.</p>

  const cells = [
    { label: 'N', value: stats.count.toLocaleString() },
    { label: 'Min', value: stats.min.toFixed(2) },
    { label: 'Max', value: stats.max.toFixed(2) },
    { label: 'Moyenne', value: stats.mean.toFixed(2) },
    { label: 'Écart-type', value: stats.stddev.toFixed(2) },
  ]
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
      {cells.map((c) => (
        <div key={c.label} className="rounded-md bg-bg px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">{c.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold text-text-primary">{c.value}</dd>
        </div>
      ))}
    </dl>
  )
}
