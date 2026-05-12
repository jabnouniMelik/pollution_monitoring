import { useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, FileText, TrendingUp, XCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal/Modal'
import { Button } from '@/components/ui/Button/Button'
import { Badge } from '@/components/ui/Badge/Badge'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import { useAcknowledgeAlert, useEscalateAlert, useResolveAlert } from '@/features/alerts/hooks/useAlerts'
import { formatDateTime } from '@/lib/utils/formatters'
import type { Alert } from '@/features/alerts/types/alert.types'

interface AlertDetailModalProps {
  alert: Alert | null
  open: boolean
  onClose: () => void
}

export function AlertDetailModal({ alert, open, onClose }: AlertDetailModalProps) {
  const [resolutionNote, setResolutionNote] = useState('')

  const acknowledge = useAcknowledgeAlert()
  const escalate = useEscalateAlert()
  const resolve = useResolveAlert()

  if (!alert) return null

  const handleAcknowledge = async () => {
    await acknowledge.mutateAsync(alert.id)
  }

  const handleEscalate = async () => {
    const newSeverity = alert.severity === 'warning' ? 'HIGH' : 'CRITICAL'
    await escalate.mutateAsync({ id: alert.id, newSeverity, reason: 'Escaladé depuis le modal' })
  }

  const handleResolve = async () => {
    await resolve.mutateAsync({ id: alert.id, note: resolutionNote })
    onClose()
  }

  const severityColor = {
    critical: 'danger',
    warning: 'warning',
    info: 'info',
  }[alert.severity] as 'warning' | 'danger' | 'info'

  const typeLabel = {
    threshold_breach: 'Dépassement de seuil',
    sensor_malfunction: 'Défaut capteur',
    calibration_due: 'Calibration requise',
  }[alert.type] || alert.type

  // Correct sign for the deviation percentage
  const deviation = alert.threshold > 0
    ? ((alert.value - alert.threshold) / alert.threshold) * 100
    : 0
  const deviationStr = `${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)}%`
  const deviationColor = deviation >= 0 ? 'text-danger' : 'text-warning'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Détail de l'alerte"
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
          <div className="flex gap-2">
            {!alert.acknowledged && (
              <PermissionGate permission="ACKNOWLEDGE_ALERT">
                <Button
                  variant="secondary"
                  onClick={handleAcknowledge}
                  loading={acknowledge.isPending}
                  leftIcon={<CheckCircle className="h-4 w-4" />}
                >
                  Acquitter
                </Button>
              </PermissionGate>
            )}
            {!alert.resolved && (
              <>
                <PermissionGate permission="ESCALATE_ALERT">
                  <Button
                    variant="ghost"
                    onClick={handleEscalate}
                    loading={escalate.isPending}
                    leftIcon={<TrendingUp className="h-4 w-4" />}
                  >
                    Escalader
                  </Button>
                </PermissionGate>
                <PermissionGate permission="RESOLVE_ALERT">
                  <Button
                    variant="primary"
                    onClick={handleResolve}
                    loading={resolve.isPending}
                    disabled={!resolutionNote.trim()}
                  >
                    Résoudre
                  </Button>
                </PermissionGate>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 text-${severityColor}`} />
            <div>
              <p className="text-sm font-semibold text-text-primary leading-snug">{alert.message}</p>
              <p className="mt-0.5 text-xs text-text-tertiary">{typeLabel}</p>
            </div>
          </div>
          <Badge variant={severityColor} className="shrink-0">{alert.severity}</Badge>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-bg p-4 text-sm">
          <InfoCell label="Polluant" value={alert.pollutant} />
          <InfoCell label="Capteur / Nœud" value={alert.nodeName ?? alert.sensor ?? '—'} />
          {alert.zoneName && <InfoCell label="Zone" value={alert.zoneName} />}
          <InfoCell
            label="Valeur mesurée"
            value={`${alert.value.toFixed(2)} ${alert.unit || 'mg/Nm³'}`}
          />
          <InfoCell
            label="Seuil réglementaire"
            value={`${alert.threshold.toFixed(2)} ${alert.unit || 'mg/Nm³'}`}
          />
          <div>
            <p className="mb-0.5 text-xs text-text-tertiary">Écart</p>
            <p className={`font-semibold ${deviationColor}`}>{deviationStr}</p>
          </div>
          <InfoCell label="Date de détection" value={formatDateTime(alert.timestamp)} />
        </div>

        {/* Timeline */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Clock className="h-4 w-4" />
            Timeline
          </h4>
          <ol className="space-y-3">
            {/* Created */}
            <TimelineItem
              color="bg-info"
              label="Alerte créée"
              date={formatDateTime(alert.timestamp)}
            />

            {/* Acknowledged */}
            {alert.acknowledged && alert.acknowledgedAt ? (
              <TimelineItem
                color="bg-warning"
                label="Acquittée"
                date={formatDateTime(alert.acknowledgedAt)}
                by={alert.acknowledgedBy}
              />
            ) : !alert.resolved ? (
              <TimelineItem
                color="bg-border animate-pulse"
                label="En attente d'acquittement"
                muted
              />
            ) : null}

            {/* Resolved */}
            {alert.resolved && alert.resolvedAt ? (
              <TimelineItem
                color="bg-success"
                label={alert.resolvedBy ? 'Résolue manuellement' : 'Résolue automatiquement'}
                date={formatDateTime(alert.resolvedAt)}
                by={alert.resolvedBy}
                icon={<CheckCircle className="h-3 w-3 text-white" />}
              />
            ) : (
              <TimelineItem
                color={alert.acknowledged ? 'bg-border animate-pulse' : 'bg-border'}
                label="En attente de résolution"
                muted={!alert.acknowledged}
              />
            )}
          </ol>
        </div>

        {/* Existing resolution note */}
        {alert.resolutionNote && (
          <div className="rounded-lg border border-success-light bg-success-light/30 p-3">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-success">
              <FileText className="h-3.5 w-3.5" />
              Note de résolution
            </h4>
            <p className="text-sm text-text-primary">{alert.resolutionNote}</p>
          </div>
        )}

        {/* Resolution textarea */}
        {!alert.resolved && (
          <PermissionGate permission="RESOLVE_ALERT">
            <div>
              <label
                htmlFor="resolution-note"
                className="mb-1 block text-sm font-medium text-text-primary"
              >
                Commentaire de résolution
              </label>
              <textarea
                id="resolution-note"
                placeholder="Décrivez les actions prises pour résoudre cette alerte..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Ce commentaire sera enregistré lors de la résolution de l'alerte.
              </p>
            </div>
          </PermissionGate>
        )}
      </div>
    </Modal>
  )
}

// ── Small helpers ─────────────────────────────────────────────
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-xs text-text-tertiary">{label}</p>
      <p className="font-medium text-text-primary">{value}</p>
    </div>
  )
}

function TimelineItem({
  color,
  label,
  date,
  by,
  muted,
  icon,
}: {
  color: string
  label: string
  date?: string
  by?: string
  muted?: boolean
  icon?: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <div className={`relative mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${color}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${muted ? 'text-text-tertiary' : 'text-text-primary'}`}>
          {label}
        </p>
        {date && <p className="text-xs text-text-tertiary">{date}</p>}
        {by && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent/10 text-[9px] font-bold text-accent">
              {String(by)[0]?.toUpperCase() ?? '?'}
            </span>
            {by}
          </p>
        )}
      </div>
    </li>
  )
}
