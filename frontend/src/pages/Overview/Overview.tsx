import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueries } from '@tanstack/react-query'
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
import { queryKeys } from '@/lib/api/queryClient'
import { kpiApi } from '@/features/kpi/api/kpiApi'
import {
  averageMtdSeries,
  buildMtdDailyValues,
  buildMtdLabels,
  lookupPollutantMetric,
  mtdActiveDayCount,
  truncateMtdSeries,
} from '@/features/kpi/utils/mtdSeries'
import { formatKpiTarget } from '@/features/kpi/utils/kpiFormatters'
import { calculateRCO2GoalAttainment } from '@/features/kpi/utils/kpiCalculations'
import { useSites } from '@/features/sites/hooks/useSites'
import { useAlerts } from '@/features/alerts/hooks/useAlerts'
import { useLatestReadings } from '@/features/readings/hooks/useReadings'
import { useSelectionStore } from '@/store/selectionStore'
import { getKPIStatus, type KPIKind } from '@/features/kpi/utils/kpiCalculations'
import { KPI_TARGETS } from '@/lib/constants/kpiTargets'
import { POLLUTANTS, POLLUTANT_CODES, type PollutantCode } from '@/lib/constants/pollutants'
import { TUNISIA_DECRET_LIMITS } from '@/lib/constants/tunisiaDecret'
import { useWebSocketSubscription } from '@/features/websocket/useWebSocketSubscription'
import { formatDate, formatNumber } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

