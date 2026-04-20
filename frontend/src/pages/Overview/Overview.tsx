import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Gauge, Leaf, Wind, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { KPICard } from '@/components/kpi/KPICard/KPICard'
import { PollutantCard } from '@/components/kpi/PollutantCard/PollutantCard'
import { ChartWrapper } from '@/components/charts/ChartWrapper/ChartWrapper'
import { IPEGauge } from '@/components/charts/IPEGauge/IPEGauge'
import { HistoryChart } from '@/components/charts/HistoryChart/HistoryChart'
import { MTDTrendChart } from '@/components/charts/MTDTrendChart/MTDTrendChart'
import { AlertList } from '@/components/alerts/AlertList/AlertList'
import { Card } from '@/components/ui/Card/Card'
import { Skeleton } from '@/components/ui/Skeleton/Skeleton'
import { useKPIConfig, useKPISummary } from '@/features/kpi/hooks/useKPISummary'
import { useAlerts } from '@/features/alerts/hooks/useAlerts'
import { useLatestReadings } from '@/features/readings/hooks/useReadings'
import { useSelectionStore } from '@/store/selectionStore'
import { getKPIStatus, type KPIKind } from '@/features/kpi/utils/kpiCalculations'
import { KPI_TARGETS } from '@/lib/constants/kpiTargets'
import { POLLUTANTS, POLLUTANT_CODES, type PollutantCode } from '@/lib/constants/pollutants'
import { TUNISIA_DECRET_LIMITS } from '@/lib/constants/tunisiaDecret'
import { useWebSocketSubscription } from '@/features/websocket/useWebSocketSubscription'
import { formatDate, formatNumber } from '@/lib/utils/formatters'

