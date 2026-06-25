import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card/Card'
import { Input } from '@/components/ui/Input/Input'
import { Button } from '@/components/ui/Button/Button'
import { QueryState } from '@/components/common/QueryState/QueryState'
import { Skeleton } from '@/components/ui/Skeleton/Skeleton'
import { POLLUTANT_CODES, POLLUTANTS } from '@/lib/constants/pollutants'
import { useKPIConfig } from '@/features/kpi/hooks/useKPISummary'
import {
  useUpdateAirflow,
  useUpdateBaseline,
  useUpdateSampleInterval,
  useUpdateTargets,
  useUpdateWeights,
} from '@/features/config/hooks/useUpdateConfig'
import { ThresholdConfigSection } from './ThresholdConfigSection'
import { airflowSchema, targetsSchema, weightsSchema } from '@/lib/validation/config.schema'

const DEFAULT_TARGETS = { TD: 2, IPE: 95, RCO2: -5, EMJ: 0 }

export default function Config() {
  const configQuery = useKPIConfig()
  const updateAirflow = useUpdateAirflow()
  const updateBaseline = useUpdateBaseline()
  const updateSampleInterval = useUpdateSampleInterval()
  const updateWeights = useUpdateWeights()
  const updateTargets = useUpdateTargets()

  const [airflow, setAirflow] = useState(0)
  const [baselineCo2, setBaselineCo2] = useState(650)
  const [sampleInterval, setSampleInterval] = useState(30)
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [targets, setTargets] = useState(DEFAULT_TARGETS)

  const config = configQuery.data

  useEffect(() => {
    if (!config) return
    setAirflow(config.airflow ?? 0)
    setBaselineCo2(config.baselineCo2 ?? config.baseline?.CO2 ?? 650)
    setSampleInterval(config.expectedSampleIntervalSeconds ?? 30)
    setWeights(config.weights ?? {})
    setTargets({
      TD: config.targets?.TD ?? 2,
      IPE: config.targets?.IPE ?? 95,
      RCO2: config.targets?.RCO2 ?? -5,
      EMJ: config.targets?.EMJ ?? 0,
    })
  }, [config])

  const weightSum = useMemo(
    () => Object.values(weights ?? {}).reduce((s, v) => s + (Number(v) || 0), 0),
    [weights],
  )

  const saveAirflow = () => {
    const parsed = airflowSchema.safeParse({ airflow })
    if (!parsed.success) {
      window.alert(parsed.error.errors.map((e) => e.message).join(' · '))
      return
    }
    updateAirflow.mutate(parsed.data.airflow)
  }

  const saveBaseline = () => {
    if (!Number.isFinite(baselineCo2) || baselineCo2 < 0) {
      window.alert('La baseline CO₂ doit être un nombre ≥ 0')
      return
    }
    updateBaseline.mutate(baselineCo2)
  }

  const saveSampleInterval = () => {
    if (!Number.isFinite(sampleInterval) || sampleInterval < 1 || sampleInterval > 3600) {
      window.alert('L’intervalle doit être entre 1 et 3600 secondes')
      return
    }
    updateSampleInterval.mutate(sampleInterval)
  }

  const saveWeights = () => {
    const parsed = weightsSchema.safeParse(weights)
    if (!parsed.success) {
      window.alert(parsed.error.errors.map((e) => e.message).join(' · '))
      return
    }
    updateWeights.mutate(parsed.data)
  }

  const saveTargets = () => {
    const parsed = targetsSchema.safeParse(targets)
    if (!parsed.success) {
      window.alert(parsed.error.errors.map((e) => e.message).join(' · '))
      return
    }
    updateTargets.mutate({
      TD: parsed.data.TD ?? targets.TD,
      IPE: parsed.data.IPE ?? targets.IPE,
      RCO2: parsed.data.RCO2 ?? targets.RCO2,
      EMJ: parsed.data.EMJ ?? targets.EMJ,
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Configuration"
        subtitle="Paramètres KPI (EMJ, IPE, objectifs) et seuils réglementaires — Décret 2018-928"
      />

      <QueryState
        query={configQuery}
        loadingSkeleton={
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
        errorTitle="Configuration indisponible"
        errorDescription="Impossible de charger les paramètres KPI."
      >
        {() => (
          <>
            {config?.isDefault && (
              <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning-light/30 p-4 text-sm text-text-primary">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="font-semibold">Configuration KPI non initialisée</p>
                  <p className="mt-1 text-text-secondary">
                    Exécutez <code className="rounded bg-bg px-1">npm run init:kpi</code> dans le
                    dossier backend, puis rechargez cette page avant d’enregistrer des paramètres.
                  </p>
                </div>
              </div>
            )}

            {config?.siteName && (
              <p className="text-sm text-text-secondary">
                Site actif&nbsp;: <span className="font-medium text-text-primary">{config.siteName}</span>
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader
                  title="Paramètres EMJ"
                  subtitle="Débit d’air et baseline CO₂ pour les calculs d’émission"
                />
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <Input
                      label="Débit d’air (Q_air)"
                      type="number"
                      step="0.1"
                      min={0.1}
                      max={100}
                      value={airflow}
                      onChange={(e) => setAirflow(Number(e.target.value))}
                      hint="Nm³/s"
                    />
                    <Button
                      variant="primary"
                      loading={updateAirflow.isPending}
                      disabled={config?.isDefault}
                      onClick={saveAirflow}
                    >
                      Enregistrer
                    </Button>
                  </div>
                  <div className="flex items-end gap-2">
                    <Input
                      label="Baseline CO₂"
                      type="number"
                      min={0}
                      value={baselineCo2}
                      onChange={(e) => setBaselineCo2(Number(e.target.value))}
                      hint="ppm — référence affichage / RCO₂"
                    />
                    <Button
                      variant="primary"
                      loading={updateBaseline.isPending}
                      disabled={config?.isDefault}
                      onClick={saveBaseline}
                    >
                      Enregistrer
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader
                  title="Acquisition"
                  subtitle="Intervalle attendu entre deux lectures capteurs"
                />
                <div className="flex items-end gap-2">
                  <Input
                    label="Intervalle d’échantillonnage"
                    type="number"
                    min={1}
                    max={3600}
                    value={sampleInterval}
                    onChange={(e) => setSampleInterval(Number(e.target.value))}
                    hint="secondes"
                  />
                  <Button
                    variant="primary"
                    loading={updateSampleInterval.isPending}
                    disabled={config?.isDefault}
                    onClick={saveSampleInterval}
                  >
                    Enregistrer
                  </Button>
                </div>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader
                  title="Pondérations IPE"
                  subtitle={`Somme actuelle : ${weightSum.toFixed(2)} (doit être = 1,00)`}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                  {POLLUTANT_CODES.map((code) => (
                    <Input
                      key={code}
                      label={POLLUTANTS[code].label}
                      type="number"
                      step="0.01"
                      min={0}
                      max={1}
                      value={weights[code] ?? 0}
                      onChange={(e) =>
                        setWeights((w) => ({ ...w, [code]: Number(e.target.value) }))
                      }
                    />
                  ))}
                </div>
                <Button
                  variant="primary"
                  className="mt-3"
                  loading={updateWeights.isPending}
                  disabled={config?.isDefault || Math.abs(weightSum - 1) > 0.01}
                  onClick={saveWeights}
                >
                  Enregistrer les pondérations
                </Button>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader
                  title="Objectifs KPI"
                  subtitle="Cibles affichées sur le tableau de bord et dans les rapports"
                />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Input
                    label="TD (max %)"
                    type="number"
                    step="0.1"
                    value={targets.TD}
                    onChange={(e) => setTargets({ ...targets, TD: Number(e.target.value) })}
                    hint="Taux de dépassement"
                  />
                  <Input
                    label="IPE (min /100)"
                    type="number"
                    value={targets.IPE}
                    onChange={(e) => setTargets({ ...targets, IPE: Number(e.target.value) })}
                  />
                  <Input
                    label="RCO₂ (objectif %)"
                    type="number"
                    value={targets.RCO2}
                    onChange={(e) => setTargets({ ...targets, RCO2: Number(e.target.value) })}
                    hint="ex. −5 = réduction 5 %"
                  />
                  <Input
                    label="EMJ (max kg/j)"
                    type="number"
                    value={targets.EMJ ?? 0}
                    onChange={(e) => setTargets({ ...targets, EMJ: Number(e.target.value) })}
                    hint="optionnel"
                  />
                </div>
                <Button
                  variant="primary"
                  className="mt-3"
                  loading={updateTargets.isPending}
                  disabled={config?.isDefault}
                  onClick={saveTargets}
                >
                  Enregistrer les objectifs
                </Button>
              </Card>

              <ThresholdConfigSection />
            </div>
          </>
        )}
      </QueryState>
    </div>
  )
}
