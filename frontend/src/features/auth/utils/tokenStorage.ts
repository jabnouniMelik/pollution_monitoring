/**
 * Token persistence.
 *
 * Access tokens are short-lived and kept in memory (see lib/api/axios.ts).
 * We persist ONLY the user profile locally so a full reload can rehydrate
 * UI chrome while the silent refresh happens. The refresh token is an
 * HttpOnly cookie managed by the backend — we never touch it from JS.
 */
import type { User } from '../types/auth.types'

const USER_KEY = 'emissionsiq.user'

export function persistUser(user: User | null) {
  try {
    if (user) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      sessionStorage.removeItem(USER_KEY)
    }
  } catch {
    // ignore quota / unavailable errors
  }
}

export function loadPersistedUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}
