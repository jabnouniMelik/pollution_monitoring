import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { ChartWrapper } from '@/components/charts/ChartWrapper/ChartWrapper'
import { HistoryChart, type HistorySeries } from '@/components/charts/HistoryChart/HistoryChart'
import { Select, type SelectOption } from '@/components/ui/Select/Select'
import { Card } from '@/components/ui/Card/Card'
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

export default function History() {
  const { period, setPeriod, siteId, zoneId } = useSelectionStore()
  const [pollutant, setPollutant] = useState<PollutantCode>('NOX')

  const readings = useHistoricalReadings({
    siteId: siteId ?? undefined,
    zoneId: zoneId ?? undefined,
    pollutant,
  })

  const series = useMemo<HistorySeries[]>(() => {
    if (!readings.data?.length) return []
    const meta = POLLUTANTS[pollutant]
    return [
      {
        label: meta.label,
        color: meta.color,
        points: readings.data.map((r) => ({ t: r.timestamp, v: r.measurements[pollutant]?.value ?? 0 })),
        threshold: TUNISIA_DECRET_LIMITS[pollutant]?.limit,
      },
    ]
  }, [readings.data, pollutant])

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

      <ChartWrapper
        title={`Concentration ${POLLUTANTS[pollutant].longLabel}`}
        subtitle={`Unité: ${POLLUTANTS[pollutant].unit} · VLE: ${TUNISIA_DECRET_LIMITS[pollutant]?.limit ?? '—'}`}
        height={420}
        loading={readings.isLoading}
      >
        {series.length > 0 ? (
          <HistoryChart series={series} unit={POLLUTANTS[pollutant].unit} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
            Aucune donnée pour la période sélectionnée
          </div>
        )}
      </ChartWrapper>

      <Card>
        <h3 className="text-sm font-semibold">Résumé statistique</h3>
        <p className="mt-0.5 text-xs text-text-secondary">
          Min, max, moyenne et écart-type calculés sur la période.
        </p>
        <Summary values={readings.data?.map((r) => r.measurements[pollutant]?.value ?? 0) ?? []} />
      </Card>
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
