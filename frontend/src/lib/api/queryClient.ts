import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | undefined)?.status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 3
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  kpi: {
    summary: (params?: Record<string, unknown>) => ['kpi', 'summary', params] as const,
    history: (pollutantId: string, params?: Record<string, unknown>) =>
      ['kpi', 'history', pollutantId, params] as const,
    ipe: (params?: Record<string, unknown>) => ['kpi', 'ipe', params] as const,
    td: (pollutantId: string, params?: Record<string, unknown>) =>
      ['kpi', 'td', pollutantId, params] as const,
    emj: (pollutantId: string, params?: Record<string, unknown>) =>
      ['kpi', 'emj', pollutantId, params] as const,
    rco2: (pollutantId: string, params?: Record<string, unknown>) =>
      ['kpi', 'rco2', pollutantId, params] as const,
    config: ['kpi', 'config'] as const,
  },
  alerts: {
    list: (params?: Record<string, unknown>) => ['alerts', 'list', params] as const,
    detail: (id: string) => ['alerts', 'detail', id] as const,
    stats: ['alerts', 'stats'] as const,
  },
  sites: {
    list: ['sites', 'list'] as const,
    detail: (id: string) => ['sites', 'detail', id] as const,
  },
  zones: {
    list: (siteId?: string) => ['zones', 'list', siteId] as const,
    detail: (id: string) => ['zones', 'detail', id] as const,
  },
  readings: {
    latest: (params?: Record<string, unknown>) => ['readings', 'latest', params] as const,
    history: (params?: Record<string, unknown>) => ['readings', 'history', params] as const,
  },
  thresholds: {
    list: (siteId?: string) => ['thresholds', 'list', siteId] as const,
  },
  reports: {
    list: (params?: Record<string, unknown>) => ['reports', 'list', params] as const,
    detail: (id: string) => ['reports', 'detail', id] as const,
  },
}
