import { useState } from 'react'
import {
  CheckCircle, XCircle, Building2, MapPin, Clock,
  ChevronRight, Cpu, FlaskConical, AlertCircle, Info,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Card } from '@/components/ui/Card/Card'
import { Button } from '@/components/ui/Button/Button'
import { Badge } from '@/components/ui/Badge/Badge'
import { Modal } from '@/components/ui/Modal/Modal'
import { Input } from '@/components/ui/Input/Input'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { formatDateTime } from '@/lib/utils/formatters'
import { POLLUTANTS } from '@/lib/constants/pollutants'

// ── Types ─────────────────────────────────────────────────────
interface Localisation {
  coordinates?: [number, number]
  ville?: string
  adresse?: string
}

interface InitialZone {
  nom: string
  code: string
  pollutants: string[]
  localisation?: Localisation
}

interface PendingItem {
  _id: string
  nom: string
  code?: string
  description?: string
  approvalStatus: 'PENDING' | 'PREPARING'
  sensorNodeNote?: string
  approvalRequestedBy?: { username: string; email: string; role: string }
  approvalRequestedAt?: string
  industrieId?: { nom: string; secteur: string }
  siteId?: { nom: string; localisation?: Localisation }
  localisation?: Localisation
  pollutants?: string[]       // zones
  initialZone?: InitialZone   // sites
  type: 'site' | 'zone'
}

// ── Hooks ─────────────────────────────────────────────────────
function usePendingApprovals() {
  return useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: async () => {
      const [sitesResp, zonesResp] = await Promise.all([
        api.get<ApiSuccess<any[]>>(endpoints.sites.pending),
        api.get<ApiSuccess<any[]>>(endpoints.zones.pending),
      ])
      const sites: PendingItem[] = (unwrap(sitesResp.data) ?? []).map(s => ({ ...s, type: 'site' as const }))
      const zones: PendingItem[] = (unwrap(zonesResp.data) ?? []).map(z => ({ ...z, type: 'zone' as const }))
      return [...sites, ...zones].sort(
        (a, b) => new Date(b.approvalRequestedAt ?? 0).getTime() - new Date(a.approvalRequestedAt ?? 0).getTime()
      )
    },
    staleTime: 0,
  })
}

function usePrepare() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ id, type, note }: { id: string; type: 'site' | 'zone'; note?: string }) => {
      const url = type === 'site' ? endpoints.sites.prepare(id) : endpoints.zones.prepare(id)
      const resp = await api.patch<ApiSuccess<any>>(url, { sensorNodeNote: note })
      return unwrap(resp.data)
    },
    onSuccess: (_, { type }) => {
      toast.success(`${type === 'site' ? 'Site' : 'Zone'} marqué(e) en préparation`)
      qc.invalidateQueries({ queryKey: ['approvals'] })
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  })
}

function useApprove() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'site' | 'zone' }) => {
      const url = type === 'site' ? endpoints.sites.approve(id) : endpoints.zones.approve(id)
      const resp = await api.post<ApiSuccess<any>>(url)
      return unwrap(resp.data)
    },
    onSuccess: (_, { type }) => {
      toast.success(`${type === 'site' ? 'Site' : 'Zone'} approuvé(e) et activé(e)`)
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['zones'] })
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  })
}

function useReject() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ id, type, reason }: { id: string; type: 'site' | 'zone'; reason: string }) => {
      const url = type === 'site' ? endpoints.sites.reject(id) : endpoints.zones.reject(id)
      const resp = await api.post<ApiSuccess<any>>(url, { reason })
      return unwrap(resp.data)
    },
    onSuccess: (_, { type }) => {
      toast.success(`${type === 'site' ? 'Site' : 'Zone'} rejeté(e)`)
      qc.invalidateQueries({ queryKey: ['approvals'] })
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  })
}

