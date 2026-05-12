import { useEffect, useState } from "react"
import { ChevronRight, Building2, MapPin, Layers, ArrowLeft, FlaskConical, Cpu, Plus, Pencil, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader/PageHeader"
import { Card } from "@/components/ui/Card/Card"
import { Badge } from "@/components/ui/Badge/Badge"
import { Skeleton } from "@/components/ui/Skeleton/Skeleton"
import { Button } from "@/components/ui/Button/Button"
import { PermissionGate } from "@/components/common/PermissionGate/PermissionGate"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { api, unwrap } from "@/lib/api/axios"
import { endpoints } from "@/lib/api/endpoints"
import { POLLUTANTS } from "@/lib/constants/pollutants"
import { SiteCreateModal } from "@/pages/Sites/SiteCreateModal"
import { SiteEditModal } from "@/pages/Sites/SiteEditModal"
import { SiteDeleteConfirm } from "@/pages/Sites/SiteDeleteConfirm"
import { ZoneCreateModal } from "@/pages/Zones/ZoneCreateModal"
import { ZoneEditModal } from "@/pages/Zones/ZoneEditModal"
import { ZoneDeleteConfirm } from "@/pages/Zones/ZoneDeleteConfirm"
import type { Site as SiteType } from "@/features/sites"
import type { Zone as ZoneType } from "@/features/zones"
import { useKPISummary } from "@/features/kpi/hooks/useKPISummary"

interface Industry { _id: string; nom: string; secteur: string; localisation?: { ville?: string }; actif: boolean }
interface Site { _id: string; id: string; nom: string; description?: string; actif: boolean; zoneCount: number; localisation?: { ville?: string; adresse?: string }; supervisorId?: any; approvalStatus?: string }
interface Zone { _id: string; id: string; code: string; nom: string; description?: string; actif: boolean; pollutants: string[]; sensorNodeCount: number; operatorsAssigned: any[]; approvalStatus?: string }

function PollutantPills({ codes }: { codes: string[] }) {
  if (!codes?.length) return <span className="text-xs text-text-tertiary">Aucun polluant</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map(code => {
        const p = POLLUTANTS[code as keyof typeof POLLUTANTS]
        return <span key={code} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: p?.color ?? "#888" }}>{p?.label ?? code}</span>
      })}
    </div>
  )
}

function Breadcrumb({ roots, industry, site, zone, onRoot, onIndustry, onSite }: { roots: string; industry?: Industry; site?: Site; zone?: Zone; onRoot: () => void; onIndustry: () => void; onSite: () => void }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm">
      <button type="button" onClick={onRoot} className={`font-medium transition-colors ${!industry ? "text-text-tertiary" : "text-accent hover:underline"}`}>{roots}</button>
      {industry && (<><ChevronRight className="h-3.5 w-3.5 text-text-tertiary" /><button type="button" onClick={onIndustry} className={`font-medium transition-colors ${!site ? "text-text-primary" : "text-accent hover:underline"}`}>{industry.nom}</button></>)}
      {site && (<><ChevronRight className="h-3.5 w-3.5 text-text-tertiary" /><button type="button" onClick={onSite} className={`font-medium transition-colors ${!zone ? "text-text-primary" : "text-accent hover:underline"}`}>{site.nom}</button></>)}
      {zone && (<><ChevronRight className="h-3.5 w-3.5 text-text-tertiary" /><span className="font-medium text-text-primary">{zone.nom}</span></>)}
    </nav>
  )
}

