import { create } from 'zustand'

interface SelectionState {
  siteId: string | null
  zoneId: string | null
  sensorNodeId: string | null
  period: 'hour' | 'day' | 'week' | 'month' | 'year'
  setSite: (siteId: string | null) => void
  setZone: (zoneId: string | null) => void
  setSensorNode: (sensorNodeId: string | null) => void
  setPeriod: (period: SelectionState['period']) => void
  reset: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  siteId: null,
  zoneId: null,
  sensorNodeId: null,
  period: 'day',
  setSite: (siteId) => set({ siteId, zoneId: null, sensorNodeId: null }),
  setZone: (zoneId) => set({ zoneId, sensorNodeId: null }),
  setSensorNode: (sensorNodeId) => set({ sensorNodeId }),
  setPeriod: (period) => set({ period }),
  reset: () => set({ siteId: null, zoneId: null, sensorNodeId: null, period: 'day' }),
}))
