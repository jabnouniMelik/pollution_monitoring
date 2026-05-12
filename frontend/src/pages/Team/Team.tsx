import { useState, useEffect } from 'react'
import { UserPlus, Trash2, MapPin, Building2, Users, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Button } from '@/components/ui/Button/Button'
import { Badge } from '@/components/ui/Badge/Badge'
import { Card } from '@/components/ui/Card/Card'
import { Modal } from '@/components/ui/Modal/Modal'
import { Input } from '@/components/ui/Input/Input'
import { Select } from '@/components/ui/Select/Select'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useUsers, useCreateUser, useDeleteUser, useAssignZones, useAssignSites } from '@/features/users/hooks/useUsers'
import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import { ROLE_LABELS, Role } from '@/lib/constants/roles'
import type { User } from '@/features/users/types/user.types'
import type { Zone, Site } from '@/features/auth/types/auth.types'

// ── Role badge variant ────────────────────────────────────────
function roleBadgeVariant(role: string) {
  if (role === 'HEAD_SUPERVISOR') return 'info' as const
  if (role === 'SITE_SUPERVISOR') return 'warning' as const
  if (role === 'OPERATOR') return 'neutral' as const
  return 'neutral' as const
}

// ── Fetch zones for a site ────────────────────────────────────
async function fetchZonesBySite(siteId: string): Promise<Zone[]> {
  try {
    const resp = await api.get<ApiSuccess<Zone[]>>(endpoints.zones.bySite(siteId))
    return unwrap(resp.data) ?? []
  } catch {
    return []
  }
}

// ── Create User Modal ─────────────────────────────────────────
interface CreateModalProps {
  open: boolean
  onClose: () => void
  industryId: string | null
  sites: Site[]
  allZones: Zone[]
}

