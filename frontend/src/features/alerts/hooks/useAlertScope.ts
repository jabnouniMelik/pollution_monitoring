import { useAuth } from '@/features/auth/hooks/useAuth'
import { useSelectionStore } from '@/store/selectionStore'

/**
 * Returns the alert filter scope based on the current user's role.
 *
 * OPERATOR        → { zoneId }  when zone selected, null while loading
 * SITE_SUPERVISOR → {}          backend RBAC scopes to their sites
 * HEAD_SUPERVISOR → {}          backend RBAC scopes to their industry
 * AUDITOR         → {}          all alerts, read-only
 * SUPER_ADMIN     → null        no alerts (admin role)
 *
 * Returning null disables the query (don't fetch yet).
 * Returning {} fetches with no extra filter (backend handles scoping).
 */
export function useAlertScope(): { zoneId?: string; siteId?: string } | null {
  const { user } = useAuth()
  const { siteId, zoneId } = useSelectionStore()

  if (!user) return null

  switch (user.role) {
    case 'SUPER_ADMIN':
      // Admin role — no operational alerts
      return null

    case 'OPERATOR':
      // Must wait for zone selection before fetching
      return zoneId ? { zoneId } : null

    case 'HEAD_SUPERVISOR':
      // Head supervisors use the selected zone like operators.
      return zoneId ? { zoneId } : {}

    case 'SITE_SUPERVISOR':
      // Site supervisors can narrow to the selected site, otherwise backend RBAC
      // scopes them to all sites they manage.
      return siteId ? { siteId } : {}

    case 'AUDITOR':
    default:
      // All alerts, no restriction
      return {}
  }
}
