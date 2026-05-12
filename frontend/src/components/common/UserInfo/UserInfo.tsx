import { Building2, MapPin, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useZoneStore } from '@/features/auth/store/zoneStore'
import { ROLE_LABELS, Role } from '@/lib/constants/roles'
import type { Industry, Site } from '@/features/auth/types/auth.types'

export function UserInfo() {
  const { user } = useAuth()
  const { selectedZone } = useZoneStore()

  if (!user) return null

  const industry = typeof user.industryId === 'object' && user.industryId !== null
    ? user.industryId as Industry
    : null

  const zones = user.zonesAssigned || []
  const sites = (user.sitesManaging || []) as Site[]

  return (
    <div className="space-y-2">
      {/* User name + role */}
      <div className="flex items-center gap-2">
        <UserIcon className="h-4 w-4 text-text-secondary" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">{user.username}</span>
          <span className="text-xs text-text-secondary">{ROLE_LABELS[user.role]}</span>
        </div>
      </div>

      {/* Industry */}
      {industry && (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-accent" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">{industry.nom}</span>
            <span className="text-xs text-text-secondary">
              {user.role === Role.HEAD_SUPERVISOR
                ? `${industry.secteur} · ${sites.length} site${sites.length !== 1 ? 's' : ''} · ${zones.length} zone${zones.length !== 1 ? 's' : ''}`
                : industry.secteur}
            </span>
          </div>
        </div>
      )}

      {/* HEAD_SUPERVISOR: no extra row — stats already shown under industry */}

      {/* SITE_SUPERVISOR: show site name + zone count */}
      {user.role === Role.SITE_SUPERVISOR && sites.length > 0 && (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-accent" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">{sites[0].nom}</span>
            <span className="text-xs text-text-secondary">
              {zones.length} zone{zones.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* OPERATOR: show zone info */}
      {user.role === Role.OPERATOR && zones.length > 0 && (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-accent" />
          <div className="flex flex-col">
            {zones.length === 1 ? (
              <>
                <span className="text-sm font-medium text-text-primary">{zones[0].nom}</span>
                <span className="text-xs text-text-secondary">{zones[0].code}</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-text-primary">
                  {selectedZone ? selectedZone.nom : zones[0].nom}
                </span>
                <span className="text-xs text-text-secondary">
                  {zones.length} zones assignées
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
