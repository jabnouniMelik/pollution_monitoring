import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/authApi'
import { getAccessToken, onUnauthorized, tryRefreshSession } from '@/lib/api/axios'

/**
 * Primary hook for consuming the authenticated user.
 * Also wires a silent bootstrap on first mount.
 */
export function useAuth() {
  const { user, isInitialized, setUser, clearSession, markInitialized } = useAuthStore()

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      // Rehydrate only when we have a persisted profile, an in-memory access token,
      // or a chance to rotate via HttpOnly refresh cookie (silent POST /refresh).
      const hasPersistedUser = Boolean(useAuthStore.getState().user)
      const hasToken = Boolean(getAccessToken())

      if (!hasPersistedUser && !hasToken) {
        const refreshed = await tryRefreshSession()
        if (!refreshed) {
          if (!cancelled) markInitialized()
          return
        }
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
