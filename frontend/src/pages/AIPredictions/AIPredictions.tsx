import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bot, Sparkles, TrendingUp, AlertTriangle, BarChart3, Play, Database } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card/Card'
import { Badge } from '@/components/ui/Badge/Badge'
import { Button } from '@/components/ui/Button/Button'
import { ChartWrapper } from '@/components/charts/ChartWrapper/ChartWrapper'
import { HistoryChart, type HistorySeries } from '@/components/charts/HistoryChart/HistoryChart'
import { Select, type SelectOption } from '@/components/ui/Select/Select'
import { QueryState } from '@/components/common/QueryState/QueryState'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import {
  POLLUTANTS,
  POLLUTANT_CODES,
  type PollutantCode,
} from '@/lib/constants/pollutants'
import { TUNISIA_DECRET_LIMITS } from '@/lib/constants/tunisiaDecret'
import { useSelectionStore } from '@/store/selectionStore'
import { useHistoricalReadings } from '@/features/readings/hooks/useReadings'
import {
  useIAHealth,
  useLatestForecast,
  useAnomalyHistory,
  useRunIAForZone,
  useLatestRetrainDataset,
  usePrepareRetrainDataset,
  useStartRetrain,
  useLatestRetrainJob,
} from '@/features/ia/hooks/useIA'
import { ForecastStepsTable } from '@/features/ia/components/ForecastStepsTable'
import {
  forecastSeriesForChart,
  nextStepExceeding,
} from '@/features/ia/utils/forecastMapping'
import { zoneApi } from '@/features/zones/api/zoneApi'

const POLLUTANT_OPTIONS: SelectOption[] = POLLUTANT_CODES.map((code) => ({
  value: code,
  label: POLLUTANTS[code].label,
}))