// ── Pollutant pills ───────────────────────────────────────────
function PollutantPills({ codes }: { codes: string[] }) {
  if (!codes || codes.length === 0)
    return <span className="text-xs text-text-tertiary">Aucun polluant défini</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((code) => {
        const p = POLLUTANTS[code as keyof typeof POLLUTANTS]
        return (
          <span
            key={code}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
            style={{ backgroundColor: p?.color ?? '#888' }}
          >
            {p?.label ?? code}
          </span>
        )
      })}
    </div>
  )
}

// ── Workflow steps ────────────────────────────────────────────
function WorkflowSteps({ status }: { status: 'PENDING' | 'PREPARING' }) {
  const steps = [
    { key: 'PENDING', label: 'Demande reçue' },
    { key: 'PREPARING', label: 'Installation capteur' },
    { key: 'APPROVED', label: 'Activé' },
  ]
  const currentIdx = steps.findIndex(s => s.key === status)

  return (
    <div className="flex items-center gap-1.5">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1.5">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
            i < currentIdx ? 'bg-success text-white'
            : i === currentIdx ? 'bg-accent text-white'
            : 'bg-border text-text-tertiary'
          }`}>
            {i < currentIdx ? '✓' : i + 1}
          </div>
          <span className={`text-xs ${i === currentIdx ? 'font-semibold text-accent' : 'text-text-tertiary'}`}>
            {step.label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-border" />}
        </div>
      ))}
    </div>
  )
}

// ── Detail Modal ──────────────────────────────────────────────
function DetailModal({
  item, onClose, onPrepare, onApprove, onReject,
  isPreparing, isApproving, isRejecting,
}: {
  item: PendingItem
  onClose: () => void
  onPrepare: (note?: string) => void
  onApprove: () => void
  onReject: (reason: string) => void
  isPreparing: boolean
  isApproving: boolean
  isRejecting: boolean
}) {
  const [rejectReason, setRejectReason] = useState('')
  const [prepareNote, setPrepareNote] = useState(item.sensorNodeNote ?? '')
  const [view, setView] = useState<'detail' | 'reject'>('detail')

  const isPending = item.approvalStatus === 'PENDING'
  const isPreparing_ = item.approvalStatus === 'PREPARING'

  // Resolve pollutants: zones have them directly, sites have them on initialZone
  const pollutants = item.type === 'zone'
    ? (item.pollutants ?? [])
    : (item.initialZone?.pollutants ?? [])

  // Resolve localisation: zones inherit from site, sites have their own
  const localisation = item.localisation
    ?? (item.type === 'zone' ? item.siteId?.localisation : undefined)

  return (
    <Modal
      open
      onClose={onClose}
      title={item.nom}
      description={item.type === 'site' ? 'Demande de création de site' : 'Demande de création de zone'}
      size="md"
    >
      {view === 'detail' ? (
        <div className="space-y-4 p-1">
          {/* Workflow steps */}
          <div className="rounded-lg border border-border bg-bg px-4 py-3">
            <WorkflowSteps status={item.approvalStatus} />
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {item.industrieId && (
              <div className="rounded-lg border border-border p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">Industrie</p>
                <p className="font-medium text-text-primary">{item.industrieId.nom}</p>
                <p className="text-xs text-text-secondary">{item.industrieId.secteur}</p>
              </div>
            )}

            {item.siteId && (
              <div className="rounded-lg border border-border p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">Site</p>
                <p className="font-medium text-text-primary">{item.siteId.nom}</p>
              </div>
            )}

            <div className="rounded-lg border border-border p-3">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                <MapPin className="h-3 w-3" /> Localisation
              </p>
              {localisation?.adresse || localisation?.ville ? (
                <>
                  {localisation.adresse && <p className="text-xs text-text-primary">{localisation.adresse}</p>}
                  {localisation.ville && <p className="text-xs text-text-secondary">{localisation.ville}</p>}
                </>
              ) : (
                <p className="text-xs text-text-tertiary">Non renseignée</p>
              )}
            </div>

            {item.approvalRequestedBy && (
              <div className="rounded-lg border border-border p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">Demandé par</p>
                <p className="font-medium text-text-primary">{item.approvalRequestedBy.username}</p>
                <p className="text-xs text-text-secondary">{item.approvalRequestedBy.email}</p>
                {item.approvalRequestedAt && (
                  <p className="mt-0.5 text-xs text-text-tertiary">{formatDateTime(item.approvalRequestedAt)}</p>
                )}
              </div>
            )}
          </div>

          {/* Initial zone (for sites) */}
          {item.type === 'site' && item.initialZone && (
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Zone initiale créée avec ce site
              </p>
              <div className="flex items-center gap-2">
                <span className="rounded bg-bg px-2 py-0.5 font-mono text-xs">{item.initialZone.code}</span>
                <span className="text-sm font-medium text-text-primary">{item.initialZone.nom}</span>
              </div>
            </div>
          )}

          {/* Pollutants */}
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              <FlaskConical className="h-3.5 w-3.5" />
              Polluants à surveiller
            </p>
            <PollutantPills codes={pollutants} />
          </div>

          {/* ── Step 1: PENDING → assign sensor node ── */}
          {isPending && (
            <div className="rounded-lg border border-warning-light bg-warning-light/20 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-warning-dark">
                <Cpu className="h-3.5 w-3.5" />
                Étape 1 — Assigner un nœud capteur
              </p>
              <p className="mb-3 text-xs text-text-secondary">
                Confirmez que le nœud capteur physique (ESP32) est prêt à être installé sur ce{' '}
                {item.type === 'site' ? 'site' : 'zone'}.
              </p>
              <Input
                label="Note d'installation (optionnel)"
                placeholder="ex: Nœud ESP32 #42 — MAC: AA:BB:CC:DD:EE:FF"
                value={prepareNote}
                onChange={e => setPrepareNote(e.target.value)}
              />
              <div className="mt-3 flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Cpu className="h-3.5 w-3.5" />}
                  loading={isPreparing}
                  onClick={() => onPrepare(prepareNote || undefined)}
                >
                  Marquer en préparation
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: PREPARING → approve ── */}
          {isPreparing_ && (
            <div className="rounded-lg border border-success-light bg-success-light/20 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-success">
                <CheckCircle className="h-3.5 w-3.5" />
                Étape 2 — Approuver et activer
              </p>
              <p className="text-xs text-text-secondary">
                Le nœud capteur est installé. Approuvez pour activer ce{' '}
                {item.type === 'site' ? 'site et sa zone initiale' : 'zone'}.
              </p>
              {item.sensorNodeNote && (
                <p className="mt-2 rounded bg-bg px-2 py-1 font-mono text-xs text-text-secondary">
                  📋 {item.sensorNodeNote}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={() => setView('reject')}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Rejeter
            </Button>
            {isPreparing_ && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                loading={isApproving}
                onClick={onApprove}
              >
                Approuver et activer
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Reject view */
        <div className="space-y-4 p-1">
          <div className="flex items-start gap-2 rounded-lg border border-danger-light bg-danger-light/20 px-3 py-2.5 text-xs text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Cette action est irréversible. Le demandeur sera notifié du rejet.</span>
          </div>
          <Input
            label="Raison du rejet"
            placeholder="ex: Matériel non disponible, informations incomplètes…"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setView('detail')}>Retour</Button>
            <Button
              variant="danger"
              size="sm"
              loading={isRejecting}
              onClick={() => onReject(rejectReason)}
            >
              Confirmer le rejet
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Approvals() {
  const { data: items = [], isLoading } = usePendingApprovals()
  const prepare = usePrepare()
  const approve = useApprove()
  const reject = useReject()
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null)

  const sites = items.filter(i => i.type === 'site')
  const zones = items.filter(i => i.type === 'zone')
  const preparing = items.filter(i => i.approvalStatus === 'PREPARING')

  const handlePrepare = (note?: string) => {
    if (!selectedItem) return
    prepare.mutate(
      { id: selectedItem._id, type: selectedItem.type, note },
      { onSuccess: () => setSelectedItem(prev => prev ? { ...prev, approvalStatus: 'PREPARING', sensorNodeNote: note } : null) }
    )
  }

  const handleApprove = () => {
    if (!selectedItem) return
    approve.mutate({ id: selectedItem._id, type: selectedItem.type }, {
      onSuccess: () => setSelectedItem(null),
    })
  }

  const handleReject = (reason: string) => {
    if (!selectedItem) return
    reject.mutate({ id: selectedItem._id, type: selectedItem.type, reason }, {
      onSuccess: () => setSelectedItem(null),
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Demandes d'approbation"
        subtitle="Valider les nouvelles demandes de création de sites et zones"
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-xs font-semibold text-text-secondary">Total</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-text-primary">{items.length}</div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold text-text-secondary">Sites</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-text-primary">{sites.length}</div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold text-text-secondary">Zones</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-text-primary">{zones.length}</div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-info" />
            <span className="text-xs font-semibold text-text-secondary">En préparation</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-text-primary">{preparing.length}</div>
        </div>
      </div>

      {/* Workflow legend */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-bg px-4 py-2.5 text-xs text-text-secondary">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          Workflow (sites et zones) :{' '}
          <strong>① Demande reçue</strong> — vérifier localisation, polluants, puis assigner un nœud capteur →{' '}
          <strong>② En préparation</strong> — installation physique du capteur →{' '}
          <strong>③ Approuver</strong> pour activer
        </span>
      </div>

      {/* List */}
      <Card>
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-bg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <CheckCircle className="mb-3 h-10 w-10 text-success" />
            <p className="text-sm font-medium text-text-primary">Aucune demande en attente</p>
            <p className="mt-1 text-xs text-text-secondary">Toutes les demandes ont été traitées.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map(item => {
              const pollutants = item.type === 'zone'
                ? (item.pollutants ?? [])
                : (item.initialZone?.pollutants ?? [])

              return (
                <div
                  key={item._id}
                  className="flex cursor-pointer items-start gap-4 p-4 transition-colors hover:bg-bg"
                  onClick={() => setSelectedItem(item)}
                >
                  {/* Icon */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    item.type === 'site' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {item.type === 'site' ? <Building2 className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-text-primary">{item.nom}</span>
                      <Badge variant={item.approvalStatus === 'PREPARING' ? 'info' : 'warning'}>
                        {item.approvalStatus === 'PREPARING'
                          ? '⚙ En préparation'
                          : item.type === 'site' ? 'Nouveau site' : 'Nouvelle zone'}
                      </Badge>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-secondary">
                      {item.industrieId && <span>🏭 {item.industrieId.nom}</span>}
                      {item.siteId && <span>📍 {item.siteId.nom}</span>}
                      {item.localisation?.ville && <span>🗺 {item.localisation.ville}</span>}
                    </div>

                    {pollutants.length > 0 && (
                      <div className="mt-1.5">
                        <PollutantPills codes={pollutants} />
                      </div>
                    )}

                    <div className="mt-1 text-xs text-text-tertiary">
                      {item.approvalRequestedBy && <span>Par {item.approvalRequestedBy.username} · </span>}
                      {item.approvalRequestedAt && formatDateTime(item.approvalRequestedAt)}
                    </div>
                  </div>

                  <div className="shrink-0 text-xs text-accent">Voir détails →</div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {selectedItem && (
        <DetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onPrepare={handlePrepare}
          onApprove={handleApprove}
          onReject={handleReject}
          isPreparing={prepare.isPending}
          isApproving={approve.isPending}
          isRejecting={reject.isPending}
        />
      )}
    </div>
  )
}
