import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Zone, Site } from '../types/auth.types'

interface ZoneState {
  selectedZone: Zone | null
  selectedSite: Site | null
  setSelectedZone: (zone: Zone | null) => void
  setSelectedSite: (site: Site | null) => void
  clearSelectedZone: () => void
}

/**
 * Store for managing the currently selected zone and site.
 * - OPERATOR: tracks selected zone (from zonesAssigned)
 * - SITE_SUPERVISOR: tracks selected zone (from their site's zones)
 * - HEAD_SUPERVISOR: tracks selected site AND selected zone
 * Persists the selection across page reloads.
 */
export const useZoneStore = create<ZoneState>()(
  persist(
    (set) => ({
      selectedZone: null,
      selectedSite: null,

      setSelectedZone: (zone) => set({ selectedZone: zone }),

      setSelectedSite: (site) => set({ selectedSite: site, selectedZone: null }),

      clearSelectedZone: () => set({ selectedZone: null, selectedSite: null }),
    }),
    {
      name: 'zone-storage',
    }
  )
)
