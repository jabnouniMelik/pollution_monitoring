import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/authApi'
import { getAccessToken, onUnauthorized } from '@/lib/api/axios'

/**
 * Primary hook for consuming the authenticated user.
 * Also wires a silent bootstrap on first mount.
 */
export function useAuth() {
  const { user, isInitialized, setUser, clearSession, markInitialized } = useAuthStore()

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      // Only attempt silent rehydration when we have *some* reason to believe
      // a session exists: either a persisted user profile (sessionStorage) or
      // an access token already in memory. Otherwise we'd call /me just to
      // get a guaranteed 401 — noisy and pointless on a fresh tab.
      const hasPersistedUser = Boolean(useAuthStore.getState().user)
      const hasToken = Boolean(getAccessToken())

      if (!hasPersistedUser && !hasToken) {
        if (!cancelled) markInitialized()
        return
      }

      try {
        const me = await authApi.me()
        if (!cancelled) setUser(me)
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) markInitialized()
      }
    }

    if (!isInitialized) bootstrap()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return onUnauthorized(() => clearSession())
  }, [clearSession])

  return {
    user,
    isAuthenticated: Boolean(user),
    isInitialized,
  }
}
