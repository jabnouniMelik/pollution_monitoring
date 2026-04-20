import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card/Card'
import { Input } from '@/components/ui/Input/Input'
import { Button } from '@/components/ui/Button/Button'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import { POLLUTANT_CODES, POLLUTANTS } from '@/lib/constants/pollutants'
import { useKPIConfig } from '@/features/kpi/hooks/useKPISummary'
import {
  useUpdateAirflow,
  useUpdateTargets,
  useUpdateWeights,
} from '@/features/config/hooks/useUpdateConfig'

export default function Config() {
  const { data: config } = useKPIConfig()
  const updateAirflow = useUpdateAirflow()
  const updateWeights = useUpdateWeights()
  const updateTargets = useUpdateTargets()

  const [airflow, setAirflow] = useState<number>(config?.airflow ?? 0)
  const [weights, setWeights] = useState<Record<string, number>>(config?.weights ?? {})
  const [targets, setTargets] = useState(config?.targets ?? { TD: 2, IPE: 95, RCO2: -5, EMJ: 0 })

  useEffect(() => {
    if (config) {
      setAirflow(config.airflow ?? 0)
      setWeights(config.weights ?? {})
      setTargets(config.targets ?? { TD: 2, IPE: 95, RCO2: -5, EMJ: 0 })
    }
  }, [config])

  const weightSum = Object.values(weights ?? {}).reduce((s, v) => s + v, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Configuration"
        subtitle="Paramètres du calcul KPI · accès restreint aux superviseurs"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Débit d’air" subtitle="Airflow (Nm³/s) utilisé pour le calcul EMJ" />
          <PermissionGate permission="UPDATE_AIRFLOW" fallback={<p className="text-sm text-text-secondary">Lecture seule</p>}>
            <div className="flex items-end gap-2">
              <Input
                label="Airflow"
                type="number"
                value={airflow}
                onChange={(e) => setAirflow(Number(e.target.value))}
                hint="Nm³/s"
              />
              <Button
                variant="primary"
                loading={updateAirflow.isPending}
                onClick={() => updateAirflow.mutate(airflow)}
              >
                Enregistrer
              </Button>
            </div>
          </PermissionGate>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Pondérations IPE"
            subtitle={`Somme actuelle: ${weightSum.toFixed(2)} (doit être = 1.00)`}
          />
          <PermissionGate permission="UPDATE_WEIGHTS" fallback={<p className="text-sm text-text-secondary">Lecture seule</p>}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
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
              disabled={Math.abs(weightSum - 1) > 0.01}
              onClick={() => updateWeights.mutate(weights)}
            >
              Enregistrer
            </Button>
          </PermissionGate>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Objectifs KPI" subtitle="Cibles pour TD, IPE, RCO₂ et EMJ" />
          <PermissionGate permission="UPDATE_TARGETS" fallback={<p className="text-sm text-text-secondary">Lecture seule</p>}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Input
                label="TD (max %)"
                type="number"
                value={targets.TD}
                onChange={(e) => setTargets({ ...targets, TD: Number(e.target.value) })}
              />
              <Input
                label="IPE (min /100)"
                type="number"
                value={targets.IPE}
                onChange={(e) => setTargets({ ...targets, IPE: Number(e.target.value) })}
              />
              <Input
                label="RCO₂ (max %)"
                type="number"
                value={targets.RCO2}
                onChange={(e) => setTargets({ ...targets, RCO2: Number(e.target.value) })}
              />
              <Input
                label="EMJ (max kg/j)"
                type="number"
                value={targets.EMJ ?? 0}
                onChange={(e) => setTargets({ ...targets, EMJ: Number(e.target.value) })}
              />
            </div>
            <Button
              variant="primary"
              className="mt-3"
              loading={updateTargets.isPending}
              onClick={() => updateTargets.mutate(targets)}
            >
              Enregistrer
            </Button>
          </PermissionGate>
        </Card>
      </div>
    </div>
  )
}
