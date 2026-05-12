import { useAuth } from './useAuth'
import { useZoneStore } from '../store/zoneStore'

/**
 * Hook to get the currently selected zone for OPERATOR users.
 * Returns null for non-OPERATOR roles.
 * 
 * @returns The selected zone or null
 */
export function useSelectedZone() {
  const { user } = useAuth()
  const { selectedZone } = useZoneStore()

  // Only return zone for OPERATOR role
  if (user?.role !== 'OPERATOR') {
    return null
  }

  return selectedZone
}

/**
 * Hook to get the selected zone ID for API filtering.
 * Returns null for non-OPERATOR roles or when no zone is selected.
 * 
 * @returns The selected zone ID or null
 */
export function useSelectedZoneId() {
  const selectedZone = useSelectedZone()
  return selectedZone?._id || null
}