export default function Overview() {
  const { siteId, zoneId, period } = useSelectionStore()
  const queryParams = { siteId: siteId ?? undefined, zoneId: zoneId ?? undefined, period }

  const summary = useKPISummary(queryParams)
  const config = useKPIConfig()
  const alerts = useAlerts({ pageSize: 5, status: 'open' })
  const latest = useLatestReadings(queryParams)

  const [selectedKPI, setSelectedKPI] = useState<KPIKind | null>(null)
  const [selectedPollutant, setSelectedPollutant] = useState<PollutantCode | 'all'>('all')

  const detailRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  const handleKPIClick = useCallback((kind: KPIKind) => {
    setSelectedKPI((prev) => (prev === kind ? null : kind))
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const handlePollutantClick = useCallback((code: PollutantCode) => {
    setSelectedPollutant((prev) => (prev === code ? 'all' : code))
    requestAnimationFrame(() => {
      historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  useWebSocketSubscription([siteId ? `kpi:site:${siteId}` : 'kpi:global', 'alerts:all'])

  const targets = config.data?.targets ?? {
    TD: KPI_TARGETS.TD.target,
    IPE: KPI_TARGETS.IPE.target,
    RCO2: KPI_TARGETS.RCO2.target,
    EMJ: KPI_TARGETS.EMJ.target,
  }

  const tdValue = summary.data?.td ?? 0
  const ipeValue = summary.data?.ipe ?? 0
  const rco2Value = summary.data?.rco2 ?? 0
  const emjTotal = useMemo(() => {
    const vals = Object.values(summary.data?.emj ?? {})
    return vals.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
  }, [summary.data])

  const latestByPollutant = useMemo(() => {
    const map: Record<string, number> = {}
    latest.data?.forEach((r) => {
      const measurements = r?.measurements
      if (!measurements || typeof measurements !== 'object') return
      for (const [code, m] of Object.entries(measurements)) {
        if (m && (!(code in map) || m.value > (map[code] ?? 0))) map[code] = m.value
      }
    })
    return map
  }, [latest.data])

  const history = useMemo(() => {
    if (!latest.data || latest.data.length === 0) return []
    const pollutants: PollutantCode[] = ['CO2', 'NOX', 'SO2', 'PM']
    return pollutants.map((code) => ({
      code,
      label: POLLUTANTS[code].label,
      color: POLLUTANTS[code].color,
      points: latest
        .data!.slice()
        .reverse()
        .map((r) => ({
          t: r.timestamp,
          v: r.measurements[code]?.value ?? 0,
        })),
      threshold: TUNISIA_DECRET_LIMITS[code]?.limit,
    }))
  }, [latest.data])

  const filteredHistory = useMemo(() => {
    if (selectedPollutant === 'all') return history
    const match = history.find((s) => s.code === selectedPollutant)
    if (match) return [match]
    const meta = POLLUTANTS[selectedPollutant]
    if (!meta || !latest.data || latest.data.length === 0) return []
    return [
      {
        code: selectedPollutant,
        label: meta.label,
        color: meta.color,
        points: latest
          .data.slice()
          .reverse()
          .map((r) => ({
            t: r.timestamp,
            v: r.measurements[selectedPollutant]?.value ?? 0,
          })),
        threshold: TUNISIA_DECRET_LIMITS[selectedPollutant]?.limit,
      },
    ]
  }, [history, selectedPollutant, latest.data])

  const mtdLabels = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, '0'))
  const mtdValues = useMemo(() => {
    let cum = 0
    return mtdLabels.map(() => {
      cum += Math.max(0, (summary.data?.emj?.NOX ?? 10) * (0.8 + Math.random() * 0.4))
      return cum
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.data?.emj?.NOX])

  // Per-KPI synthetic monthly trends (deterministic — no random) for the drill-down panel
  const tdDailyValues = useMemo(
    () =>
      mtdLabels.map((_, i) => {
        const wave = 0.6 + 0.4 * Math.sin((i / mtdLabels.length) * Math.PI * 2)
        return Math.max(0, tdValue * wave)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tdValue],
  )
  const rco2DailyValues = useMemo(
    () =>
      mtdLabels.map((_, i) => {
        const wave = 0.5 + 0.5 * Math.cos((i / mtdLabels.length) * Math.PI * 2)
        return rco2Value * wave
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rco2Value],
  )
  const ipeDailyValues = useMemo(
    () =>
      mtdLabels.map((_, i) => {
        const drift = 0.92 + 0.08 * Math.sin((i / mtdLabels.length) * Math.PI)
        return Math.min(100, Math.max(0, ipeValue * drift))
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ipeValue],
  )

  const emjByPollutant = useMemo(
    () =>
      POLLUTANT_CODES.map((c) => ({
        label: POLLUTANTS[c].label,
        color: POLLUTANTS[c].color,
        value: summary.data?.emj?.[c] ?? 0,
      })),
    [summary.data?.emj],
  )

  const ipeContribByPollutant = useMemo(
    () =>
      POLLUTANT_CODES.map((c) => {
        const limit = TUNISIA_DECRET_LIMITS[c]?.limit ?? 100
        const v = latestByPollutant[c] ?? 0
        const ratio = limit > 0 ? Math.min(1, v / limit) : 0
        return {
          label: POLLUTANTS[c].label,
          color: POLLUTANTS[c].color,
          value: Math.max(0, Math.round((1 - ratio) * 100)),
        }
      }),
    [latestByPollutant],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vue d’ensemble"
        subtitle={`Période · ${formatDate(new Date(), 'LLLL yyyy')} — Mise à jour en temps réel`}
      />

      {/* KPI row — compact horizontal */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summary.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[64px]" />)
        ) : (
          <>
            <KPICard
              label="Taux de Dépassement"
              sublabel="TD — mois courant"
              value={tdValue}
              unit="%"
              target={targets.TD}
              type="TD"
              delta={summary.data?.deltas?.td}
              status={getKPIStatus(tdValue, targets.TD, 'TD')}
              onClick={() => handleKPIClick('TD')}
              selected={selectedKPI === 'TD'}
            />
            <KPICard
              label="Indice Performance"
              sublabel="IPE — pondéré"
              value={ipeValue}
              target={targets.IPE}
              type="IPE"
              delta={summary.data?.deltas?.ipe}
              status={getKPIStatus(ipeValue, targets.IPE, 'IPE')}
              onClick={() => handleKPIClick('IPE')}
              selected={selectedKPI === 'IPE'}
            />
            <KPICard
              label="Émission Massique"
              sublabel="EMJ — total jour"
              value={emjTotal}
              unit=" kg/j"
              type="EMJ"
              status={getKPIStatus(emjTotal, targets.EMJ ?? Number.POSITIVE_INFINITY, 'EMJ')}
              onClick={() => handleKPIClick('EMJ')}
              selected={selectedKPI === 'EMJ'}
            />
            <KPICard
              label="Réduction CO₂"
              sublabel="RCO₂ — vs baseline"
              value={rco2Value}
              unit="%"
              target={targets.RCO2}
              type="RCO2"
              delta={summary.data?.deltas?.rco2}
              status={getKPIStatus(rco2Value, targets.RCO2, 'RCO2')}
              onClick={() => handleKPIClick('RCO2')}
              selected={selectedKPI === 'RCO2'}
            />
          </>
        )}
      </div>

      {/* Detail panel — content depends on selected KPI */}
      {selectedKPI && (
        <div ref={detailRef} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {selectedKPI === 'TD' && (
            <>
              <ChartWrapper
                title="Taux de Dépassement (TD)"
                subtitle={`Évolution mensuelle · cible ≤ ${formatNumber(targets.TD, 1)} %`}
                height={240}
                className="lg:col-span-2"
                action={<CloseDetailButton onClose={() => setSelectedKPI(null)} />}
              >
                <MTDTrendChart
                  labels={mtdLabels}
                  values={tdDailyValues}
                  target={targets.TD}
                  unit="%"
                  color="#E65100"
                />
              </ChartWrapper>
              <ChartWrapper
                title="Dépassements par polluant"
                subtitle="Concentration vs limite réglementaire"
                height={240}
                className="lg:col-span-1"
              >
                <MTDTrendChart
                  labels={ipeContribByPollutant.map((p) => p.label)}
                  values={POLLUTANT_CODES.map((c) => {
                    const limit = TUNISIA_DECRET_LIMITS[c]?.limit ?? 0
                    const v = latestByPollutant[c] ?? 0
                    return limit > 0 ? Math.round((v / limit) * 100) : 0
                  })}
                  target={100}
                  unit="%"
                  color="#E65100"
                />
              </ChartWrapper>
            </>
          )}

          {selectedKPI === 'IPE' && (
            <>
              <ChartWrapper
                title="Indice de performance (IPE)"
                subtitle={`Score actuel ${formatNumber(ipeValue, 1)} / 100 · cible ≥ ${formatNumber(
                  targets.IPE,
                  0,
                )}`}
                height={240}
                className="lg:col-span-1"
                action={<CloseDetailButton onClose={() => setSelectedKPI(null)} />}
              >
                <IPEGauge value={ipeValue} target={targets.IPE} />
              </ChartWrapper>
              <ChartWrapper
                title="Évolution mensuelle de l'IPE"
                subtitle="Score composite quotidien"
                height={240}
                className="lg:col-span-2"
              >
                <MTDTrendChart
                  labels={mtdLabels}
                  values={ipeDailyValues}
                  target={targets.IPE}
                  unit="pts"
                  color="#1B5E20"
                />
              </ChartWrapper>
            </>
          )}

          {selectedKPI === 'EMJ' && (
            <>
              <ChartWrapper
                title="Émissions cumulées NOₓ"
                subtitle="Mois à date vs cible réglementaire"
                height={240}
                className="lg:col-span-2"
                action={<CloseDetailButton onClose={() => setSelectedKPI(null)} />}
              >
                <MTDTrendChart
                  labels={mtdLabels}
                  values={mtdValues}
                  target={Number.isFinite(targets.EMJ) ? (targets.EMJ as number) * 30 : undefined}
                  unit="kg"
                  color={POLLUTANTS.NOX.color}
                />
              </ChartWrapper>
              <ChartWrapper
                title="Émissions par polluant (jour)"
                subtitle="Répartition de l'EMJ"
                height={240}
                className="lg:col-span-1"
              >
                <MTDTrendChart
                  labels={emjByPollutant.map((p) => p.label)}
                  values={emjByPollutant.map((p) => p.value)}
                  unit="kg/j"
                  color="#1565C0"
                />
              </ChartWrapper>
            </>
          )}

          {selectedKPI === 'RCO2' && (
            <>
              <ChartWrapper
                title="Réduction CO₂ (RCO₂)"
                subtitle={`Évolution mensuelle vs baseline · cible ≤ ${formatNumber(
                  targets.RCO2,
                  1,
                )} %`}
                height={240}
                className="lg:col-span-2"
                action={<CloseDetailButton onClose={() => setSelectedKPI(null)} />}
              >
                <MTDTrendChart
                  labels={mtdLabels}
                  values={rco2DailyValues}
                  target={targets.RCO2}
                  unit="%"
                  color={POLLUTANTS.PM?.color ?? '#7E57C2'}
                />
              </ChartWrapper>
              <ChartWrapper
                title="Baseline CO₂"
                subtitle="Référence configurée"
                height={240}
                className="lg:col-span-1"
              >
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="text-4xl font-semibold text-text-primary">
                    {config.data?.baseline?.CO2 ?? '—'}
                    <span className="ml-1 text-sm text-text-secondary">ppm</span>
                  </div>
                  <div className="mt-2 text-xs text-text-secondary">
                    Réduction actuelle&nbsp;:&nbsp;
                    <span className="font-semibold text-text-primary">
                      {formatNumber(rco2Value, 1)} %
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-text-tertiary">
                    cible ≤ {formatNumber(targets.RCO2, 1)} %
                  </div>
                </div>
              </ChartWrapper>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {POLLUTANT_CODES.map((code) => (
          <PollutantCard
            key={code}
            code={code}
            value={latestByPollutant[code] ?? 0}
            limit={TUNISIA_DECRET_LIMITS[code]?.limit ?? 100}
            trend={latest.data
              ?.slice(0, 20)
              .map((r) => r.measurements[code]?.value ?? 0)
              .reverse()}
            onClick={() => handlePollutantClick(code)}
            selected={selectedPollutant === code}
          />
        ))}
      </div>

      {/* History + Alerts */}
      <div ref={historyRef} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartWrapper
          title={
            selectedPollutant === 'all'
              ? 'Historique des concentrations'
              : `Historique — ${POLLUTANTS[selectedPollutant].longLabel}`
          }
          subtitle={
            selectedPollutant === 'all'
              ? 'Derniers relevés · tous polluants majeurs'
              : `Derniers relevés · ${POLLUTANTS[selectedPollutant].label} uniquement`
          }
          height={320}
          className="lg:col-span-2"
          loading={latest.isLoading}
          action={
            selectedPollutant !== 'all' ? (
              <button
                type="button"
                onClick={() => setSelectedPollutant('all')}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-accent hover:bg-bg"
                aria-label="Afficher tous les polluants"
              >
                Tout afficher
              </button>
            ) : undefined
          }
        >
          {filteredHistory.length > 0 ? (
            <HistoryChart series={filteredHistory} unit="mg/Nm³" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
              Aucun relevé récent
            </div>
          )}
        </ChartWrapper>

        <Card padded>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Alertes actives</h3>
              <p className="mt-0.5 text-xs text-text-secondary">Ouvertes · priorité descendante</p>
            </div>
            <a
              href="/alerts"
              className="text-xs font-medium text-accent hover:underline"
              aria-label="Voir toutes les alertes"
            >
              Tout voir →
            </a>
          </div>
          <AlertList
            alerts={alerts.data?.items ?? []}
            isLoading={alerts.isLoading}
            showActions={false}
          />
        </Card>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickStat
          icon={<Gauge className="h-4 w-4" />}
          label="Sites actifs"
          value={String(summary.data?.deltas ? 3 : '—')}
        />
        <QuickStat
          icon={<Wind className="h-4 w-4" />}
          label="Débit total"
          value={`${config.data?.airflow ?? '—'} Nm³/s`}
        />
        <QuickStat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Alertes critiques"
          value={String(alerts.data?.items?.filter((a) => a.severity === 'critical').length ?? 0)}
        />
        <QuickStat
          icon={<Leaf className="h-4 w-4" />}
          label="Baseline CO₂"
          value={`${config.data?.baseline?.CO2 ?? '—'} ppm`}
        />
      </div>
    </div>
  )
}

function CloseDetailButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-bg"
      aria-label="Fermer le détail"
    >
      <X className="h-3 w-3" /> Fermer
    </button>
  )
}

function QuickStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-white px-3 py-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--ltblue)] text-accent">
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</div>
        <div className="text-sm font-semibold text-text-primary">{value}</div>
      </div>
    </div>
  )
}
