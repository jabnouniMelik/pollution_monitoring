import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { endpoints } from './endpoints'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // required for HttpOnly refresh cookie
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Token management (in-memory; refresh token is HttpOnly cookie) ──────────
let accessToken: string | null = null
let refreshing: Promise<string | null> | null = null
const unauthorizedHandlers: Array<() => void> = []

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandlers.push(handler)
  return () => {
    const idx = unauthorizedHandlers.indexOf(handler)
    if (idx >= 0) unauthorizedHandlers.splice(idx, 1)
  }
}

// ── Request interceptor: inject bearer token ────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers = config.headers ?? new AxiosHeaders()
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

// ── Response interceptor: refresh-once on 401, then retry ───────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined

    if (!original || error.response?.status !== 401) {
      return Promise.reject(normalizeError(error))
    }

    // Avoid infinite loops on the refresh endpoint itself
    if (original.url?.includes(endpoints.auth.refresh) || original._retry) {
      accessToken = null
      unauthorizedHandlers.forEach((h) => h())
      return Promise.reject(normalizeError(error))
    }

    original._retry = true

    try {
      const token = await refreshAccessToken()
      if (!token) {
        unauthorizedHandlers.forEach((h) => h())
        return Promise.reject(normalizeError(error))
      }
      original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${token}` }
      return api.request(original)
    } catch (refreshErr) {
      accessToken = null
      unauthorizedHandlers.forEach((h) => h())
      return Promise.reject(normalizeError(refreshErr as AxiosError))
    }
  },
)

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing

  refreshing = (async () => {
    try {
      const resp = await axios.post<ApiSuccess<{ accessToken: string }>>(
        `${API_URL}${endpoints.auth.refresh}`,
        null,
        { withCredentials: true },
      )
      const token = resp.data?.data?.accessToken ?? null
      if (token) setAccessToken(token)
      return token
    } catch {
      return null
    } finally {
      refreshing = null
    }
  })()

  return refreshing
}

export interface ApiErrorShape {
  status: number
  message: string
  code?: string
  details?: unknown
  isNetworkError: boolean
}

function normalizeError(error: AxiosError): ApiErrorShape {
  if (error.response) {
    const data = error.response.data as Partial<ApiError> | undefined
    return {
      status: error.response.status,
      message: data?.message || error.message || 'Erreur inconnue',
      code: data?.code,
      details: data?.details,
      isNetworkError: false,
    }
  }
  return {
    status: 0,
    message: error.message || 'Erreur réseau',
    isNetworkError: true,
  }
}

export function unwrap<T>(payload: ApiSuccess<T> | ApiError): T {
  if (!payload.success) {
    throw {
      status: 500,
      message: payload.message,
      code: payload.code,
      isNetworkError: false,
    } satisfies ApiErrorShape
  }
  return payload.data
}
