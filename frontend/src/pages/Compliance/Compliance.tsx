import { useMemo } from 'react'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Card } from '@/components/ui/Card/Card'
import { Badge } from '@/components/ui/Badge/Badge'
import { ComplianceTable, type ComplianceRow } from '@/components/kpi/ComplianceTable/ComplianceTable'
import { QueryState } from '@/components/common/QueryState/QueryState'
import { ComplianceSkeleton } from '@/components/ui/Skeleton/SkeletonBlocks'
import { POLLUTANT_CODES, POLLUTANTS, type PollutantCode } from '@/lib/constants/pollutants'
import { getPollutantThresholdRow } from '@/lib/constants/pollutantThresholdKeys'
import { DECRET_NAME, DECRET_URL, TUNISIA_DECRET_LIMITS } from '@/lib/constants/tunisiaDecret'
import { useLatestReadings } from '@/features/readings/hooks/useReadings'
import { useThresholds } from '@/features/config/hooks/useThresholds'
import { useSelectionStore } from '@/store/selectionStore'

export default function Compliance() {
  const { siteId, zoneId } = useSelectionStore()
  const latest = useLatestReadings({ siteId: siteId ?? undefined, zoneId: zoneId ?? undefined })
  const thresholds = useThresholds(siteId ?? undefined)

  const rows = useMemo<ComplianceRow[]>(() => {
    const latestByPollutant: Record<string, number> = {}
    latest.data?.forEach((r) => {
      for (const [code, m] of Object.entries(r.measurements)) {
        if (m && (!(code in latestByPollutant) || m.value > (latestByPollutant[code] ?? 0))) {
          latestByPollutant[code] = m.value
        }
      }
    })

    const siteLimits = thresholds.data?.[0]?.pollutants ?? {}

    return POLLUTANT_CODES.map((code: PollutantCode) => {
      const regulatory = TUNISIA_DECRET_LIMITS[code]
      const siteThreshold = getPollutantThresholdRow(siteLimits, code)
      return {
        pollutant: code,
        label: POLLUTANTS[code].longLabel,
        value: latestByPollutant[code] ?? 0,
        regulatoryLimit: regulatory?.limit ?? 0,
        siteLimit: siteThreshold?.critical,
        unit: POLLUTANTS[code].unit,
        reference: regulatory?.reference,
      }
    })
  }, [latest.data, thresholds.data])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Conformité réglementaire"
        subtitle={`Suivi des valeurs limites d’émission (${DECRET_NAME})`}
      />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-info-light text-info">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Référentiel : {DECRET_NAME}
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                Les valeurs limites d’émission (VLE) appliquées proviennent de l’Annexe I, II et IV
                du décret relatif aux rejets dans l’atmosphère. Les seuils site (si configurés)
                peuvent être plus stricts que la réglementation nationale.
              </p>
              <a
                href={DECRET_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                Consulter le texte officiel <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          </div>
          <Badge variant="info">VLE {DECRET_NAME}</Badge>
        </div>
      </Card>

      <Card padded={false}>
        <div className="px-4 pt-4">
          <h3 className="text-sm font-semibold text-text-primary">Tableau de conformité</h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            Comparaison des dernières mesures avec les limites applicables.
          </p>
        </div>
        <div className="px-4 pb-4 pt-3">
          <QueryState
            query={latest}
            loadingSkeleton={<ComplianceSkeleton />}
            emptyTitle="Aucune mesure disponible"
            emptyDescription="Aucune donnée de mesure n'est disponible pour calculer la conformité."
            errorTitle="Erreur de chargement"
            errorDescription="Impossible de charger les données de conformité."
          >
            {() => <ComplianceTable rows={rows} />}
          </QueryState>
        </div>
      </Card>
    </div>
  )
}
