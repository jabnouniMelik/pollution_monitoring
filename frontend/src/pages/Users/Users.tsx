import { useEffect, useState } from 'react'
import { UserPlus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { Select } from '@/components/ui/Select/Select'
import { Badge } from '@/components/ui/Badge/Badge'
import { Card } from '@/components/ui/Card/Card'
import { Skeleton } from '@/components/ui/Skeleton/Skeleton'
import { Modal } from '@/components/ui/Modal/Modal'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  useUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useChangeUserRole, useAssignZones, useAssignSites,
} from '@/features/users/hooks/useUsers'
import { Role, ROLE_LABELS, ROLE_LEVELS } from '@/lib/constants/roles'
import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type {
  User, UserFilters, CreateUserInput,
  PopulatedIndustry, PopulatedSite, PopulatedZone,
} from '@/features/users/types/user.types'

// ── Helpers ───────────────────────────────────────────────────
function getIndustry(u: User): PopulatedIndustry | null {
  if (!u.industryId) return null
  if (typeof u.industryId === 'object') return u.industryId as PopulatedIndustry
  return null
}
function getSites(u: User): PopulatedSite[] {
  if (!u.sitesManaging) return []
  return (u.sitesManaging as any[]).filter(s => typeof s === 'object') as PopulatedSite[]
}
function getZones(u: User): PopulatedZone[] {
  if (!u.zonesAssigned) return []
  return (u.zonesAssigned as any[]).filter(z => typeof z === 'object') as PopulatedZone[]
}
function roleBadge(role: Role): 'info' | 'warning' | 'neutral' | 'danger' | 'success' {
  const map: Record<Role, 'info' | 'warning' | 'neutral' | 'danger' | 'success'> = {
    SUPER_ADMIN: 'danger', HEAD_SUPERVISOR: 'info',
    SITE_SUPERVISOR: 'warning', AUDITOR: 'success', OPERATOR: 'neutral',
  }
  return map[role] ?? 'neutral'
}

// ── Assignment cell ───────────────────────────────────────────
function AssignmentCell({ user }: { user: User }) {
  const industry = getIndustry(user)
  const sites = getSites(user)
  const zones = getZones(user)

  if (user.role === 'SUPER_ADMIN') return <span className="text-xs text-text-tertiary">Acces global</span>

  // For OPERATOR: derive sites from their zones' siteId (populated)
  const operatorSites = user.role === 'OPERATOR'
    ? Array.from(
        new Map(
          zones
            .map(z => z.siteId)
            .filter((s): s is { _id: string; nom: string } => !!s && typeof s === 'object' && 'nom' in s)
            .map(s => [s._id, s])
        ).values()
      )
    : []

  const displaySites = user.role === 'OPERATOR' ? operatorSites : sites

  return (
    <div className="space-y-0.5 text-xs">
      {/* Industry */}
      {industry
        ? <div className="flex items-center gap-1 text-text-secondary"><span>🏭</span><span>{industry.nom}</span></div>
        : <span className="italic text-text-tertiary">Aucune industrie</span>}

      {/* Sites — SITE_SUPERVISOR uses sitesManaging, OPERATOR derives from zones */}
      {(user.role === 'SITE_SUPERVISOR' || user.role === 'OPERATOR') && (
        displaySites.length > 0
          ? <div className="flex flex-wrap gap-1">
              {displaySites.map(s => (
                <span key={s._id} className="rounded bg-bg px-1.5 py-0.5 text-[10px] text-text-secondary">
                  {s.nom}
                </span>
              ))}
            </div>
          : <span className="italic text-text-tertiary">Aucun site</span>
      )}

      {/* Zones — OPERATOR only */}
      {user.role === 'OPERATOR' && (
        zones.length > 0
          ? <div className="flex flex-wrap gap-1">
              {zones.map(z => (
                <span key={z._id} className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                  {z.code}
                </span>
              ))}
            </div>
          : <span className="italic text-text-tertiary">Aucune zone</span>
      )}
    </div>
  )
}

