import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { Badge } from '@/components/ui/Badge/Badge'
import { Card } from '@/components/ui/Card/Card'
import { Skeleton } from '@/components/ui/Skeleton/Skeleton'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import { useZones } from '@/features/zones/hooks/useZones'
import type { Zone, ZoneFilters } from '@/features/zones'
import { ZoneCreateModal } from './ZoneCreateModal'
import { ZoneEditModal } from './ZoneEditModal'
import { ZoneDeleteConfirm } from './ZoneDeleteConfirm'

export default function Zones() {
  const { siteId } = useParams<{ siteId: string }>()
  const navigate = useNavigate()

  if (!siteId) {
    return (
      <div>
        <PageHeader title="Zones" />
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">ID du site manquant</p>
        </Card>
      </div>
    )
  }

  const [filters, setFilters] = useState<ZoneFilters>({ siteId, page: 1, pageSize: 10 })
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null)

  const { data, isLoading, error } = useZones(filters)

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }

  const handleFilterChange = (key: keyof ZoneFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Gestion Zones" subtitle="Zones du site" />
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            {error instanceof Error ? error.message : 'Erreur lors du chargement'}
          </p>
        </Card>
      </div>
    )
  }

  const zones = data?.zones || []
  const total = data?.total || 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestion Zones"
        subtitle="Zones du site · HEAD_SUPERVISOR, SITE_SUPERVISOR"
      />

      {/* Back to Sites link */}
      <Button variant="secondary" onClick={() => navigate('/sites')} size="sm">
        ← Retour aux sites
      </Button>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-3">
        <div className="flex-1">
          <Input
            label="Recherche (code ou nom)"
            placeholder="Rechercher..."
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
          />
        </div>

        <PermissionGate permission="CREATE_ZONE">
          <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
            + Créer zone
          </Button>
        </PermissionGate>
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : zones.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-text-secondary">Aucune zone trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-background-light border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Nom</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Capteurs</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Opérateurs</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-background-light border-b border-border">
                    <td className="px-4 py-3 font-mono text-sm">{zone.code}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{zone.nom}</div>
                      {zone.description && (
                        <div className="text-xs text-text-secondary">{zone.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={zone.actif ? 'neutral' : 'warning'}>
                        {zone.actif ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="bg-background-light rounded-full px-2.5 py-1 text-xs font-semibold">
                        {zone.sensorNodeCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="bg-background-light rounded-full px-2.5 py-1 text-xs font-semibold">
                        {zone.operatorsAssigned?.length || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <PermissionGate permission="UPDATE_ZONE">
                          <Button variant="ghost" size="sm" onClick={() => setEditingZone(zone)}>
                            ✎ Éditer
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission="DELETE_ZONE">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingZoneId(zone.id)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            🗑
                          </Button>
                        </PermissionGate>
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {total} zone{total !== 1 ? 's' : ''} · Page {filters.page} / {Math.ceil(total / 10)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!filters.page || filters.page === 1}
              onClick={() => handlePageChange((filters.page || 1) - 1)}
            >
              ← Précédent
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!filters.page || filters.page >= Math.ceil(total / 10)}
              onClick={() => handlePageChange((filters.page || 1) + 1)}
            >
              Suivant →
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      {createModalOpen && (
        <ZoneCreateModal siteId={siteId} onClose={() => setCreateModalOpen(false)} />
      )}

      {editingZone && <ZoneEditModal zone={editingZone} onClose={() => setEditingZone(null)} />}

      {deletingZoneId && (
        <ZoneDeleteConfirm zoneId={deletingZoneId} onClose={() => setDeletingZoneId(null)} />
      )}
    </div>
  )
}
