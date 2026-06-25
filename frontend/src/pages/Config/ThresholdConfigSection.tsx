import { useEffect, useState } from 'react'
import { Card, CardHeader } from '@/components/ui/Card/Card'
import { Input } from '@/components/ui/Input/Input'
import { Button } from '@/components/ui/Button/Button'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import { Skeleton } from '@/components/ui/Skeleton/Skeleton'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  useResetThresholdConfig,
  useThresholds,
  useUpdateThresholdPollutants,
} from '@/features/config/hooks/useThresholds'
import type { PollutantsPayload } from '@/features/config/api/configApi'
import type { PollutantThresholdLimits } from '@/features/kpi/types/kpi.types'
import { POLLUTANT_CODES, POLLUTANTS, type PollutantCode } from '@/lib/constants/pollutants'
import {
  getPollutantThresholdRow,
  POLLUTANT_TO_BACKEND_KEY,
} from '@/lib/constants/pollutantThresholdKeys'
import { TUNISIA_DECRET_LIMITS } from '@/lib/constants/tunisiaDecret'
import { Permission } from '@/lib/constants/roles'
import { hasPermission } from '@/lib/rbac/checkPermission'
import { pollutantThresholdRowSchema } from '@/lib/validation/config.schema'

function defaultPollutantLimits(code: PollutantCode): PollutantThresholdLimits {
  const dec = TUNISIA_DECRET_LIMITS[code]
  const max = dec?.limit ?? 100
  const min = 0
  const warning = max * 0.8
  const critical = max * 1.2
  return {
    min,
    max,
    warning: Math.round(warning * 100) / 100,
    critical: Math.round(critical * 100) / 100,
    unit: POLLUTANTS[code].unit,
    reference: dec?.reference ?? 'Décret 2018-928',
  }
}

export function ThresholdConfigSection() {
  const { user } = useAuth()
  const canEdit = hasPermission(user?.role, Permission.UPDATE_THRESHOLDS)

  const thresholds = useThresholds(undefined)
  const updateMut = useUpdateThresholdPollutants()
  const resetMut = useResetThresholdConfig()

  const [rows, setRows] = useState<Record<PollutantCode, PollutantThresholdLimits> | null>(null)

  useEffect(() => {
    const cfg = thresholds.data?.[0]
    if (!cfg) return
    const next = {} as Record<PollutantCode, PollutantThresholdLimits>
    for (const code of POLLUTANT_CODES) {
      next[code] = getPollutantThresholdRow(cfg.pollutants, code) ?? defaultPollutantLimits(code)
    }
    setRows(next)
  }, [thresholds.data])

  const configId = thresholds.data?.[0]?._id

  const handlePatch = (code: PollutantCode, patch: Partial<PollutantThresholdLimits>) => {
    setRows((prev) =>
      prev ? { ...prev, [code]: { ...prev[code], ...patch } } : prev,
    )
  }

  const handleSave = () => {
    if (!configId || !rows) return
    const pollutantsData: PollutantsPayload = {}
    for (const code of POLLUTANT_CODES) {
      const parsed = pollutantThresholdRowSchema.safeParse(rows[code])
      if (!parsed.success) {
        window.alert(
          `${POLLUTANTS[code].label}: ${parsed.error.errors.map((e) => e.message).join(' · ')}`,
        )
        return
      }
      const bk = POLLUTANT_TO_BACKEND_KEY[code]
      pollutantsData[bk] = parsed.data
    }
    updateMut.mutate(
      { id: configId, pollutantsData },
      {
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Erreur lors de l’enregistrement'
          window.alert(msg)
        },
      },
    )
  }

  const handleReset = () => {
    if (!configId) return
    if (!window.confirm('Réinitialiser tous les seuils aux valeurs par défaut du serveur (Décret) ?')) {
      return
    }
    resetMut.mutate(configId, {
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Erreur'
        window.alert(msg)
      },
    })
  }

  if (thresholds.isLoading) {
    return (
      <Card className="lg:col-span-3">
        <CardHeader title="Seuils réglementaires et d’alerte" subtitle="Chargement…" />
        <Skeleton className="h-24 w-full" />
      </Card>
    )
  }

  if (thresholds.isError) {
    return (
      <Card className="lg:col-span-3">
        <CardHeader title="Seuils réglementaires et d’alerte" subtitle="Erreur de chargement" />
        <p className="text-sm text-text-secondary">Impossible de charger la configuration des seuils.</p>
      </Card>
    )
  }

  if (!configId || !rows) {
    return (
      <Card className="lg:col-span-3">
        <CardHeader
          title="Seuils réglementaires et d’alerte"
          subtitle="Configuration globale — lecture seule si non autorisé"
        />
        <p className="text-sm text-text-secondary">
          Aucune configuration de seuils active. Initialisez la base (script serveur ou équivalent) pour
          activer cette section.
        </p>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-3">
      <CardHeader
        title="Seuils réglementaires et d’alerte"
        subtitle="Plafonds réglementaires (max), validation des lectures (min), alertes warning / critique — configuration globale"
      />

      {!canEdit && (
        <p className="mb-3 text-sm text-text-secondary">Lecture seule — modification réservée aux rôles autorisés.</p>
      )}

      <div className="space-y-6">
        {POLLUTANT_CODES.map((code) => {
          const meta = POLLUTANTS[code]
          const row = rows[code]
          return (
            <div
              key={code}
              className="rounded-card border border-border bg-bg/50 p-3 md:p-4"
            >
              <h4 className="mb-3 text-sm font-semibold text-text-primary">
                {meta.longLabel}{' '}
                <span className="font-normal text-text-tertiary">({meta.label})</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
                <Input
                  label="Min (lecture)"
                  type="number"
                  step="any"
                  value={row.min}
                  disabled={!canEdit}
                  onChange={(e) => handlePatch(code, { min: Number(e.target.value) })}
                  hint="Plancher acceptable"
                />
                <Input
                  label="Max (réglementaire)"
                  type="number"
                  step="any"
                  value={row.max}
                  disabled={!canEdit}
                  onChange={(e) => handlePatch(code, { max: Number(e.target.value) })}
                  hint="VLE / plafond"
                />
                <Input
                  label="Warning"
                  type="number"
                  step="any"
                  value={row.warning}
                  disabled={!canEdit}
                  onChange={(e) => handlePatch(code, { warning: Number(e.target.value) })}
                  hint="1er niveau"
                />
                <Input
                  label="Critical"
                  type="number"
                  step="any"
                  value={row.critical}
                  disabled={!canEdit}
                  onChange={(e) => handlePatch(code, { critical: Number(e.target.value) })}
                  hint="Au-dessus du warning"
                />
                <Input
                  label="Unité"
                  value={row.unit}
                  disabled={!canEdit}
                  onChange={(e) => handlePatch(code, { unit: e.target.value })}
                />
                <Input
                  label="Référence"
                  value={row.reference ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => handlePatch(code, { reference: e.target.value })}
                  hint="ex. Annexe II"
                />
              </div>
            </div>
          )
        })}
      </div>

      <PermissionGate permission="UPDATE_THRESHOLDS">
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            loading={updateMut.isPending}
            disabled={!canEdit}
            onClick={handleSave}
          >
            Enregistrer les seuils
          </Button>
          <Button
            variant="secondary"
            loading={resetMut.isPending}
            disabled={!canEdit}
            onClick={handleReset}
          >
            Réinitialiser (défaut serveur)
          </Button>
        </div>
      </PermissionGate>
    </Card>
  )
}
