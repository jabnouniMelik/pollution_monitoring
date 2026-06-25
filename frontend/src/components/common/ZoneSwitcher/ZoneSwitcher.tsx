import { useEffect, useState } from 'react'
import { ChevronDown, MapPin, Building2 } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useZoneStore } from '@/features/auth/store/zoneStore'
import { useSelectionStore } from '@/store/selectionStore'
import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import { siteApi } from '@/features/sites/api/siteApi'
import type { Zone, Site } from '@/features/auth/types/auth.types'

/** Préfère une zone avec nœuds capteurs (requis pour l'IA). */
function pickEquippedZone<T extends { _id: string; sensorNodeCount?: number }>(
  zones: T[],
): T | null {
  if (!zones.length) return null
  return zones.find((z) => (z.sensorNodeCount ?? 0) > 0) ?? zones[0]
}

// ── Shared select style ───────────────────────────────────────
const selectCls =
  'w-full cursor-pointer appearance-none rounded-lg border border-border bg-bg py-2 pl-8 pr-7 text-sm text-text-primary transition-colors hover:bg-card focus:outline-none focus:ring-2 focus:ring-accent'

// ── OPERATOR: zones from auth store ──────────────────────────
function OperatorZoneSwitcher() {
  const { user } = useAuth()
  const { selectedZone, setSelectedZone } = useZoneStore()
  const { setZone } = useSelectionStore()

  const zones: Zone[] = user?.zonesAssigned || []

  useEffect(() => {
    if (zones.length > 0 && !zones.some((z) => z._id === selectedZone?._id)) {
      const best = pickEquippedZone(zones)!
      setSelectedZone(best)
      setZone(best._id)
    }
  }, [zones.length, selectedZone?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedZone) setZone(selectedZone._id)
  }, [selectedZone?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (zones.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">
        <MapPin className="h-4 w-4 shrink-0" />
        <span>Aucune zone assignée</span>
      </div>
    )
  }

  if (zones.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
        <MapPin className="h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{zones[0].nom}</p>
          <p className="text-xs text-text-secondary">{zones[0].code}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
        <MapPin className="h-4 w-4 text-accent" />
      </div>
      <select
        value={selectedZone?._id || ''}
        onChange={(e) => {
          const zone = zones.find((z) => z._id === e.target.value)
          if (zone) { setSelectedZone(zone); setZone(zone._id) }
        }}
        className={selectCls}
      >
        {zones.map((z) => (
          <option key={z._id} value={z._id}>{z.nom} ({z.code})</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <ChevronDown className="h-4 w-4 text-text-secondary" />
      </div>
    </div>
  )
}

// ── SITE_SUPERVISOR: zones fetched from their sites ───────────
function SiteSupervisorZoneSwitcher() {
  const { user } = useAuth()
  const { selectedZone, setSelectedZone } = useZoneStore()
  const { setSite, setZone } = useSelectionStore()

  const sites: Site[] = (user?.sitesManaging || []) as Site[]
  const [zones, setZones] = useState<Zone[]>([])
  const [loadingZones, setLoadingZones] = useState(false)

  // Load zones for all assigned sites on mount
  useEffect(() => {
    if (sites.length === 0) return
    setLoadingZones(true)
    Promise.all(
      sites.map(s =>
        api.get<ApiSuccess<any[]>>(endpoints.zones.bySite(s._id))
          .then(r => (unwrap(r.data) ?? []).map((z: any) => ({
            _id: z._id || z.id,
            code: z.code,
            nom: z.nom,
            siteId: s._id,
            industrieId: z.industrieId || '',
            sensorNodeCount: z.sensorNodeCount ?? 0,
          } as Zone)))
          .catch(() => [] as Zone[])
      )
    ).then(results => {
      const allZones = results.flat()
      setZones(allZones)
      const validZone =
        selectedZone && allZones.some((z) => z._id === selectedZone._id)
          ? selectedZone
          : pickEquippedZone(allZones)
      if (validZone) {
        if (!selectedZone || selectedZone._id !== validZone._id) {
          setSelectedZone(validZone)
        }
        setSite(validZone.siteId)
        setZone(validZone._id)
      } else {
        setSelectedZone(null)
        setZone(null)
      }
      setLoadingZones(false)
    })
  }, [sites.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selection store when zone changes
  useEffect(() => {
    if (selectedZone) {
      setSite(selectedZone.siteId)
      setZone(selectedZone._id)
    }
  }, [selectedZone?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loadingZones) {
    return (
      <div className="h-9 animate-pulse rounded-lg bg-bg" />
    )
  }

  if (zones.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">
        <MapPin className="h-4 w-4 shrink-0" />
        <span>Aucune zone disponible</span>
      </div>
    )
  }

  if (zones.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
        <MapPin className="h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{zones[0].nom}</p>
          <p className="text-xs text-text-secondary">{zones[0].code}</p>
        </div>
      </div>
    )
  }

  // Group zones by site for display
  const siteMap = new Map(sites.map(s => [s._id, s.nom]))

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
        <MapPin className="h-4 w-4 text-accent" />
      </div>
      <select
        value={selectedZone?._id || ''}
        onChange={(e) => {
          const zone = zones.find((z) => z._id === e.target.value)
          if (zone) {
            setSelectedZone(zone)
            setSite(zone.siteId)
            setZone(zone._id)
          }
        }}
        className={selectCls}
      >
        {sites.map(site => {
          const siteZones = zones.filter(z => z.siteId === site._id)
          if (siteZones.length === 0) return null
          return (
            <optgroup key={site._id} label={site.nom}>
              {siteZones.map(z => (
                <option key={z._id} value={z._id}>{z.nom} ({z.code})</option>
              ))}
            </optgroup>
          )
        })}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <ChevronDown className="h-4 w-4 text-text-secondary" />
      </div>
    </div>
  )
}

// ── HEAD_SUPERVISOR: site switcher + zone switcher ────────────
function HeadSupervisorSwitcher() {
  const { user } = useAuth()
  const { selectedSite, selectedZone, setSelectedSite, setSelectedZone } = useZoneStore()
  const { setSite, setZone } = useSelectionStore()

  const sites: Site[] = (user?.sitesManaging || []) as Site[]
  const [zones, setZones] = useState<Zone[]>([])
  const [loadingZones, setLoadingZones] = useState(false)

  // Auto-select first site on mount (ignore stale persisted site after DB reset)
  useEffect(() => {
    if (sites.length === 0) return
    const validSite =
      selectedSite && sites.some((s) => s._id === selectedSite._id)
        ? selectedSite
        : sites[0]
    if (!selectedSite || selectedSite._id !== validSite._id) {
      setSelectedSite(validSite)
      setSite(validSite._id)
    }
  }, [sites.length, selectedSite?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load zones when site changes
  useEffect(() => {
    const siteId = selectedSite?._id
    if (!siteId) { setZones([]); return }
    setLoadingZones(true)
    api.get<ApiSuccess<any[]>>(endpoints.zones.bySite(siteId))
      .then(r => {
        const z = (unwrap(r.data) ?? []).map((z: any) => ({
          _id: z._id || z.id,
          code: z.code,
          nom: z.nom,
          siteId,
          industrieId: z.industrieId || '',
          sensorNodeCount: z.sensorNodeCount ?? 0,
        } as Zone))
        setZones(z)
        // Auto-select first zone équipée (capteurs) pour l'IA
        if (z.length > 0) {
          const best = pickEquippedZone(z)!
          setSelectedZone(best)
          setZone(best._id)
        } else {
          setSelectedZone(null)
          setZone(null)
        }
        setLoadingZones(false)
      })
      .catch(() => setLoadingZones(false))
  }, [selectedSite?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync site into selectionStore
  useEffect(() => {
    if (selectedSite) setSite(selectedSite._id)
  }, [selectedSite?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync zone into selectionStore
  useEffect(() => {
    if (selectedZone) setZone(selectedZone._id)
  }, [selectedZone?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (sites.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">
        <Building2 className="h-4 w-4 shrink-0" />
        <span>Aucun site assigné</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Site selector */}
      {sites.length === 1 ? (
        <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
          <Building2 className="h-4 w-4 shrink-0 text-accent" />
          <p className="truncate font-medium text-text-primary">{sites[0].nom}</p>
        </div>
      ) : (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
            <Building2 className="h-4 w-4 text-accent" />
          </div>
          <select
            value={selectedSite?._id || ''}
            onChange={(e) => {
              const site = sites.find(s => s._id === e.target.value)
              if (site) { setSelectedSite(site); setSite(site._id) }
            }}
            className={selectCls}
          >
            {sites.map(s => (
              <option key={s._id} value={s._id}>{s.nom}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
            <ChevronDown className="h-4 w-4 text-text-secondary" />
          </div>
        </div>
      )}

      {/* Zone selector */}
      {loadingZones ? (
        <div className="h-9 animate-pulse rounded-lg bg-bg" />
      ) : zones.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>Aucune zone</span>
        </div>
      ) : zones.length === 1 ? (
        <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">{zones[0].nom}</p>
            <p className="text-xs text-text-secondary">{zones[0].code}</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
            <MapPin className="h-4 w-4 text-accent" />
          </div>
          <select
            value={selectedZone?._id || ''}
            onChange={(e) => {
              const zone = zones.find(z => z._id === e.target.value)
              if (zone) { setSelectedZone(zone); setZone(zone._id) }
            }}
            className={selectCls}
          >
            {zones.map(z => (
              <option key={z._id} value={z._id}>{z.nom} ({z.code})</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
            <ChevronDown className="h-4 w-4 text-text-secondary" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── AUDITOR: sites de son industrie (conformité / rapports) ───
function AuditorSiteSwitcher() {
  const { user } = useAuth()
  const { selectedSite, setSelectedSite } = useZoneStore()
  const { setSite } = useSelectionStore()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  const industryId =
    typeof user?.industryId === 'string'
      ? user.industryId
      : user?.industryId?._id

  useEffect(() => {
    setLoading(true)
    siteApi
      .list({ pageSize: 100, ...(industryId ? { industrieId: industryId } : {}) })
      .then((res) => {
        const list: Site[] = (res.data ?? []).map((s) => ({
          _id: s.id,
          nom: s.nom,
          industrieId: s.industrieId,
        }))
        setSites(list)
        const valid =
          selectedSite && list.some((s) => s._id === selectedSite._id)
            ? selectedSite
            : list[0] ?? null
        if (valid && (!selectedSite || selectedSite._id !== valid._id)) {
          setSelectedSite(valid)
          setSite(valid._id)
        }
      })
      .catch(() => setSites([]))
      .finally(() => setLoading(false))
  }, [industryId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedSite) setSite(selectedSite._id)
  }, [selectedSite?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="h-9 animate-pulse rounded-lg bg-bg" />
  }

  if (sites.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">
        <Building2 className="h-4 w-4 shrink-0" />
        <span>Aucun site</span>
      </div>
    )
  }

  if (sites.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
        <Building2 className="h-4 w-4 shrink-0 text-accent" />
        <p className="truncate font-medium text-text-primary">{sites[0].nom}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
        <Building2 className="h-4 w-4 text-accent" />
      </div>
      <select
        value={selectedSite?._id || ''}
        onChange={(e) => {
          const site = sites.find((s) => s._id === e.target.value)
          if (site) {
            setSelectedSite(site)
            setSite(site._id)
          }
        }}
        className={selectCls}
      >
        {sites.map((s) => (
          <option key={s._id} value={s._id}>
            {s.nom}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <ChevronDown className="h-4 w-4 text-text-secondary" />
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────
export function ZoneSwitcher() {
  const { user } = useAuth()

  if (!user) return null

  if (user.role === 'OPERATOR') return <OperatorZoneSwitcher />
  if (user.role === 'SITE_SUPERVISOR') return <SiteSupervisorZoneSwitcher />
  if (user.role === 'HEAD_SUPERVISOR') return <HeadSupervisorSwitcher />
  if (user.role === 'AUDITOR') return <AuditorSiteSwitcher />

  return null
}
