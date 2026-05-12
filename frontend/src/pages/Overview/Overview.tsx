import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Eye, EyeOff, Gauge, Leaf, Wind, X } from 'lucide-react'
import { HistoryChartSettings } from './HistoryChartSettings'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { KPICard } from '@/components/kpi/KPICard/KPICard'
import { PollutantCard } from '@/components/kpi/PollutantCard/PollutantCard'
import { ChartWrapper } from '@/components/charts/ChartWrapper/ChartWrapper'
import { IPEGauge } from '@/components/charts/IPEGauge/IPEGauge'
import { HistoryChart } from '@/components/charts/HistoryChart/HistoryChart'
import { MTDTrendChart } from '@/components/charts/MTDTrendChart/MTDTrendChart'
import { ENVIRONMENT_PARAMS, type EnvParamCode } from '@/lib/constants/environment'
import { statusFromRange } from '@/lib/utils/colorUtils'
import { AlertList } from '@/components/alerts/AlertList/AlertList'
import { Card } from '@/components/ui/Card/Card'
import { Skeleton } from '@/components/ui/Skeleton/Skeleton'
import { useKPIConfig, useKPIHistory, useKPISummary } from '@/features/kpi/hooks/useKPISummary'
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
  const noxMtdHistory = useKPIHistory('NOX', {
    siteId: siteId ?? undefined,
    zoneId: zoneId ?? undefined,
    period: 'day',
  })
  const alerts = useAlerts({ pageSize: 5, status: 'open' })
  const latest = useLatestReadings(queryParams)

  type MetricSelection = PollutantCode | EnvParamCode | 'all'

  const [selectedKPI, setSelectedKPI] = useState<KPIKind | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<MetricSelection>('all')
  const [visiblePollutants, setVisiblePollutants] = useState<Set<PollutantCode>>(
    () => new Set(POLLUTANT_CODES),
  )
  const [visibleEnv, setVisibleEnv] = useState<Set<EnvParamCode>>(
    () => new Set(['TEMPERATURE', 'HUMIDITY'] as EnvParamCode[]),
  )
  const [historyHidden, setHistoryHidden] = useState(false)

  const detailRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  const togglePollutantVisibility = useCallback((code: PollutantCode) => {
    setVisiblePollutants((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }, [])

  const toggleEnvVisibility = useCallback((code: EnvParamCode) => {
    setVisibleEnv((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }, [])

  const selectAllMetrics = useCallback(() => {
    setVisiblePollutants(new Set(POLLUTANT_CODES))
    setVisibleEnv(new Set(['TEMPERATURE', 'HUMIDITY'] as EnvParamCode[]))
  }, [])

  const resetMetrics = useCallback(() => {
    setVisiblePollutants(new Set(POLLUTANT_CODES))
    setVisibleEnv(new Set(['TEMPERATURE', 'HUMIDITY'] as EnvParamCode[]))
    setSelectedMetric('all')
  }, [])

  const handleKPIClick = useCallback((kind: KPIKind) => {
    setSelectedKPI((prev) => (prev === kind ? null : kind))
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const handleMetricClick = useCallback((code: PollutantCode | EnvParamCode) => {
    setSelectedMetric((prev) => (prev === code ? 'all' : code))
    requestAnimationFrame(() => {
      historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const isEnvCode = (c: string): c is EnvParamCode => c === 'TEMPERATURE' || c === 'HUMIDITY'

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
    const inVisible = (c: string) => visiblePollutants.has(c as PollutantCode)
    if (selectedMetric === 'all' || isEnvCode(selectedMetric)) {
      return history.filter((s) => inVisible(s.code))
    }
    const pollutantCode = selectedMetric as PollutantCode
    if (!visiblePollutants.has(pollutantCode)) return []
    const match = history.find((s) => s.code === pollutantCode)
    if (match) return [match]
    const meta = POLLUTANTS[pollutantCode]
    if (!meta || !latest.data || latest.data.length === 0) return []
    return [
      {
        code: pollutantCode,
        label: meta.label,
        color: meta.color,
        points: latest.data
          .slice()
          .reverse()
          .map((r) => ({
            t: r.timestamp,
            v: r.measurements[pollutantCode]?.value ?? 0,
          })),
        threshold: TUNISIA_DECRET_LIMITS[pollutantCode]?.limit,
      },
    ]
  }, [history, selectedMetric, latest.data, visiblePollutants])

  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

  const mtdLabels = useMemo(
    () => Array.from({ length: daysInCurrentMonth }, (_, i) => String(i + 1).padStart(2, '0')),
    [daysInCurrentMonth],
  )

  const mtdValues = useMemo(() => {
    const dailyValues = new Array<number>(daysInCurrentMonth).fill(0)

    for (const point of noxMtdHistory.data?.points ?? []) {
      const d = new Date(point.timestamp)
      if (Number.isNaN(d.getTime())) continue
      if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) continue

      const dayIndex = d.getDate() - 1
      if (dayIndex < 0 || dayIndex >= dailyValues.length) continue
      dailyValues[dayIndex] += Math.max(0, Number(point.value) || 0)
    }

    let cumulative = 0
    return dailyValues.map((v) => {
      cumulative += v
      return Number(cumulative.toFixed(2))
    })
  }, [daysInCurrentMonth, noxMtdHistory.data?.points, currentMonth, currentYear])

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

  const envSeries = useMemo(() => {
    if (!latest.data || latest.data.length === 0) return []
    return latest.data
      .slice()
      .reverse()
      .map((r) => {
        const m = r?.measurements ?? {}
        const rawTemp =
          (m.TEMPERATURE as { value?: number } | undefined)?.value ??
          (m.TEMP as { value?: number } | undefined)?.value ??
          (m.temperature as { value?: number } | undefined)?.value
        const rawHum =
          (m.HUMIDITY as { value?: number } | undefined)?.value ??
          (m.HUM as { value?: number } | undefined)?.value ??
          (m.humidity as { value?: number } | undefined)?.value
        return {
          t: r.timestamp,
          temperature: Number.isFinite(rawTemp) ? (rawTemp as number) : undefined,
          humidity: Number.isFinite(rawHum) ? (rawHum as number) : undefined,
        }
      })
  }, [latest.data])

  const latestEnv = useMemo(() => {
    const last = envSeries[envSeries.length - 1]
    return {
      temperature: last?.temperature,
      humidity: last?.humidity,
    }
  }, [envSeries])

  const envHasData = envSeries.some((p) => p.temperature !== undefined || p.humidity !== undefined)

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
                loading={noxMtdHistory.isLoading}
                action={<CloseDetailButton onClose={() => setSelectedKPI(null)} />}
              >
                <MTDTrendChart
                  labels={mtdLabels}
                  values={mtdValues}
                  target={
                    Number.isFinite(targets.EMJ)
                      ? (targets.EMJ as number) * daysInCurrentMonth
                      : undefined
                  }
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
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
            onClick={() => handleMetricClick(code)}
            selected={selectedMetric === code}
          />
        ))}

        {/* Environmental parameters — same card, range-based status */}
        {(Object.keys(ENVIRONMENT_PARAMS) as EnvParamCode[]).map((code) => {
          const param = ENVIRONMENT_PARAMS[code]
          const value = latestEnv[code === 'TEMPERATURE' ? 'temperature' : 'humidity'] ?? 0
          const trend = envSeries
            .slice(-20)
            .map((p) => (code === 'TEMPERATURE' ? (p.temperature ?? 0) : (p.humidity ?? 0)))
          return (
            <PollutantCard
              key={code}
              code={code}
              value={value}
              min={param.normalRange[0]}
              limit={param.normalRange[1]}
              limitLabel="Plage normale"
              status={statusFromRange(value, param.normalRange)}
              trend={trend.length > 1 ? trend : undefined}
              meta={{
                label: param.label,
                longLabel: param.longLabel,
                unit: param.unit,
                color: param.color,
              }}
              onClick={() => handleMetricClick(code)}
              selected={selectedMetric === code}
            />
          )
        })}
      </div>

      {/* History + Alerts */}
      <div ref={historyRef} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {historyHidden ? (
          <button
            type="button"
            onClick={() => setHistoryHidden(false)}
            className="card flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-bg lg:col-span-2"
            aria-label="Afficher le panneau Historique"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--ltblue)] text-accent">
                <Eye className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-text-primary">
                  Historique des concentrations
                </div>
                <div className="text-xs text-text-secondary">
                  Panneau masqué · cliquer pour réafficher
                </div>
              </div>
            </div>
            <span className="text-[11px] font-medium text-accent">Afficher</span>
          </button>
        ) : (
          <ChartWrapper
            title={
              selectedMetric === 'all'
                ? 'Historique des concentrations & conditions'
                : isEnvCode(selectedMetric)
                  ? `Historique — polluants × ${ENVIRONMENT_PARAMS[selectedMetric].longLabel}`
                  : `Historique — ${POLLUTANTS[selectedMetric as PollutantCode].longLabel}`
            }
            subtitle={
              selectedMetric === 'all'
                ? 'Polluants · température · humidité · axes multiples'
                : isEnvCode(selectedMetric)
                  ? `Corrélation entre les polluants et ${ENVIRONMENT_PARAMS[selectedMetric].label.toLowerCase()}`
                  : `Derniers relevés · ${POLLUTANTS[selectedMetric as PollutantCode].label} vs conditions environnementales`
            }
            height={320}
            className="lg:col-span-2"
            loading={latest.isLoading}
            action={
              <div className="flex items-center gap-1.5">
                {selectedMetric !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedMetric('all')}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-accent hover:bg-bg"
                    aria-label="Afficher tous les indicateurs"
                  >
                    Tout afficher
                  </button>
                )}
                <HistoryChartSettings
                  visiblePollutants={visiblePollutants}
                  visibleEnv={visibleEnv}
                  onTogglePollutant={togglePollutantVisibility}
                  onToggleEnv={toggleEnvVisibility}
                  onSelectAll={selectAllMetrics}
                  onReset={resetMetrics}
                />
                <button
                  type="button"
                  onClick={() => setHistoryHidden(true)}
                  className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-bg hover:text-text-primary"
                  aria-label="Masquer le panneau Historique"
                  title="Masquer"
                >
                  <EyeOff className="h-3 w-3" />
                </button>
              </div>
            }
          >
            {filteredHistory.length > 0 ||
            (envHasData && (visibleEnv.has('TEMPERATURE') || visibleEnv.has('HUMIDITY'))) ? (
              <HistoryChart
                series={filteredHistory}
                unit="mg/Nm³"
                envPoints={envHasData ? envSeries : undefined}
                showTemperature={
                  envHasData &&
                  visibleEnv.has('TEMPERATURE') &&
                  (selectedMetric === 'all' ||
                    !isEnvCode(selectedMetric) ||
                    selectedMetric === 'TEMPERATURE')
                }
                showHumidity={
                  envHasData &&
                  visibleEnv.has('HUMIDITY') &&
                  (selectedMetric === 'all' ||
                    !isEnvCode(selectedMetric) ||
                    selectedMetric === 'HUMIDITY')
                }
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-text-tertiary">
                <span>Aucune série sélectionnée</span>
                <button
                  type="button"
                  onClick={selectAllMetrics}
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-accent hover:bg-bg"
                >
                  Tout réafficher
                </button>
              </div>
            )}
          </ChartWrapper>
        )}

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