function CreateUserModal({ open, onClose, industryId, sites, allZones }: CreateModalProps) {
  const createUser = useCreateUser()
  const assignZones = useAssignZones()
  const assignSites = useAssignSites()

  const [form, setForm] = useState({
    username: '', email: '', password: '',
    role: Role.OPERATOR as Role,
    selectedSiteId: '',       // for OPERATOR: which site to pick zones from
    selectedZones: [] as string[],
    selectedSites: [] as string[], // for SITE_SUPERVISOR
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [siteZones, setSiteZones] = useState<Zone[]>([])
  const [loadingZones, setLoadingZones] = useState(false)

  // Reset on open
  useEffect(() => {
    if (open) {
      setForm({ username: '', email: '', password: '', role: Role.OPERATOR, selectedSiteId: '', selectedZones: [], selectedSites: [] })
      setErrors({})
      setSiteZones([])
    }
  }, [open])

  // Load zones when site changes (for OPERATOR)
  useEffect(() => {
    if (form.role === Role.OPERATOR && form.selectedSiteId) {
      setLoadingZones(true)
      fetchZonesBySite(form.selectedSiteId).then(zones => {
        setSiteZones(zones)
        setForm(f => ({ ...f, selectedZones: [] }))
        setLoadingZones(false)
      })
    } else {
      setSiteZones([])
    }
  }, [form.selectedSiteId, form.role])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.username.trim()) e.username = 'Requis'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Email invalide'
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
        role: form.role,
        industryId,
      })
      // Assign zones for OPERATOR
      if (form.role === Role.OPERATOR && form.selectedZones.length > 0) {
        await assignZones.mutateAsync({ id: newUser.id, zoneIds: form.selectedZones })
      }
      // Assign sites for SITE_SUPERVISOR
      if (form.role === Role.SITE_SUPERVISOR && form.selectedSites.length > 0) {
        await assignSites.mutateAsync({ id: newUser.id, siteIds: form.selectedSites })
      }
      onClose()
    } catch {
      // toast handled by hook
    }
  }

  const toggleZone = (id: string) =>
    setForm(f => ({ ...f, selectedZones: f.selectedZones.includes(id) ? f.selectedZones.filter(z => z !== id) : [...f.selectedZones, id] }))

  const toggleSite = (id: string) =>
    setForm(f => ({ ...f, selectedSites: f.selectedSites.includes(id) ? f.selectedSites.filter(s => s !== id) : [...f.selectedSites, id] }))

  const roleOptions = [
    { value: Role.OPERATOR, label: 'Opérateur' },
    { value: Role.SITE_SUPERVISOR, label: 'Responsable site' },
    { value: Role.HEAD_SUPERVISOR, label: 'Responsable industrie' },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvel utilisateur"
      description="Créer un compte et configurer les accès"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button variant="primary" size="sm" loading={createUser.isPending} onClick={handleSubmit}>
            Créer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Nom d'utilisateur" placeholder="nom_utilisateur"
          value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} error={errors.username} />
        <Input label="Email" type="email" placeholder="utilisateur@industrie.tn"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} error={errors.email} />
        <Input label="Mot de passe" type="password" placeholder="Minimum 6 caractères"
          value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} error={errors.password} />

        <Select label="Rôle" options={roleOptions} value={form.role}
          onChange={e => setForm(f => ({ ...f, role: e.target.value as Role, selectedSiteId: '', selectedZones: [], selectedSites: [] }))} />

        {/* OPERATOR: pick site then zones */}
        {form.role === Role.OPERATOR && (
          <>
            {sites.length > 0 && (
              <Select
                label="Site (pour choisir les zones)"
                options={[{ value: '', label: '— Choisir un site —' }, ...sites.map(s => ({ value: s._id, label: s.nom }))]}
                value={form.selectedSiteId}
                onChange={e => setForm(f => ({ ...f, selectedSiteId: e.target.value }))}
              />
            )}
            {form.selectedSiteId && (
              <div>
                <p className="mb-2 text-sm font-medium text-text-secondary">
                  Zones assignées {loadingZones ? '(chargement…)' : `(${siteZones.length} disponibles)`}
                </p>
                {siteZones.length === 0 && !loadingZones && (
                  <p className="text-xs text-text-tertiary">Aucune zone dans ce site.</p>
                )}
                <div className="space-y-2">
                  {siteZones.map(zone => (
                    <label key={zone._id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-bg">
                      <input type="checkbox" checked={form.selectedZones.includes(zone._id)}
                        onChange={() => toggleZone(zone._id)} className="h-4 w-4 rounded accent-accent" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-text-primary">{zone.nom}</span>
                        <span className="text-xs text-text-secondary">{zone.code}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* SITE_SUPERVISOR: pick sites */}
        {form.role === Role.SITE_SUPERVISOR && sites.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Sites assignés</p>
            <div className="space-y-2">
              {sites.map(site => (
                <label key={site._id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-bg">
                  <input type="checkbox" checked={form.selectedSites.includes(site._id)}
                    onChange={() => toggleSite(site._id)} className="h-4 w-4 rounded accent-accent" />
                  <span className="text-sm font-medium text-text-primary">{site.nom}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* HEAD_SUPERVISOR: no extra assignment needed */}
        {form.role === Role.HEAD_SUPERVISOR && (
          <p className="text-xs text-text-secondary rounded-lg bg-surface-secondary p-3">
            Le responsable industrie aura accès à tous les sites et zones de l'industrie.
          </p>
        )}
      </div>
    </Modal>
  )
}

// ── Edit Assignments Modal ────────────────────────────────────
interface EditModalProps {
  open: boolean
  onClose: () => void
  member: User | null
  sites: Site[]
  allZones: Zone[]
}

function EditAssignmentsModal({ open, onClose, member, sites, allZones }: EditModalProps) {
  const assignZones = useAssignZones()
  const assignSites = useAssignSites()
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [siteZones, setSiteZones] = useState<Zone[]>([])
  const [loadingZones, setLoadingZones] = useState(false)

  useEffect(() => {
    if (open && member) {
      const zones = (member.zonesAssigned ?? []).map((z: any) =>
        typeof z === 'string' ? z : z?._id?.toString() ?? '')
      const sitesArr = (member.sitesManaging ?? []).map((s: any) =>
        typeof s === 'string' ? s : s?._id?.toString() ?? '')
      setSelectedZones(zones)
      setSelectedSites(sitesArr)
      setSelectedSiteId('')
      setSiteZones([])
    }
  }, [open, member?.id])

  useEffect(() => {
    if (selectedSiteId) {
      setLoadingZones(true)
      fetchZonesBySite(selectedSiteId).then(zones => {
        setSiteZones(zones)
        setLoadingZones(false)
      })
    }
  }, [selectedSiteId])

  const handleSave = async () => {
    if (!member) return
    if (member.role === 'OPERATOR') {
      await assignZones.mutateAsync({ id: member.id, zoneIds: selectedZones })
    } else if (member.role === 'SITE_SUPERVISOR') {
      await assignSites.mutateAsync({ id: member.id, siteIds: selectedSites })
    }
    onClose()
  }

  if (!member) return null
  const isOperator = member.role === 'OPERATOR'
  const isSiteSupervisor = member.role === 'SITE_SUPERVISOR'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isOperator ? `Zones — ${member.username}` : `Sites — ${member.username}`}
      description={isOperator ? 'Modifier les zones assignées' : 'Modifier les sites assignés'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button variant="primary" size="sm"
            loading={assignZones.isPending || assignSites.isPending} onClick={handleSave}>
            Enregistrer
          </Button>
        </>
      }
    >
      {isOperator && (
        <div className="space-y-3">
          <Select
            label="Site"
            options={[{ value: '', label: '— Choisir un site —' }, ...sites.map(s => ({ value: s._id, label: s.nom }))]}
            value={selectedSiteId}
            onChange={e => setSelectedSiteId(e.target.value)}
          />
          {selectedSiteId && (
            <div className="space-y-2">
              {loadingZones && <p className="text-xs text-text-secondary">Chargement…</p>}
              {siteZones.map(zone => {
                const zid = zone._id.toString()
                return (
                  <label key={zid} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-bg">
                    <input type="checkbox" checked={selectedZones.includes(zid)}
                      onChange={() => setSelectedZones(prev => prev.includes(zid) ? prev.filter(z => z !== zid) : [...prev, zid])}
                      className="h-4 w-4 rounded accent-accent" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-text-primary">{zone.nom}</span>
                      <span className="text-xs text-text-secondary">{zone.code}</span>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
          {!selectedSiteId && (
            <p className="text-xs text-text-secondary">Sélectionnez un site pour voir ses zones.</p>
          )}
        </div>
      )}

      {isSiteSupervisor && (
        <div className="space-y-2">
          {sites.map(site => {
            const sid = site._id.toString()
            return (
              <label key={sid} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-bg">
                <input type="checkbox" checked={selectedSites.includes(sid)}
                  onChange={() => setSelectedSites(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid])}
                  className="h-4 w-4 rounded accent-accent" />
                <span className="text-sm font-medium text-text-primary">{site.nom}</span>
              </label>
            )
          })}
        </div>
      )}

      {!isOperator && !isSiteSupervisor && (
        <p className="text-sm text-text-secondary">
          Les responsables industrie ont accès à toute l'industrie automatiquement.
        </p>
      )}
    </Modal>
  )
}

// ── Delete Confirm ────────────────────────────────────────────
function DeleteModal({ open, onClose, member }: { open: boolean; onClose: () => void; member: User | null }) {
  const deleteUser = useDeleteUser()
  return (
    <Modal open={open} onClose={onClose} title="Supprimer l'utilisateur" size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button variant="danger" size="sm" loading={deleteUser.isPending}
            onClick={async () => { if (member) { await deleteUser.mutateAsync(member.id); onClose() } }}>
            Supprimer
          </Button>
        </>
      }>
      <p className="text-sm text-text-primary">
        Supprimer <strong>{member?.username}</strong> ({member?.email}) ?
      </p>
      <p className="mt-1 text-xs text-text-secondary">Cette action est irréversible.</p>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────
const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'Tous les rôles' },
  { value: Role.OPERATOR, label: 'Opérateurs' },
  { value: Role.SITE_SUPERVISOR, label: 'Responsables site' },
  { value: Role.HEAD_SUPERVISOR, label: 'Responsables industrie' },
]

export default function Team() {
  const { user: me } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')

  const { data, isLoading } = useUsers(roleFilter ? { role: roleFilter } : {})
  const members = data?.users ?? []

  const sites: Site[] = (me?.sitesManaging || []) as Site[]
  const allZones: Zone[] = (me?.zonesAssigned || []) as Zone[]
  const industryId = typeof me?.industryId === 'object' && me?.industryId !== null
    ? (me.industryId as any)._id ?? null
    : me?.industryId ?? null

  // Build zone/site maps for display
  const zoneMap = new Map(allZones.map(z => [z._id, z]))
  const siteMap = new Map(sites.map(s => [s._id, s]))

  const getZoneNames = (ids: string[]) =>
    ids.map(id => zoneMap.get(id)?.nom ?? '?').join(', ') || '—'

  const getSiteNames = (ids: string[]) =>
    ids.map(id => siteMap.get(id)?.nom ?? '?').join(', ') || '—'

  const canEdit = (u: User) => u.role !== 'HEAD_SUPERVISOR'

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mon Équipe"
        subtitle="Gérer les utilisateurs de votre industrie"
        actions={
          <Button variant="primary" size="sm" leftIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}>
            Nouvel utilisateur
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select
          aria-label="Filtrer par rôle"
          options={ROLE_FILTER_OPTIONS}
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as Role | '')}
        />
        <span className="text-sm text-text-secondary">
          {members.length} utilisateur{members.length !== 1 ? 's' : ''}
        </span>
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-3 p-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-secondary" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Users className="mb-3 h-10 w-10 text-text-tertiary" />
            <p className="text-sm font-medium text-text-primary">Aucun utilisateur</p>
            <p className="mt-1 text-xs text-text-secondary">Créez votre premier utilisateur.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Assignations</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map(m => (
                  <tr key={m.id} className="hover:bg-bg">
                    <td className="px-4 py-3 font-medium text-text-primary">{m.username}</td>
                    <td className="px-4 py-3 text-text-secondary">{m.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={roleBadgeVariant(m.role)}>
                        {ROLE_LABELS[m.role as Role] ?? m.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {m.role === 'OPERATOR' && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <MapPin className="h-3 w-3 shrink-0 text-accent" />
                          <span className="truncate">{getZoneNames(m.zonesAssigned as string[] ?? [])}</span>
                        </div>
                      )}
                      {m.role === 'SITE_SUPERVISOR' && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <Building2 className="h-3 w-3 shrink-0 text-accent" />
                          <span className="truncate">{getSiteNames(m.sitesManaging as string[] ?? [])}</span>
                        </div>
                      )}
                      {m.role === 'HEAD_SUPERVISOR' && (
                        <span className="text-xs text-text-tertiary">Toute l'industrie</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={m.isActive ? 'success' : 'neutral'}>
                        {m.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit(m) && (
                          <Button variant="ghost" size="sm"
                            leftIcon={m.role === 'OPERATOR' ? <MapPin className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                            onClick={() => setEditing(m)}>
                            {m.role === 'OPERATOR' ? 'Zones' : 'Sites'}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm"
                          leftIcon={<Trash2 className="h-3.5 w-3.5 text-danger" />}
                          onClick={() => setDeleting(m)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        industryId={industryId}
        sites={sites}
        allZones={allZones}
      />

      <EditAssignmentsModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        member={editing}
        sites={sites}
        allZones={allZones}
      />

      <DeleteModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        member={deleting}
      />
    </div>
  )
}