// ── User Modal (Create / Edit) ────────────────────────────────
interface UserModalProps {
  user?: User | null
  onClose: () => void
  viewerRole: Role
}

function UserModal({ user, onClose, viewerRole }: UserModalProps) {
  const isEdit = !!user
  const { user: viewer } = useAuth()
  // Use both the prop AND the live auth store — whichever confirms SUPER_ADMIN
  const isSuperAdmin = viewerRole === 'SUPER_ADMIN' || viewer?.role === 'SUPER_ADMIN'
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const changeRole = useChangeUserRole()
  const assignZones = useAssignZones()
  const assignSites = useAssignSites()

  const assignableRoles = (() => {
    if (viewerRole === 'SUPER_ADMIN') return Object.values(Role)
    if (viewerRole === 'HEAD_SUPERVISOR') return [Role.OPERATOR, Role.SITE_SUPERVISOR, Role.HEAD_SUPERVISOR]
    return [Role.OPERATOR]
  })()

  const [form, setForm] = useState({
    username: user?.username ?? '',
    email: user?.email ?? '',
    password: '',
    role: (user?.role ?? Role.OPERATOR) as Role,
    selectedIndustryId: (() => {
      // Pre-fill industry when editing a HEAD_SUPERVISOR
      if (user?.industryId) {
        if (typeof user.industryId === 'object') return (user.industryId as PopulatedIndustry)._id
        if (typeof user.industryId === 'string') return user.industryId
      }
      return ''
    })(),
    selectedSiteId: '',
    selectedZones: getZones(user ?? {} as User).map(z => z._id),
    selectedSites: getSites(user ?? {} as User).map(s => s._id),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Cascade data
  const [industries, setIndustries] = useState<{ _id: string; nom: string; secteur: string }[]>([])
  const [sitesForIndustry, setSitesForIndustry] = useState<PopulatedSite[]>([])
  const [zonesForSite, setZonesForSite] = useState<PopulatedZone[]>([])
  const [allSites, setAllSites] = useState<PopulatedSite[]>([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [loadingZones, setLoadingZones] = useState(false)

  const needsZoneAssignment = form.role === Role.OPERATOR
  const needsSiteAssignment = form.role === Role.SITE_SUPERVISOR
  const needsIndustryAssignment = isSuperAdmin && form.role === Role.HEAD_SUPERVISOR

  // Load industries on mount — always needed for HEAD_SUPERVISOR assignment
  useEffect(() => {
    api.get<ApiSuccess<any[]>>(endpoints.industries.base)
      .then(r => setIndustries((unwrap(r.data) ?? []).map((i: any) => ({
        _id: i._id || i.id, nom: i.nom, secteur: i.secteur,
      }))))
      .catch(() => {})
  }, [])

  // SUPER_ADMIN: load sites when industry selected
  useEffect(() => {
    if (!isSuperAdmin || !form.selectedIndustryId) {
      setSitesForIndustry([])
      setZonesForSite([])
      return
    }
    setLoadingSites(true)
    api.get<ApiSuccess<any[]>>(endpoints.sites.byIndustry(form.selectedIndustryId))
      .then(r => {
        setSitesForIndustry((unwrap(r.data) ?? []).map((s: any) => ({
          _id: s._id || s.id, nom: s.nom, localisation: s.localisation,
        })))
        setLoadingSites(false)
      })
      .catch(() => setLoadingSites(false))
  }, [form.selectedIndustryId, isSuperAdmin])

  // Non-SUPER_ADMIN: load sites scoped to their industry
  useEffect(() => {
    if (isSuperAdmin) return
    api.get<ApiSuccess<any[]>>(endpoints.sites.base)
      .then(r => setAllSites((unwrap(r.data) ?? []).map((s: any) => ({
        _id: s._id || s.id, nom: s.nom, localisation: s.localisation,
      }))))
      .catch(() => {})
  }, [isSuperAdmin])

  // Load zones when site selected
  useEffect(() => {
    if (!form.selectedSiteId) { setZonesForSite([]); return }
    setLoadingZones(true)
    api.get<ApiSuccess<any[]>>(endpoints.zones.bySite(form.selectedSiteId))
      .then(r => {
        setZonesForSite((unwrap(r.data) ?? []).map((z: any) => ({
          _id: z._id || z.id, code: z.code, nom: z.nom,
        })))
        setLoadingZones(false)
      })
      .catch(() => setLoadingZones(false))
  }, [form.selectedSiteId])

  const toggleZone = (id: string) =>
    setForm(f => ({
      ...f,
      selectedZones: f.selectedZones.includes(id)
        ? f.selectedZones.filter(z => z !== id)
        : [...f.selectedZones, id],
    }))

  const toggleSite = (id: string) =>
    setForm(f => ({
      ...f,
      selectedSites: f.selectedSites.includes(id)
        ? f.selectedSites.filter(s => s !== id)
        : [...f.selectedSites, id],
    }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.username.trim()) e.username = 'Requis'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Email invalide'
    if (!isEdit && form.password.length < 6) e.password = 'Minimum 6 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    try {
      if (isEdit && user) {
        if (form.role !== user.role) await changeRole.mutateAsync({ id: user.id, role: form.role })
        await updateUser.mutateAsync({
          id: user.id,
          input: {
            username: form.username,
            email: form.email,
            // HEAD_SUPERVISOR: set industryId from cascade selector
            ...(needsIndustryAssignment && form.selectedIndustryId
              ? { industryId: form.selectedIndustryId }
              : {}),
            // SITE_SUPERVISOR: set industryId from the selected industry in cascade
            ...(needsSiteAssignment && form.selectedIndustryId
              ? { industryId: form.selectedIndustryId }
              : {}),
          },
        })
        if (needsZoneAssignment && form.selectedZones.length > 0)
          await assignZones.mutateAsync({ id: user.id, zoneIds: form.selectedZones })
        if (needsSiteAssignment && form.selectedSites.length > 0)
          await assignSites.mutateAsync({ id: user.id, siteIds: form.selectedSites })
      } else {
        const industryId = isSuperAdmin
          ? (form.selectedIndustryId || null)
          : (typeof viewer?.industryId === 'object'
              ? (viewer.industryId as any)?._id
              : viewer?.industryId ?? null)
        const newUser = await createUser.mutateAsync({
          username: form.username.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          industryId,
        } as CreateUserInput)
        if (needsZoneAssignment && form.selectedZones.length > 0)
          await assignZones.mutateAsync({ id: newUser.id, zoneIds: form.selectedZones })
        if (needsSiteAssignment && form.selectedSites.length > 0)
          await assignSites.mutateAsync({ id: newUser.id, siteIds: form.selectedSites })
      }
      onClose()
    } catch { /* toast handled by hooks */ }
  }

  const isLoading = createUser.isPending || updateUser.isPending || changeRole.isPending
    || assignZones.isPending || assignSites.isPending

  // Sites to show in step 2
  const sitesStep2 = isSuperAdmin ? sitesForIndustry : allSites

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Modifier — ${user?.username}` : 'Nouvel utilisateur'}
      description={isEdit ? user?.email : 'Creer un compte utilisateur'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button variant="primary" size="sm" loading={isLoading} onClick={handleSubmit}>
            {isEdit ? 'Enregistrer' : 'Creer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nom d'utilisateur"
            placeholder="jean_dupont"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            error={errors.username}
          />
          <Input
            label="Email"
            type="email"
            placeholder="jean@example.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            error={errors.email}
          />
        </div>

        {!isEdit && (
          <Input
            label="Mot de passe"
            type="password"
            placeholder="••••••"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            error={errors.password}
          />
        )}

        {/* Role */}
        <Select
          label="Role"
          value={form.role}
          onChange={e => setForm(f => ({
            ...f,
            role: e.target.value as Role,
            selectedZones: [],
            selectedSites: [],
            selectedSiteId: '',
            selectedIndustryId: '',
          }))}
          options={assignableRoles.map(r => ({ value: r, label: ROLE_LABELS[r] }))}
        />

        {/* HEAD_SUPERVISOR: industry assignment (SUPER_ADMIN only) */}
        {needsIndustryAssignment && (
          <div className="space-y-2 rounded-lg border border-border bg-bg p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Industrie assignee
            </p>
            <select
              value={form.selectedIndustryId}
              onChange={e => setForm(f => ({ ...f, selectedIndustryId: e.target.value }))}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">
                {industries.length === 0 ? 'Chargement...' : '— Choisir une industrie —'}
              </option>
              {industries.map(i => (
                <option key={i._id} value={i._id}>{i.nom} · {i.secteur}</option>
              ))}
            </select>
            {form.selectedIndustryId && (
              <p className="text-xs text-success">
                ✓ {industries.find(i => i._id === form.selectedIndustryId)?.nom}
              </p>
            )}
          </div>
        )}

        {/* Assignment section — only for OPERATOR and SITE_SUPERVISOR */}
        {(needsZoneAssignment || needsSiteAssignment) && (
          <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {needsZoneAssignment ? 'Assignation des zones' : 'Assignation des sites'}
            </p>

            {/* Step 1: Industry (SUPER_ADMIN only) */}
            {isSuperAdmin && (
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  1. Industrie
                </label>
                <select
                  value={form.selectedIndustryId}
                  onChange={e => setForm(f => ({
                    ...f,
                    selectedIndustryId: e.target.value,
                    selectedSiteId: '',
                    selectedZones: [],
                    selectedSites: [],
                  }))}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">— Choisir une industrie —</option>
                  {industries.map(i => (
                    <option key={i._id} value={i._id}>{i.nom} · {i.secteur}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Step 2: Site — shown when industry selected (SUPER_ADMIN) or always (others) */}
            {(!isSuperAdmin || form.selectedIndustryId) && (
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  {isSuperAdmin ? '2. Site' : 'Site'}
                </label>
                {loadingSites ? (
                  <div className="h-9 animate-pulse rounded-lg bg-border" />
                ) : sitesStep2.length === 0 ? (
                  <p className="text-xs text-text-tertiary">
                    {isSuperAdmin ? 'Aucun site dans cette industrie' : 'Aucun site disponible'}
                  </p>
                ) : needsZoneAssignment ? (
                  /* OPERATOR: single site selector to then load zones */
                  <select
                    value={form.selectedSiteId}
                    onChange={e => setForm(f => ({ ...f, selectedSiteId: e.target.value, selectedZones: [] }))}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">— Choisir un site —</option>
                    {sitesStep2.map(s => (
                      <option key={s._id} value={s._id}>{s.nom}</option>
                    ))}
                  </select>
                ) : (
                  /* SITE_SUPERVISOR: multi-select sites */
                  <div className="flex flex-wrap gap-2">
                    {sitesStep2.map(s => {
                      const sel = form.selectedSites.includes(s._id)
                      return (
                        <button
                          key={s._id}
                          type="button"
                          onClick={() => toggleSite(s._id)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            sel
                              ? 'border-accent bg-accent text-white'
                              : 'border-border bg-white text-text-secondary hover:border-accent hover:text-accent'
                          }`}
                        >
                          {s.nom}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Zones — OPERATOR only, after site selected */}
            {needsZoneAssignment && form.selectedSiteId && (
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  {isSuperAdmin ? '3. Zones' : 'Zones'}
                </label>
                {loadingZones ? (
                  <div className="h-9 animate-pulse rounded-lg bg-border" />
                ) : zonesForSite.length === 0 ? (
                  <p className="text-xs text-text-tertiary">Aucune zone dans ce site</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {zonesForSite.map(z => {
                      const sel = form.selectedZones.includes(z._id)
                      return (
                        <button
                          key={z._id}
                          type="button"
                          onClick={() => toggleZone(z._id)}
                          className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                            sel
                              ? 'border-accent bg-accent text-white'
                              : 'border-border bg-white text-text-secondary hover:border-accent hover:text-accent'
                          }`}
                        >
                          {z.code} — {z.nom}
                        </button>
                      )
                    })}
                  </div>
                )}
                {form.selectedZones.length > 0 && (
                  <p className="mt-1.5 text-xs text-text-secondary">
                    {form.selectedZones.length} zone{form.selectedZones.length > 1 ? 's' : ''} selectionnee{form.selectedZones.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Summary for SITE_SUPERVISOR */}
            {needsSiteAssignment && form.selectedSites.length > 0 && (
              <p className="text-xs text-text-secondary">
                {form.selectedSites.length} site{form.selectedSites.length > 1 ? 's' : ''} selectionne{form.selectedSites.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Delete Confirm ────────────────────────────────────────────
function DeleteConfirm({ user, onClose }: { user: User; onClose: () => void }) {
  const deleteUser = useDeleteUser()
  return (
    <Modal
      open
      onClose={onClose}
      title="Supprimer l'utilisateur"
      description={user.email}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteUser.isPending}
            onClick={() => deleteUser.mutate(user.id, { onSuccess: onClose })}
          >
            Supprimer
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">
        Etes-vous sur de vouloir supprimer <strong>{user.username}</strong> ? Cette action est irreversible.
      </p>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Users() {
  const { user: viewer } = useAuth()
  const viewerRole = viewer?.role ?? Role.OPERATOR

  const [filters, setFilters] = useState<UserFilters>({ page: 1, pageSize: 15 })
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setFilters(f => ({ ...f, search: search || undefined, page: 1 })), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useUsers({ ...filters, role: roleFilter as any || undefined })

  const users = data?.users ?? []
  const total = data?.total ?? 0
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 15
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const filterableRoles = Object.values(Role).filter(r => ROLE_LEVELS[r] <= ROLE_LEVELS[viewerRole])
  const canCreate = ['SUPER_ADMIN', 'HEAD_SUPERVISOR', 'SITE_SUPERVISOR'].includes(viewerRole)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestion Utilisateurs"
        subtitle="Tous les utilisateurs — affichage et assignations selon la hierarchie"
        actions={
          canCreate ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserPlus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              Nouvel utilisateur
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <Select
          aria-label="Filtrer par role"
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setFilters(f => ({ ...f, page: 1 })) }}
          options={[{ value: '', label: 'Tous les roles' }, ...filterableRoles.map(r => ({ value: r, label: ROLE_LABELS[r] }))]}
        />
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-secondary">Aucun utilisateur trouve</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-bg text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Assignation</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-bg">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{u.username}</div>
                      <div className="text-xs text-text-secondary">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={roleBadge(u.role)}>{ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      <AssignmentCell user={u} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.isActive ? 'success' : 'neutral'}>
                        {u.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          title="Modifier"
                          onClick={() => setEditingUser(u)}
                          className="rounded p-1.5 text-text-secondary transition-colors hover:bg-bg hover:text-accent"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {u.id !== viewer?.userId && ROLE_LEVELS[u.role] <= ROLE_LEVELS[viewerRole] && (
                          <button
                            type="button"
                            title="Supprimer"
                            onClick={() => setDeletingUser(u)}
                            className="rounded p-1.5 text-text-secondary transition-colors hover:bg-danger-light hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>{total} utilisateur{total > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="rounded p-1.5 hover:bg-bg disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="rounded p-1.5 hover:bg-bg disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {createOpen && <UserModal viewerRole={viewerRole} onClose={() => setCreateOpen(false)} />}
      {editingUser && <UserModal user={editingUser} viewerRole={viewerRole} onClose={() => setEditingUser(null)} />}
      {deletingUser && <DeleteConfirm user={deletingUser} onClose={() => setDeletingUser(null)} />}
    </div>
  )
}
