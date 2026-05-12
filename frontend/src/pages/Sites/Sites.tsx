import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Button } from '@/components/ui/Button/Button'
import { Input } from '@/components/ui/Input/Input'
import { Badge } from '@/components/ui/Badge/Badge'
import { Card } from '@/components/ui/Card/Card'
import { Skeleton } from '@/components/ui/Skeleton/Skeleton'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import { useSites } from '@/features/sites/hooks/useSites'
import type { Site, SiteFilters } from '@/features/sites'
import { SiteCreateModal } from './SiteCreateModal'
import { SiteEditModal } from './SiteEditModal'
import { SiteDeleteConfirm } from './SiteDeleteConfirm'
import { useNavigate } from 'react-router-dom'

export default function Sites() {
  const [filters, setFilters] = useState<SiteFilters>({ page: 1, pageSize: 10 })
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null)
  const navigate = useNavigate()

  const { data, isLoading, error } = useSites(filters)

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }

  const handleFilterChange = (key: keyof SiteFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Gestion Sites" subtitle="Liste et administration des sites" />
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            {error instanceof Error ? error.message : 'Erreur lors du chargement'}
          </p>
        </Card>
      </div>
    )
  }

  const sites = data?.sites || []
  const total = data?.total || 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestion Sites"
        subtitle="Liste des sites industriels avec accès aux zones · SUPER_ADMIN, HEAD_SUPERVISOR"
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-3">
        <div className="flex-1">
          <Input
            label="Recherche (nom du site)"
            placeholder="Rechercher..."
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
          />
        </div>

        <PermissionGate permission="CREATE_SITE">
          <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
            + Créer site
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
        ) : sites.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-text-secondary">Aucun site trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-background-light border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Nom</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Zones</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Adresse</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.id} className="hover:bg-background-light border-b border-border">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{site.nom}</div>
                      {site.description && (
                        <div className="text-xs text-text-secondary">{site.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={site.actif ? 'neutral' : 'warning'}>
                        {site.actif ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="bg-background-light rounded-full px-2.5 py-1 text-xs font-semibold">
                        {site.zoneCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {site.localisation?.adresse || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/zones/${site.id}`)}
                          title="Gérer les zones"
                        >
                          📍 Zones
                        </Button>
                        <PermissionGate permission="UPDATE_SITE">
                          <Button variant="ghost" size="sm" onClick={() => setEditingSite(site)}>
                            ✎ Éditer
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission="DELETE_SITE">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingSiteId(site.id)}
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
            {total} site{total !== 1 ? 's' : ''} · Page {filters.page} / {Math.ceil(total / 10)}
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
      {createModalOpen && <SiteCreateModal onClose={() => setCreateModalOpen(false)} />}

      {editingSite && <SiteEditModal site={editingSite} onClose={() => setEditingSite(null)} />}

      {deletingSiteId && (
        <SiteDeleteConfirm siteId={deletingSiteId} onClose={() => setDeletingSiteId(null)} />
      )}
    </div>
  )
}