export default function Overview() {
  const { siteId, zoneId, sensorNodeId, period } = useSelectionStore()
  const queryParams = {
    siteId: siteId ?? undefined,
    zoneId: zoneId ?? undefined,
    sensorNodeId: sensorNodeId ?? undefined,
    period,
  }

  const summary = useKPISummary(queryParams)
  const config = useKPIConfig()
  const [selectedKPI, setSelectedKPI] = useState<KPIKind | null>(null)
  const [selectedEmjPollutant, setSelectedEmjPollutant] = useState<PollutantCode>('NOX')
  const emjHistory = useKPIHistory(selectedEmjPollutant, {
    siteId: siteId ?? undefined,
    zoneId: zoneId ?? undefined,
    sensorNodeId: sensorNodeId ?? undefined,
    period: 'day',
    metric: 'emissionKgDay',
  })
  const rco2MonthlyHistory = useKPIHistory('CO2', {
    siteId: siteId ?? undefined,
    zoneId: zoneId ?? undefined,
    sensorNodeId: sensorNodeId ?? undefined,
    period: 'month',
    metric: 'reductionPct',
  })
  const ipeHistory = useKPIHistory('global', {
    siteId: siteId ?? undefined,
    zoneId: zoneId ?? undefined,
    sensorNodeId: sensorNodeId ?? undefined,
    period: 'day',
    metric: 'overallScore',
  })
  const tdHistories = useQueries({
    queries: POLLUTANT_CODES.map((code) => ({
      queryKey: queryKeys.kpi.history(code, {
        ...queryParams,
        period: 'day',
        metric: 'tauxDepassement',
      }),
      queryFn: () =>
        kpiApi.history(code, {
          siteId: siteId ?? undefined,
          zoneId: zoneId ?? undefined,
          sensorNodeId: sensorNodeId ?? undefined,
          period: 'day',
          metric: 'tauxDepassement',
        }),
      enabled: Boolean(siteId) && selectedKPI === 'TD',
      staleTime: 30_000,
    })),
  })
  const sites = useSites({ pageSize: 100 })
  const alerts = useAlerts({ pageSize: 5, status: 'open' })
  const latest = useLatestReadings(queryParams)

  type MetricSelection = PollutantCode | EnvParamCode | 'all'

  const [selectedMetric, setSelectedMetric] = useState<MetricSelection>('all')
  const [visiblePollutants, setVisiblePollutants] = useState<Set<PollutantCode>>(
    () => new Set(POLLUTANT_CODES),
  )
  const [visibleEnv, setVisibleEnv] = useState<Set<EnvParamCode>>(
    () => new Set(['TEMPERATURE', 'HUMIDITY'] as EnvParamCode[]),
  )
  const [historyHidden, setHistoryHidden] = useState(true)

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

  const showAllPollutants = useCallback(() => {
    setSelectedMetric('all')
    setVisiblePollutants(new Set(POLLUTANT_CODES))
    setVisibleEnv(new Set(['TEMPERATURE', 'HUMIDITY'] as EnvParamCode[]))
  }, [])

  const focusPollutant = useCallback(
    (code: PollutantCode | EnvParamCode) => {
      if (selectedMetric === code) {
        showAllPollutants()
        return
      }

      setSelectedMetric(code)
      if (isEnvCode(code)) {
        setVisibleEnv(new Set([code]))
        setVisiblePollutants(new Set())
      } else {
        setVisiblePollutants(new Set([code]))
        setVisibleEnv(new Set())
      }

      setHistoryHidden(false)
      requestAnimationFrame(() => {
        historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },
    [selectedMetric, showAllPollutants],
  )

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

  const handleMetricClick = useCallback(
    (code: PollutantCode | EnvParamCode) => {
      focusPollutant(code)
    },
    [focusPollutant],
  )

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
  const emjTotal = useMemo(
    () =>
      POLLUTANT_CODES.reduce(
        (s, code) => s + lookupPollutantMetric(summary.data?.emj, code),
        0,
      ),
    [summary.data?.emj],
  )

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
    const pollutants: PollutantCode[] = ['CO2', 'NOX', 'SO2', 'PM25', 'PM10']
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
  const mtdActiveDays = mtdActiveDayCount(currentYear, currentMonth, currentDate)

  const mtdLabels = useMemo(
    () => buildMtdLabels(daysInCurrentMonth, mtdActiveDays),
    [daysInCurrentMonth, mtdActiveDays],
  )

  const mtdEmjDaily = useMemo(
    () =>
      truncateMtdSeries(
        buildMtdDailyValues(
          emjHistory.data?.points ?? [],
          daysInCurrentMonth,
          currentYear,
          currentMonth,
        ),
        mtdActiveDays,
      ),
    [daysInCurrentMonth, emjHistory.data?.points, currentMonth, currentYear, mtdActiveDays],
  )

  const tdDailyValues = useMemo(() => {
    const series = tdHistories
      .map((q) =>
        truncateMtdSeries(
          buildMtdDailyValues(
            q.data?.points ?? [],
            daysInCurrentMonth,
            currentYear,
            currentMonth,
          ),
          mtdActiveDays,
        ),
      )
      .filter((s) => s.length > 0)
    if (series.length === 0) {
      return mtdLabels.map(() => tdValue)
    }
    return averageMtdSeries(series)
  }, [tdHistories, daysInCurrentMonth, currentYear, currentMonth, mtdLabels, tdValue, mtdActiveDays])

  const rco2MonthlyChart = useMemo(() => {
    const points = rco2MonthlyHistory.data?.points ?? []
    if (points.length > 0) {
      return {
        labels: points.map((p) => formatDate(p.timestamp, 'MMM yy')),
        values: points.map((p) => p.value),
      }
    }
    if (Number.isFinite(rco2Value)) {
      return {
        labels: [formatDate(new Date(), 'MMM yy')],
        values: [rco2Value],
      }
    }
    return { labels: [], values: [] }
  }, [rco2MonthlyHistory.data?.points, rco2Value])

  const ipeDailyValues = useMemo(() => {
    const fromHistory = truncateMtdSeries(
      buildMtdDailyValues(
        ipeHistory.data?.points ?? [],
        daysInCurrentMonth,
        currentYear,
        currentMonth,
      ),
      mtdActiveDays,
    )
    if (fromHistory.some((v) => v > 0)) return fromHistory
    if (Number.isFinite(ipeValue) && mtdActiveDays > 0) {
      return mtdLabels.map((_, i) => (i === mtdActiveDays - 1 ? ipeValue : 0))
    }
    return fromHistory
  }, [
    daysInCurrentMonth,
    ipeHistory.data?.points,
    currentMonth,
    currentYear,
    mtdActiveDays,
    mtdLabels,
    ipeValue,
  ])

  const emjByPollutant = useMemo(
    () =>
      POLLUTANT_CODES.map((c) => ({
        label: POLLUTANTS[c].label,
        color: POLLUTANTS[c].color,
        value: lookupPollutantMetric(summary.data?.emj, c),
      })),
    [summary.data?.emj],
  )

  const tdByPollutant = useMemo(
    () =>
      POLLUTANT_CODES.map((c) => ({
        label: POLLUTANTS[c].label,
        color: POLLUTANTS[c].color,
        value: summary.data?.tdByPollutant?.[c] ?? 0,
      })),
    [summary.data?.tdByPollutant],
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

  const activeSitesCount = useMemo(() => {
    const items = sites.data?.items ?? (sites.data as { data?: unknown[] })?.data ?? []
    if (Array.isArray(items)) {
      return items.filter((s) => (s as { status?: string }).status !== 'inactive').length
    }
    return null
  }, [sites.data])

  const hasTdTrend = tdDailyValues.length > 0
  const hasEmjTrend =
    (emjHistory.data?.points?.length ?? 0) > 0 ||
    emjByPollutant.some((p) => p.value > 0)
  const hasRco2Trend =
    (rco2MonthlyHistory.data?.points?.length ?? 0) > 0 || rco2Value !== 0
  const rco2Detail = summary.data?.rco2Detail
  const rco2CurrentAvg = rco2Detail?.currentAvg ?? latestByPollutant.CO2 ?? 0
  const rco2PreviousAvg = rco2Detail?.previousAvg ?? 0
  const rco2Attainment =
    rco2Detail?.goalAttainmentPct ??
    calculateRCO2GoalAttainment(rco2Value, targets.RCO2)
  const rco2GoalMet = rco2Value <= targets.RCO2
  const baselineCo2 = config.data?.baseline?.CO2 ?? 650

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
              sublabel={`RCO₂ · ${formatNumber(rco2Attainment, 0)} % atteinte`}
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
                {hasTdTrend ? (
                  <MTDTrendChart
                    labels={mtdLabels}
                    values={tdDailyValues}
                    target={targets.TD}
                    unit="%"
                    color="#E65100"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-text-tertiary">
                    <span>Aucune donnée disponible pour le TD</span>
                    <span className="text-[11px] text-text-secondary">
                      L&apos;historique apparaît dès que des agrégations journalières existent.
                    </span>
                  </div>
                )}
              </ChartWrapper>
              <ChartWrapper
                title="Dépassements par polluant"
                subtitle="Taux de dépassement (TD) par polluant · cible ≤ 2 %"
                height={240}
                className="lg:col-span-1"
              >
                <MTDTrendChart
                  labels={tdByPollutant.map((p) => p.label)}
                  values={tdByPollutant.map((p) => p.value)}
                  target={targets.TD}
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
                {ipeDailyValues.some((v) => v > 0) ? (
                  <MTDTrendChart
                    labels={mtdLabels}
                    values={ipeDailyValues}
                    target={targets.IPE}
                    unit="pts"
                    color="#1B5E20"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-text-tertiary">
                    <span>Aucune série IPE disponible</span>
                    <span className="text-[11px] text-text-secondary">
                      Score actuel&nbsp;: {formatNumber(ipeValue, 1)} pts
                    </span>
                  </div>
                )}
              </ChartWrapper>
            </>
          )}

          {selectedKPI === 'EMJ' && (
            <>
              <ChartWrapper
                title={`Émissions journalières ${POLLUTANTS[selectedEmjPollutant].label}`}
                subtitle={`EMJ par jour (kg/j) · ${POLLUTANTS[selectedEmjPollutant].longLabel}`}
                height={240}
                className="lg:col-span-2"
                loading={emjHistory.isLoading}
                action={<CloseDetailButton onClose={() => setSelectedKPI(null)} />}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Polluant
                  </span>
                  {POLLUTANT_CODES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setSelectedEmjPollutant(code)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                        selectedEmjPollutant === code
                          ? 'border-transparent text-white'
                          : 'border-border text-text-secondary hover:bg-bg hover:text-text-primary',
                      )}
                      style={
                        selectedEmjPollutant === code
                          ? { backgroundColor: POLLUTANTS[code].color }
                          : undefined
                      }
                    >
                      {POLLUTANTS[code].label}
                    </button>
                  ))}
                </div>

                {hasEmjTrend ? (
                  <MTDTrendChart
                    labels={mtdLabels}
                    values={
                      mtdEmjDaily.some((v) => v > 0)
                        ? mtdEmjDaily
                        : mtdLabels.map((_, i) =>
                            i === mtdActiveDays - 1
                              ? lookupPollutantMetric(summary.data?.emj, selectedEmjPollutant)
                              : 0,
                          )
                    }
                    unit="kg/j"
                    color={POLLUTANTS[selectedEmjPollutant].color}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-text-tertiary">
                    <span>Aucune donnée pour {POLLUTANTS[selectedEmjPollutant].label}</span>
                    <span className="text-[11px] text-text-secondary">
                      Les émissions du jour restent visibles dans le graphique de droite.
                    </span>
                  </div>
                )}
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
                title="Variation mensuelle CO₂ (RCO₂)"
                subtitle={`Vs mois précédent · cible ≤ ${formatKpiTarget(
                  targets.RCO2,
                  'RCO2',
                  1,
                )} %`}
                height={240}
                className="lg:col-span-2"
                loading={rco2MonthlyHistory.isLoading}
                action={<CloseDetailButton onClose={() => setSelectedKPI(null)} />}
              >
                {rco2MonthlyChart.values.length > 0 ? (
                  <MTDTrendChart
                    labels={rco2MonthlyChart.labels}
                    values={rco2MonthlyChart.values}
                    target={targets.RCO2}
                    unit="%"
                    color={POLLUTANTS.CO2.color}
                    beginAtZero={false}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-text-tertiary">
                    <span>Aucune série mensuelle RCO₂</span>
                    <span className="text-[11px] text-text-secondary">
                      Variation actuelle&nbsp;: {formatNumber(rco2Value, 1)} %
                    </span>
                  </div>
                )}
              </ChartWrapper>
              <ChartWrapper
                title="Objectif CO₂ mensuel"
                subtitle="Moyenne mois actuel vs mois précédent"
                height={240}
                className="lg:col-span-1"
              >
                <div className="flex h-full flex-col justify-center gap-4 px-2">
                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        M−1
                      </div>
                      <div className="text-xl font-semibold text-text-primary">
                        {formatNumber(rco2PreviousAvg, 0)}
                        <span className="ml-1 text-xs text-text-secondary">ppm</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        Mois actuel
                      </div>
                      <div className="text-xl font-semibold text-text-primary">
                        {formatNumber(rco2CurrentAvg, 0)}
                        <span className="ml-1 text-xs text-text-secondary">ppm</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border bg-bg/50 p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-text-secondary">Cible</span>
                      <span className="font-medium text-text-primary">
                        ≤ {formatKpiTarget(targets.RCO2, 'RCO2', 1)} %
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-secondary">Réel (RCO₂)</span>
                      <span className="font-medium text-text-primary">
                        {formatNumber(rco2Value, 1)} %
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-secondary">Atteinte</span>
                      <span className="font-semibold text-text-primary">
                        {formatNumber(rco2Attainment, 0)} %
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        rco2GoalMet ? 'bg-success' : 'bg-warning',
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, rco2Attainment))}%` }}
                    />
                  </div>

                  <p
                    className={cn(
                      'text-center text-xs font-medium',
                      rco2GoalMet ? 'text-success' : 'text-warning',
                    )}
                  >
                    {rco2GoalMet ? '✓ Objectif atteint' : '⚠ En dessous de l\u2019objectif'}
                  </p>
                </div>
              </ChartWrapper>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {!historyHidden && (
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
            height={280}
            className="w-full lg:col-span-2"
            loading={latest.isLoading}
            action={
              <div className="flex items-center gap-1.5">
                {selectedMetric !== 'all' && (
                  <button
                    type="button"
                    onClick={showAllPollutants}
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
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Polluant affiché
              </span>
              <button
                type="button"
                onClick={showAllPollutants}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                  selectedMetric === 'all'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-text-secondary hover:bg-bg hover:text-text-primary',
                )}
              >
                Tous
              </button>
              {POLLUTANT_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => focusPollutant(code)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                    selectedMetric === code
                      ? 'border-accent bg-accent text-white'
                      : 'border-border text-text-secondary hover:bg-bg hover:text-text-primary',
                  )}
                  style={
                    selectedMetric === code
                      ? { backgroundColor: POLLUTANTS[code].color }
                      : undefined
                  }
                >
                  {POLLUTANTS[code].label}
                </button>
              ))}
            </div>

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

        <Card padded className={historyHidden ? 'lg:col-span-3' : 'lg:col-span-1'}>
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
          value={activeSitesCount != null ? String(activeSitesCount) : '—'}
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
          value={`${formatNumber(baselineCo2, 0)} ppm`}
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
