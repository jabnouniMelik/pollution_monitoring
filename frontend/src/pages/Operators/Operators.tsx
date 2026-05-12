import { useState, useEffect } from 'react'
import { UserPlus, Pencil, Trash2, MapPin, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Button } from '@/components/ui/Button/Button'
import { Badge } from '@/components/ui/Badge/Badge'
import { Card } from '@/components/ui/Card/Card'
import { Modal } from '@/components/ui/Modal/Modal'
import { Input } from '@/components/ui/Input/Input'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useUsers, useCreateUser, useDeleteUser, useAssignZones } from '@/features/users/hooks/useUsers'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import type { User } from '@/features/users/types/user.types'
import type { Zone } from '@/features/auth/types/auth.types'
import { Role } from '@/lib/constants/roles'

// ── Operator Create Modal ─────────────────────────────────────
interface CreateModalProps {
  open: boolean
  onClose: () => void
  industryId: string | null
  zones: Zone[]
}

function CreateOperatorModal({ open, onClose, industryId, zones }: CreateModalProps) {
  const createUser = useCreateUser()
  const assignZones = useAssignZones()
  const [form, setForm] = useState({ username: '', email: '', password: '', selectedZones: [] as string[] })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.username.trim()) e.username = 'Requis'
    if (!form.email.trim()) e.email = 'Requis'
    if (!form.email.includes('@')) e.email = 'Email invalide'
    if (form.password.length < 6) e.password = 'Minimum 6 caractères'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    try {
      const newUser = await createUser.mutateAsync({
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: Role.OPERATOR,
        industryId,
      })
      if (form.selectedZones.length > 0) {
        await assignZones.mutateAsync({ id: newUser.id, zoneIds: form.selectedZones })
      }
      setForm({ username: '', email: '', password: '', selectedZones: [] })
      setErrors({})
      onClose()
    } catch {
      // toast handled by hook
    }
  }

  const toggleZone = (zoneId: string) => {
    setForm(f => ({
      ...f,
      selectedZones: f.selectedZones.includes(zoneId)
        ? f.selectedZones.filter(z => z !== zoneId)
        : [...f.selectedZones, zoneId],
    }))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvel opérateur"
      description="Créer un compte opérateur et assigner ses zones"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            size="sm"
            loading={createUser.isPending || assignZones.isPending}
            onClick={handleSubmit}
          >
            Créer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nom d'utilisateur"
          placeholder="operateur_nom"
          value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          error={errors.username}
        />
        <Input
          label="Email"
          type="email"
          placeholder="operateur@site.tn"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          error={errors.email}
        />
        <Input
          label="Mot de passe"
          type="password"
          placeholder="Minimum 6 caractères"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          error={errors.password}
        />

        {zones.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Zones assignées</p>
            <div className="space-y-2">
              {zones.map(zone => (
                <label key={zone._id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-bg">
                  <input
                    type="checkbox"
                    checked={form.selectedZones.includes(zone._id)}
                    onChange={() => toggleZone(zone._id)}
                    className="h-4 w-4 rounded accent-accent"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-primary">{zone.nom}</span>
                    <span className="text-xs text-text-secondary">{zone.code}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Zone Assignment Modal ─────────────────────────────────────
interface ZoneModalProps {
  open: boolean
  onClose: () => void
  operator: User | null
  zones: Zone[]
}

function AssignZonesModal({ open, onClose, operator, zones }: ZoneModalProps) {
  const assignZones = useAssignZones()
  const [selected, setSelected] = useState<string[]>([])

  // Reset selection whenever the modal opens for a (possibly different) operator
  useEffect(() => {
    if (open && operator) {
      // Normalize: zonesAssigned can be string IDs or objects with _id
      const ids = (operator.zonesAssigned ?? []).map((z: any) =>
        typeof z === 'string' ? z : z?._id?.toString() ?? ''
      ).filter(Boolean)
      setSelected(ids)
    }
  }, [open, operator?.id])

  const toggle = (zoneId: string) => {
    setSelected(prev =>
      prev.includes(zoneId) ? prev.filter(z => z !== zoneId) : [...prev, zoneId]
    )
  }

  const handleSave = async () => {
    if (!operator) return
    await assignZones.mutateAsync({ id: operator.id, zoneIds: selected })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Zones — ${operator?.username}`}
      description="Sélectionner les zones assignées à cet opérateur"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            size="sm"
            loading={assignZones.isPending}
            onClick={handleSave}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      {zones.length === 0 ? (
        <p className="text-sm text-text-secondary">Aucune zone disponible.</p>
      ) : (
        <div className="space-y-2">
          {zones.map(zone => {
            const zoneId = zone._id.toString()
            return (
              <label key={zoneId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-bg">
                <input
                  type="checkbox"
                  checked={selected.includes(zoneId)}
                  onChange={() => toggle(zoneId)}
                  className="h-4 w-4 rounded accent-accent"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-text-primary">{zone.nom}</span>
                  <span className="text-xs text-text-secondary">{zone.code}</span>
                </div>
              </label>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────
interface DeleteModalProps {
  open: boolean
  onClose: () => void
  operator: User | null
}

function DeleteOperatorModal({ open, onClose, operator }: DeleteModalProps) {
  const deleteUser = useDeleteUser()

  const handleDelete = async () => {
    if (!operator) return
    await deleteUser.mutateAsync(operator.id)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Supprimer l'opérateur"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteUser.isPending}
            onClick={handleDelete}
          >
            Supprimer
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-primary">
        Supprimer <strong>{operator?.username}</strong> ({operator?.email}) ?
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        L'opérateur sera retiré de toutes ses zones. Cette action est irréversible.
      </p>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Operators() {
  const { user: me } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [assigningZones, setAssigningZones] = useState<User | null>(null)
  const [deletingOp, setDeletingOp] = useState<User | null>(null)

  // Fetch operators (backend filters by role=OPERATOR for SITE_SUPERVISOR)
  const { data, isLoading } = useUsers({ role: Role.OPERATOR })
  const operators = data?.users ?? []

  // Zones available to this supervisor (from their sites)
  const zones: Zone[] = (me?.zonesAssigned ?? []) as Zone[]
  const industryId = typeof me?.industryId === 'object' && me?.industryId !== null
    ? (me.industryId as any)._id ?? null
    : me?.industryId ?? null

  // Map zone IDs to zone objects for display
  const zoneMap = new Map(zones.map(z => [z._id, z]))

  const getZoneNames = (zoneIds: string[]) => {
    if (!zoneIds?.length) return null
    return zoneIds
      .map(id => zoneMap.get(id)?.nom ?? id)
      .join(', ')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mes Opérateurs"
        subtitle="Gérer les opérateurs assignés à votre site"
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Nouvel opérateur
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="space-y-3 p-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-secondary" />
            ))}
          </div>
        ) : operators.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <ShieldCheck className="mb-3 h-10 w-10 text-text-tertiary" />
            <p className="text-sm font-medium text-text-primary">Aucun opérateur</p>
            <p className="mt-1 text-xs text-text-secondary">
              Créez votre premier opérateur pour commencer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Zones assignées</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {operators.map(op => (
                  <tr key={op.id} className="hover:bg-bg">
                    <td className="px-4 py-3 font-medium text-text-primary">{op.username}</td>
                    <td className="px-4 py-3 text-text-secondary">{op.email}</td>
                    <td className="px-4 py-3">
                      {op.zonesAssigned?.length ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
                          <span className="text-text-primary">
                            {getZoneNames(op.zonesAssigned as string[]) ?? '—'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-tertiary">Aucune zone</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={op.isActive ? 'success' : 'neutral'}>
                        {op.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<MapPin className="h-3.5 w-3.5" />}
                          onClick={() => setAssigningZones(op)}
                          title="Gérer les zones"
                        >
                          Zones
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 className="h-3.5 w-3.5 text-danger" />}
                          onClick={() => setDeletingOp(op)}
                          title="Supprimer"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateOperatorModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        industryId={industryId}
        zones={zones}
      />

      <AssignZonesModal
        open={Boolean(assigningZones)}
        onClose={() => setAssigningZones(null)}
        operator={assigningZones}
        zones={zones}
      />

      <DeleteOperatorModal
        open={Boolean(deletingOp)}
        onClose={() => setDeletingOp(null)}
        operator={deletingOp}
      />
    </div>
  )
}
