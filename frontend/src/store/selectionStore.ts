import { create } from 'zustand'

interface SelectionState {
  siteId: string | null
  zoneId: string | null
  period: 'hour' | 'day' | 'week' | 'month' | 'year'
  setSite: (siteId: string | null) => void
  setZone: (zoneId: string | null) => void
  setPeriod: (period: SelectionState['period']) => void
  reset: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  siteId: null,
  zoneId: null,
  period: 'day',
  setSite: (siteId) => set({ siteId, zoneId: null }),
  setZone: (zoneId) => set({ zoneId }),
  setPeriod: (period) => set({ period }),
  reset: () => set({ siteId: null, zoneId: null, period: 'day' }),
}))