export default function AIPredictions() {
  const { siteId, zoneId } = useSelectionStore()
  const [pollutant, setPollutant] = useState<PollutantCode>('NOX')

  const health = useIAHealth()
  const forecast = useLatestForecast(zoneId)
  const anomalies = useAnomalyHistory(zoneId, 5)
  const runIA = useRunIAForZone(zoneId)
  const prepareDataset = usePrepareRetrainDataset()
  const startRetrain = useStartRetrain()
  const latestRetrainJob = useLatestRetrainJob()
  const [datasetFrom, setDatasetFrom] = useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    return d.toISOString().slice(0, 10)
  })
  const [datasetTo, setDatasetTo] = useState(() => new Date().toISOString().slice(0, 10))
  const latestDataset = useLatestRetrainDataset({
    siteId,
    zoneId,
  })

  const sensorCountQuery = useQuery({
    queryKey: ['zones', 'sensorsCount', zoneId ?? ''],
    queryFn: () => zoneApi.getSensorsCount(zoneId as string),
    enabled: Boolean(zoneId),
  })
  const hasSensorNodes = (sensorCountQuery.data ?? 0) > 0

  const now = new Date()
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const to = now.toISOString()

  const readings = useHistoricalReadings({
    siteId: siteId ?? undefined,
    zoneId: zoneId ?? undefined,
    pollutant,
    from,
    to,
    limit: 800,
  })

  const latestAnomaly = anomalies.data?.[0]
  const risk = useMemo(
    () => nextStepExceeding(forecast.data ?? null, pollutant),
    [forecast.data, pollutant],
  )

  const chartSeries = useMemo((): HistorySeries[] => {
    const histPoints =
      readings.data?.map((r) => ({
        t: r.timestamp,
        v: r.measurements[pollutant]?.value ?? 0,
      })) ?? []

    const hist: HistorySeries = {
      label: 'Mesures (simulateur)',
      color: POLLUTANTS[pollutant].color,
      points: histPoints,
      threshold: TUNISIA_DECRET_LIMITS[pollutant]?.limit,
    }

    const last = histPoints[histPoints.length - 1]
    const bridge =
      last != null
        ? { t: last.t, v: last.v }
        : forecast.data?.anchorPeriodStart
          ? {
              t: forecast.data.anchorPeriodStart,
              v: histPoints[histPoints.length - 1]?.v ?? 0,
            }
          : undefined

    const fc = forecastSeriesForChart(forecast.data ?? null, pollutant, {
      bridgeFrom: bridge,
    })

    return fc.points.length > 1 ? [hist, fc] : [hist]
  }, [readings.data, forecast.data, pollutant])

  const lstmSkill = health.data?.skill?.per_pollutant_skill

  return (
    <div className="space-y-4">
      <PageHeader
        title="Prédictions IA"
        subtitle="LSTM 4 h (horizon +1…+4) et détection d’anomalies Isolation Forest"
        actions={
          <div className="flex items-center gap-2">
            <Select
              aria-label="Polluant"
              options={POLLUTANT_OPTIONS}
              value={pollutant}
              onChange={(e) => setPollutant(e.target.value as PollutantCode)}
            />
            <Link
              to="/history"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-white px-2.5 text-xs text-text-primary hover:bg-bg"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Historique
            </Link>
            <PermissionGate permission="RUN_IA">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Play className="h-3.5 w-3.5" />}
                disabled={!zoneId || !hasSensorNodes || runIA.isPending}
                onClick={() => runIA.mutate()}
              >
                {runIA.isPending ? 'Agrégation + IA…' : 'Lancer IA'}
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <PermissionGate permission="RETRAIN_MODEL">
        <Card>
          <CardHeader
            title="Ré-entraînement du modèle"
            subtitle="Préparer dataset, valider qualité, puis lancer le job asynchrone"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={latestDataset.data?.quality?.validForTraining ? 'success' : 'warning'}>
              Dataset {latestDataset.data?.quality?.validForTraining ? 'valide' : 'à corriger'}
            </Badge>
            <Badge
              variant={
                latestRetrainJob.data?.status === 'success'
                  ? 'success'
                  : latestRetrainJob.data?.status === 'failed' || latestRetrainJob.data?.status === 'rolled_back'
                    ? 'warning'
                    : 'default'
              }
            >
              Job: {latestRetrainJob.data?.status ?? 'aucun'}
            </Badge>
            <span className="text-text-tertiary">
              {latestDataset.data
                ? `${latestDataset.data.rowCount} lignes · missing ${(latestDataset.data.missingRatio * 100).toFixed(1)} %`
                : 'Aucun dataset préparé'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-sm text-text-secondary">
              De
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                value={datasetFrom}
                onChange={(e) => setDatasetFrom(e.target.value)}
              />
            </label>
            <label className="text-sm text-text-secondary">
              À
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                value={datasetTo}
                onChange={(e) => setDatasetTo(e.target.value)}
              />
            </label>
            <div className="md:col-span-2 rounded-md border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
              <p>
                Plage prête: {datasetFrom} → {datasetTo}
              </p>
              <p>
                Seuils qualité: min {latestDataset.data?.quality?.minRows ?? '—'} lignes, missing max{' '}
                {latestDataset.data ? `${(latestDataset.data.quality.maxMissingRatio * 100).toFixed(0)} %` : '—'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Database className="h-3.5 w-3.5" />}
                  disabled={!zoneId || prepareDataset.isPending}
                  onClick={() =>
                    prepareDataset.mutate({
                      periodStart: new Date(`${datasetFrom}T00:00:00.000Z`).toISOString(),
                      periodEnd: new Date(`${datasetTo}T23:59:59.999Z`).toISOString(),
                      siteId,
                      zoneId,
                    })
                  }
                >
                  {prepareDataset.isPending ? 'Préparation…' : 'Préparer dataset'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                  disabled={
                    !latestDataset.data?.quality?.validForTraining ||
                    startRetrain.isPending ||
                    latestRetrainJob.data?.status === 'running'
                  }
                  onClick={() => startRetrain.mutate(latestDataset.data?._id)}
                >
                  {startRetrain.isPending ? 'Lancement…' : 'Lancer ré-entraînement'}
                </Button>
              </div>
            </div>
          </div>
          {latestDataset.data?.quality?.reasons?.length ? (
            <p className="mt-2 text-xs text-warning">
              Dataset invalide: {latestDataset.data.quality.reasons.join(' | ')}
            </p>
          ) : null}
          {latestRetrainJob.data && (
            <div className="mt-3 rounded-md border border-border px-3 py-2 text-xs text-text-secondary">
              <p>
                Job: <strong>{latestRetrainJob.data.status}</strong> — étape {latestRetrainJob.data.stage} —{' '}
                {latestRetrainJob.data.progressPct}%
              </p>
              <div className="mt-2 h-2 w-full rounded bg-bg">
                <div
                  className="h-2 rounded bg-accent transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, latestRetrainJob.data.progressPct || 0))}%` }}
                />
              </div>
              <p>
                Skill Δ:{' '}
                {latestRetrainJob.data.metrics?.skillDelta != null
                  ? latestRetrainJob.data.metrics.skillDelta.toFixed(4)
                  : '—'}{' '}
                | Déploiement suggéré:{' '}
                {latestRetrainJob.data.metrics?.deploySuggested ? 'oui' : 'non'}
              </p>
              {latestRetrainJob.data.logsTail?.length ? (
                <div className="mt-2 rounded border border-border bg-bg px-2 py-1 font-mono text-[10px]">
                  {latestRetrainJob.data.logsTail.slice(-4).map((line, i) => (
                    <p key={`${i}-${line}`} className="truncate">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
              {latestRetrainJob.data.errorMessage && (
                <p className="text-warning">{latestRetrainJob.data.errorMessage}</p>
              )}
            </div>
          )}
        </Card>
      </PermissionGate>

      {!zoneId && (
        <Card>
          <p className="text-sm text-text-secondary">
            Sélectionnez une zone dans la barre latérale pour afficher les prévisions et anomalies IA.
          </p>
        </Card>
      )}

      {zoneId && !sensorCountQuery.isLoading && !hasSensorNodes && (
        <Card>
          <p className="text-sm text-warning">
            Cette zone n&apos;a aucun nœud capteur — l&apos;IA ne peut pas s&apos;exécuter.
            Choisissez une zone équipée (ex. « Zone Fours de Calcination ») ou assignez des capteurs à cette zone.
          </p>
        </Card>
      )}

      {(health.isError || forecast.isError || anomalies.isError) && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {health.isError && (
            <p>Service IA indisponible : {(health.error as { message?: string })?.message ?? 'erreur réseau'}</p>
          )}
          {forecast.isError && (
            <p>Impossible de charger les prévisions pour cette zone.</p>
          )}
          {anomalies.isError && (
            <p>Impossible de charger l&apos;historique des anomalies.</p>
          )}
        </div>
      )}

      {runIA.isError && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Échec du lancement IA : {(runIA.error as Error)?.message ?? 'vérifiez les agrégats horaires (48 h)'}
        </div>
      )}

      {runIA.isSuccess && (
        <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          Pipeline IA exécuté (IF + LSTM) pour cette zone.
        </div>
      )}

      {latestAnomaly?.isAnomaly && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span>
            <strong>Anomalie multivariée</strong> sur le créneau{' '}
            {new Date(latestAnomaly.periodStart).toLocaleString('fr-TN')} — score{' '}
            {latestAnomaly.anomalyScore.toFixed(3)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardHeader
            title="LSTM 4 h"
            subtitle="Fenêtre 48 h · agrégats horaires"
            action={
              <Badge variant={health.data?.lstm?.go_deploy ? 'success' : 'warning'}>
                {health.data?.lstm?.loaded ? 'Actif' : 'Indisponible'}
              </Badge>
            }
          />
          <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
            <Bot className="h-4 w-4 text-accent shrink-0" />
            {forecast.data
              ? `Dernière exécution ${new Date(forecast.data.runAt).toLocaleString('fr-TN')}`
              : forecast.isError
                ? 'Erreur de chargement'
                : 'Aucune prévision en base'}
          </div>
          {health.data?.skill?.global_skill != null && (
            <p className="mt-1 text-xs text-text-tertiary">
              Skill global entraînement : {(health.data.skill.global_skill * 100).toFixed(1)} %
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Risque prévu" subtitle={POLLUTANTS[pollutant].label} />
          <div className="mt-2 flex items-center gap-2">
            <TrendingUp
              className={`h-4 w-4 shrink-0 ${risk ? 'text-warning' : 'text-success'}`}
            />
            {risk ? (
              <>
                <span className="text-lg font-semibold text-warning">
                  Dépassement +{risk.stepHours}h
                </span>
                <Badge variant="danger">{risk.severity}</Badge>
              </>
            ) : (
              <span className="text-sm text-text-secondary">Aucun dépassement prévu (4 h)</span>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Isolation Forest"
            subtitle="Profil 6 polluants / heure"
            action={
              <Badge variant={health.data?.isolation_forest?.loaded ? 'success' : 'default'}>
                {health.data?.isolation_forest?.loaded ? 'Actif' : 'Off'}
              </Badge>
            }
          />
          <div className="mt-2 text-sm text-text-secondary">
            {anomalies.data?.filter((a) => a.isAnomaly).length ?? 0} anomalie(s) récente(s) sur 5 créneaux
          </div>
        </Card>
      </div>

      <QueryState
        query={readings}
        loadingSkeleton={null}
        emptyTitle="Pas de mesures récentes"
        emptyDescription="Démarrez le simulateur MQTT pour alimenter l’historique."
        errorTitle="Erreur"
        errorDescription="Impossible de charger les mesures."
      >
        {() => (
          <ChartWrapper
            title={`${POLLUTANTS[pollutant].longLabel} — historique + prévision`}
            subtitle={`Unité ${POLLUTANTS[pollutant].unit} · trait violet = +1…+4 h (LSTM ou persistance)`}
            height={400}
          >
            <HistoryChart series={chartSeries} unit={POLLUTANTS[pollutant].unit} />
          </ChartWrapper>
        )}
      </QueryState>

      {forecast.data && zoneId && (
        <Card>
          <CardHeader
            title="Tableau des pas horaires"
            subtitle={(() => {
              const key = pollutant === 'SO2' ? 'SOX' : pollutant
              const s = lstmSkill?.[key]
              return `Skill entraînement vs persistance: ${s != null ? `${(s * 100).toFixed(1)} %` : '—'}`
            })()}
          />
          <ForecastStepsTable forecast={forecast.data} pollutant={pollutant} />
        </Card>
      )}

      <Card>
        <CardHeader title="Tous les polluants — +4 h" subtitle="Vue rapide du dernier run LSTM" />
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
          {POLLUTANT_CODES.map((code) => {
            const step = forecast.data?.steps.find((s) => s.stepHours === 4)
            const p = step
              ? step.pollutants.find((x) =>
                  code === 'SO2' ? x.name === 'SOX' : x.name === code,
                )
              : undefined
            return (
              <button
                key={code}
                type="button"
                onClick={() => setPollutant(code)}
                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  pollutant === code ? 'border-accent bg-accent/10' : 'border-border hover:bg-bg'
                }`}
              >
                <span className="font-semibold">{POLLUTANTS[code].label}</span>
                <span className="mt-1 block text-lg font-bold text-text-primary">
                  {p ? p.valuePhysical.toFixed(1) : '—'}
                </span>
                <span className="text-text-tertiary">{p?.predictionSource ?? 'n/a'}</span>
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
