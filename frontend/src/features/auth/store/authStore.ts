import { create } from 'zustand'
import type { User } from '../types/auth.types'
import { loadPersistedUser, persistUser } from '../utils/tokenStorage'
import { setAccessToken } from '@/lib/api/axios'
import { useZoneStore } from './zoneStore'
import { useSelectionStore } from '@/store/selectionStore'

function resetScopeSelection() {
  useZoneStore.getState().clearSelectedZone()
  useSelectionStore.getState().reset()
}

interface AuthState {
  user: User | null
  isInitialized: boolean
  setSession: (user: User, accessToken: string) => void
  setUser: (user: User | null) => void
  clearSession: () => void
  markInitialized: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadPersistedUser(),
  isInitialized: false,

  setSession: (user, accessToken) => {
    setAccessToken(accessToken)
    persistUser(user)
    resetScopeSelection()
    set({ user, isInitialized: true })
  },

  setUser: (user) => {
    persistUser(user)
    set({ user })
  },

  clearSession: () => {
    setAccessToken(null)
    persistUser(null)
    resetScopeSelection()
    set({ user: null, isInitialized: true })
  },

  markInitialized: () => set({ isInitialized: true }),
}))