function IndustryList({ onSelect }: { onSelect: (i: Industry) => void }) {
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get<ApiSuccess<any[]>>(endpoints.industries.base).then(r => { setIndustries((unwrap(r.data) ?? []).map((i: any) => ({ _id: i._id || i.id, nom: i.nom, secteur: i.secteur, localisation: i.localisation, actif: i.actif !== false }))); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
  if (!industries.length) return <Card className="py-12 text-center"><p className="text-sm text-text-secondary">Aucune industrie</p></Card>
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {industries.map(ind => (
        <button key={ind._id} type="button" onClick={() => onSelect(ind)} className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-accent hover:shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent"><Building2 className="h-5 w-5" /></div>
            <Badge variant={ind.actif ? "success" : "neutral"}>{ind.actif ? "Actif" : "Inactif"}</Badge>
          </div>
          <div>
            <p className="font-semibold text-text-primary group-hover:text-accent">{ind.nom}</p>
            <p className="text-xs text-text-secondary">{ind.secteur}</p>
            {ind.localisation?.ville && <p className="mt-0.5 flex items-center gap-1 text-xs text-text-tertiary"><MapPin className="h-3 w-3" />{ind.localisation.ville}</p>}
          </div>
          <div className="flex items-center justify-end text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100">Voir les sites <ChevronRight className="h-3.5 w-3.5" /></div>
        </button>
      ))}
    </div>
  )
}

function SiteList({ industryId, canCreate, canEdit, canDelete, onSelect }: { industryId: string; canCreate: boolean; canEdit: boolean; canDelete: boolean; onSelect: (s: Site) => void }) {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<SiteType | null>(null)
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    const url = industryId ? endpoints.sites.byIndustry(industryId) : endpoints.sites.base
    api.get<ApiSuccess<any[]>>(url).then(r => { setSites((unwrap(r.data) ?? []).map((s: any) => ({ _id: s._id || s.id, id: s._id || s.id, nom: s.nom, description: s.description, actif: s.actif !== false, zoneCount: s.zoneCount ?? 0, localisation: s.localisation, supervisorId: s.supervisorId, approvalStatus: s.approvalStatus }))); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [industryId])

  if (loading) return <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20" />)}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Sites ({sites.length})</h3>
        {canCreate && <Button variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>Nouveau site</Button>}
      </div>
      {sites.length === 0 ? (
        <Card className="py-12 text-center"><p className="text-sm text-text-secondary">Aucun site</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sites.map(site => (
            <div key={site._id} className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-accent hover:shadow-sm">
              <div className="flex items-start justify-between">
                <button type="button" onClick={() => onSelect(site)} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-text-primary group-hover:text-accent">{site.nom}</p>
                    <Badge variant={site.actif ? "success" : "neutral"}>{site.actif ? "Actif" : "Inactif"}</Badge>
                    {site.approvalStatus === "PENDING" && <Badge variant="warning">En attente</Badge>}
                  </div>
                  {site.description && <p className="text-xs text-text-secondary">{site.description}</p>}
                  {site.localisation?.ville && <p className="flex items-center gap-1 text-xs text-text-tertiary"><MapPin className="h-3 w-3" />{[site.localisation.adresse, site.localisation.ville].filter(Boolean).join(", ")}</p>}
                  <p className="flex items-center gap-1 text-xs text-text-tertiary"><Layers className="h-3 w-3" />{site.zoneCount} zone{site.zoneCount !== 1 ? "s" : ""}</p>
                </button>
                {(canEdit || canDelete) && (
                  <div className="ml-2 flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {canEdit && <button type="button" onClick={() => setEditingSite(site as any)} className="rounded p-1.5 text-text-secondary hover:bg-bg hover:text-accent"><Pencil className="h-3.5 w-3.5" /></button>}
                    {canDelete && <button type="button" onClick={() => setDeletingSiteId(site._id)} className="rounded p-1.5 text-text-secondary hover:bg-danger-light hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {createOpen && <SiteCreateModal onClose={() => { setCreateOpen(false); load() }} />}
      {editingSite && <SiteEditModal site={editingSite} onClose={() => { setEditingSite(null); load() }} />}
      {deletingSiteId && <SiteDeleteConfirm siteId={deletingSiteId} onClose={() => { setDeletingSiteId(null); load() }} />}
    </div>
  )
}

function SiteDetail({ site, canCreateZone, canEditZone, canDeleteZone, onZoneSelect }: { site: Site; canCreateZone: boolean; canEditZone: boolean; canDeleteZone: boolean; onZoneSelect: (z: Zone) => void }) {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<ZoneType | null>(null)
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.get<ApiSuccess<any[]>>(endpoints.zones.bySite(site._id)).then(r => { setZones((unwrap(r.data) ?? []).map((z: any) => ({ _id: z._id || z.id, id: z._id || z.id, code: z.code, nom: z.nom, description: z.description, actif: z.actif !== false, pollutants: z.pollutants ?? [], sensorNodeCount: z.sensorNodeCount ?? 0, operatorsAssigned: z.operatorsAssigned ?? [], approvalStatus: z.approvalStatus }))); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [site._id])

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Building2 className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">{site.nom}</h2>
              <Badge variant={site.actif ? "success" : "neutral"}>{site.actif ? "Actif" : "Inactif"}</Badge>
            </div>
            {site.description && <p className="mt-0.5 text-sm text-text-secondary">{site.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
              {(site.localisation?.adresse || site.localisation?.ville) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[site.localisation.adresse, site.localisation.ville].filter(Boolean).join(", ")}</span>}
              {site.supervisorId && typeof site.supervisorId === "object" && <span>👤 {site.supervisorId.username ?? site.supervisorId.email}</span>}
              <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{site.zoneCount} zone{site.zoneCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Zones de surveillance ({zones.length})</h3>
        {canCreateZone && <Button variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>Nouvelle zone</Button>}
      </div>
      {loading ? <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16" />)}</div> : zones.length === 0 ? (
        <Card className="py-8 text-center"><p className="text-sm text-text-secondary">Aucune zone dans ce site</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {zones.map(zone => (
            <div key={zone._id} className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-accent hover:shadow-sm">
              <div className="flex items-start justify-between">
                <button type="button" onClick={() => onZoneSelect(zone)} className="flex min-w-0 flex-1 flex-col gap-2 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-text-secondary">{zone.code}</span>
                    <p className="font-semibold text-text-primary group-hover:text-accent">{zone.nom}</p>
                    <Badge variant={zone.actif ? "success" : "neutral"}>{zone.actif ? "Actif" : "Inactif"}</Badge>
                    {zone.approvalStatus === "PENDING" && <Badge variant="warning">En attente</Badge>}
                  </div>
                  {zone.description && <p className="text-xs text-text-secondary">{zone.description}</p>}
                  <PollutantPills codes={zone.pollutants} />
                </button>
                {(canEditZone || canDeleteZone) && (
                  <div className="ml-2 flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {canEditZone && <button type="button" onClick={() => setEditingZone(zone as any)} className="rounded p-1.5 text-text-secondary hover:bg-bg hover:text-accent"><Pencil className="h-3.5 w-3.5" /></button>}
                    {canDeleteZone && <button type="button" onClick={() => setDeletingZoneId(zone._id)} className="rounded p-1.5 text-text-secondary hover:bg-danger-light hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {createOpen && <ZoneCreateModal siteId={site._id} onClose={() => { setCreateOpen(false); load() }} />}
      {editingZone && <ZoneEditModal zone={editingZone} onClose={() => { setEditingZone(null); load() }} />}
      {deletingZoneId && <ZoneDeleteConfirm zoneId={deletingZoneId} onClose={() => { setDeletingZoneId(null); load() }} />}
    </div>
  )
}

function KpiMiniPanel({ zoneId }: { zoneId: string }) {
  const summary = useKPISummary({ zoneId, period: "day" })
  const kpis = summary.data

  const items = [
    { label: "Taux Depassement", value: kpis?.td != null ? `${kpis.td.toFixed(1)} %` : "—", color: (kpis?.td ?? 0) > 10 ? "text-danger" : "text-success" },
    { label: "Indice Performance", value: kpis?.ipe != null ? `${kpis.ipe.toFixed(0)} pts` : "—", color: (kpis?.ipe ?? 100) < 70 ? "text-danger" : "text-success" },
    { label: "Emission Massique", value: kpis?.emj != null ? `${Object.values(kpis.emj).reduce((s: number, v: any) => s + (Number(v) || 0), 0).toFixed(0)} kg/j` : "—", color: "text-text-primary" },
    { label: "Reduction CO2", value: kpis?.rco2 != null ? `${kpis.rco2.toFixed(1)} %` : "—", color: "text-text-primary" },
  ]

  return (
    <Card className="p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        <span>📊</span> KPIs — Apercu (24h)
      </p>
      {summary.isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-12 animate-pulse rounded-lg bg-bg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map(item => (
            <div key={item.label} className="rounded-lg border border-border bg-bg p-3 text-center">
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-text-tertiary">{item.label}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] text-text-tertiary">Lecture seule — acces complet via les comptes operationnels</p>
    </Card>
  )
}

function ZoneDetail({ zone, site, showKpi }: { zone: Zone; site: Site; showKpi?: boolean }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><MapPin className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">{zone.nom}</h2>
              <span className="rounded-full border border-border bg-bg px-2 py-0.5 font-mono text-xs text-text-secondary">{zone.code}</span>
              <Badge variant={zone.actif ? "success" : "neutral"}>{zone.actif ? "Actif" : "Inactif"}</Badge>
            </div>
            {zone.description && <p className="mt-0.5 text-sm text-text-secondary">{zone.description}</p>}
            <div className="mt-1 flex items-center gap-1 text-xs text-text-tertiary"><Building2 className="h-3.5 w-3.5" />Site : {site.nom}{site.localisation?.ville && ` · ${site.localisation.ville}`}</div>
          </div>
        </div>
      </Card>

      {showKpi && zone.actif && <KpiMiniPanel zoneId={zone._id} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4 sm:col-span-2">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary"><FlaskConical className="h-3.5 w-3.5" />Polluants surveilles</p>
          <PollutantPills codes={zone.pollutants} />
        </Card>
        <Card className="p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary"><Cpu className="h-3.5 w-3.5" />Noeuds capteurs</p>
          <p className="text-2xl font-bold text-text-primary">{zone.sensorNodeCount}</p>
          <p className="text-xs text-text-secondary">appareil{zone.sensorNodeCount !== 1 ? "s" : ""} installe{zone.sensorNodeCount !== 1 ? "s" : ""}</p>
        </Card>
      </div>
      <Card className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">Operateurs assignes</p>
        {zone.operatorsAssigned.length === 0 ? <p className="text-sm text-text-tertiary">Aucun operateur assigne</p> : (
          <div className="flex flex-wrap gap-2">
            {zone.operatorsAssigned.map((op: any, i) => (
              <div key={op._id ?? i} className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{(op.username ?? op.email ?? "?")[0].toUpperCase()}</div>
                <div><p className="text-xs font-medium text-text-primary">{op.username ?? "—"}</p><p className="text-[10px] text-text-tertiary">{op.email}</p></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── My Requests panel (HEAD_SUPERVISOR / SITE_SUPERVISOR) ────
function MyRequests() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    api.get<ApiSuccess<any[]>>(endpoints.sites.myRequests)
      .then(r => { setRequests(unwrap(r.data) ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (!loading && requests.length === 0) return null

  const statusBadge = (status: string) => {
    if (status === 'APPROVED') return <Badge variant="success">Approuvé</Badge>
    if (status === 'REJECTED') return <Badge variant="danger">Rejeté</Badge>
    if (status === 'PREPARING') return <Badge variant="info">En préparation</Badge>
    return <Badge variant="warning">En attente</Badge>
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">Mes demandes</span>
          {!loading && (
            <span className="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-semibold text-warning-dark">
              {requests.filter(r => r.approvalStatus === 'PENDING' || r.approvalStatus === 'PREPARING').length} en attente
            </span>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-text-tertiary transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-bg" />)}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((req: any) => (
                <div key={req._id} className="flex items-start gap-3 px-4 py-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    req.type === 'site' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {req.type === 'site' ? <Building2 className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{req.nom}</span>
                      {statusBadge(req.approvalStatus)}
                      <span className="text-xs text-text-tertiary">
                        {req.type === 'site' ? 'Site' : 'Zone'}
                      </span>
                    </div>
                    {req.type === 'site' && req.initialZone && (
                      <p className="mt-0.5 text-xs text-text-secondary">
                        Zone initiale : {req.initialZone.nom}
                        {req.initialZone.approvalStatus && req.initialZone.approvalStatus !== req.approvalStatus && (
                          <span className="ml-1 text-text-tertiary">({req.initialZone.approvalStatus})</span>
                        )}
                      </p>
                    )}
                    {req.rejectionReason && (
                      <p className="mt-0.5 text-xs text-danger">Rejet : {req.rejectionReason}</p>
                    )}
                    {req.approvalRequestedAt && (
                      <p className="mt-0.5 text-[10px] text-text-tertiary">
                        Soumis le {new Date(req.approvalRequestedAt).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Industries() {
  const { user } = useAuth()
  const role = user?.role ?? "OPERATOR"

  const isSuperAdmin = role === "SUPER_ADMIN"
  const isHeadSupervisor = role === "HEAD_SUPERVISOR"
  const isSiteSupervisor = role === "SITE_SUPERVISOR"
  const isAuditor = role === "AUDITOR"
  const isOperator = role === "OPERATOR"

  const canCreateSite = isSuperAdmin || isHeadSupervisor
  const canEditSite = isSuperAdmin || isHeadSupervisor
  const canDeleteSite = isSuperAdmin
  const canCreateZone = isSuperAdmin || isHeadSupervisor || isSiteSupervisor
  const canEditZone = isSuperAdmin || isHeadSupervisor || isSiteSupervisor
  const canDeleteZone = isSuperAdmin

  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null)
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)

  const goToRoot = () => { setSelectedIndustry(null); setSelectedSite(null); setSelectedZone(null) }
  const goToIndustry = () => { setSelectedSite(null); setSelectedZone(null) }
  const goToSite = () => { setSelectedZone(null) }

  const industryId = isSuperAdmin
    ? selectedIndustry?._id ?? ""
    : (typeof user?.industryId === "object" ? (user.industryId as any)?._id : user?.industryId as string) ?? ""

  const rootLabel = isSuperAdmin ? "Industries" : isHeadSupervisor || isAuditor ? "Sites" : isSiteSupervisor ? "Mes sites" : "Mes zones"

  const subtitle = selectedZone
    ? `Zone · ${selectedZone.code}`
    : selectedSite
      ? `Site · ${selectedSite.nom}`
      : selectedIndustry
        ? `Industrie · ${selectedIndustry.nom}`
        : isSuperAdmin ? "Vue hierarchique : Industrie → Site → Zone" : isOperator ? "Vos zones assignees" : "Sites et zones de votre perimetre"

  return (
    <div className="space-y-4">
      <PageHeader title={isSuperAdmin ? "Gestion Industries" : "Mes Sites & Zones"} subtitle={subtitle} />

      {/* My Requests panel — only for HEAD_SUPERVISOR and SITE_SUPERVISOR */}
      {(isHeadSupervisor || isSiteSupervisor) && !selectedSite && !selectedZone && (
        <MyRequests />
      )}

      <Breadcrumb
        roots={rootLabel}
        industry={isSuperAdmin ? selectedIndustry ?? undefined : undefined}
        site={selectedSite ?? undefined}
        zone={selectedZone ?? undefined}
        onRoot={goToRoot}
        onIndustry={goToIndustry}
        onSite={goToSite}
      />

      {(selectedIndustry || selectedSite) && (
        <button type="button" onClick={selectedZone ? goToSite : selectedSite ? goToIndustry : goToRoot} className="flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" />
          {selectedZone ? `Retour a ${selectedSite?.nom}` : selectedSite ? `Retour a ${selectedIndustry?.nom ?? rootLabel}` : `Retour a ${rootLabel}`}
        </button>
      )}

      {isSuperAdmin && !selectedIndustry && <IndustryList onSelect={setSelectedIndustry} />}

      {(isSuperAdmin ? !!selectedIndustry : true) && !selectedSite && !isOperator && (
        <SiteList
          industryId={industryId}
          canCreate={canCreateSite}
          canEdit={canEditSite}
          canDelete={canDeleteSite}
          onSelect={setSelectedSite}
        />
      )}

      {selectedSite && !selectedZone && (
        <SiteDetail
          site={selectedSite}
          canCreateZone={canCreateZone}
          canEditZone={canEditZone}
          canDeleteZone={canDeleteZone}
          onZoneSelect={setSelectedZone}
        />
      )}

      {selectedSite && selectedZone && <ZoneDetail zone={selectedZone} site={selectedSite} showKpi={isSuperAdmin} />}

      {isOperator && !selectedSite && (
        <Card className="p-6 text-center">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-secondary">Selectionnez une zone depuis le menu lateral pour voir ses details.</p>
        </Card>
      )}
    </div>
  )
}

