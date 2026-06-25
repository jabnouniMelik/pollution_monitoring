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
    summary: (params?: unknown) => ['kpi', 'summary', params] as const,
    history: (pollutantId: string, params?: unknown) =>
      ['kpi', 'history', pollutantId, params] as const,
    ipe: (params?: unknown) => ['kpi', 'ipe', params] as const,
    td: (pollutantId: string, params?: unknown) => ['kpi', 'td', pollutantId, params] as const,
    emj: (pollutantId: string, params?: unknown) => ['kpi', 'emj', pollutantId, params] as const,
    rco2: (pollutantId: string, params?: unknown) => ['kpi', 'rco2', pollutantId, params] as const,
    config: ['kpi', 'config'] as const,
  },
  alerts: {
    list: (params?: unknown) => ['alerts', 'list', params] as const,
    detail: (id: string) => ['alerts', 'detail', id] as const,
    stats: ['alerts', 'stats'] as const,
  },
  sites: {
    all: ['sites'] as const,
    list: (params?: unknown) => ['sites', 'list', params] as const,
    detail: (id: string) => ['sites', 'detail', id] as const,
  },
  zones: {
    all: ['zones'] as const,
    list: (params?: unknown) => ['zones', 'list', params] as const,
    detail: (id: string) => ['zones', 'detail', id] as const,
  },
  readings: {
    latest: (params?: unknown) => ['readings', 'latest', params] as const,
    /** GET /api/readings (historique filtré) — pas /history */
    list: (params?: unknown) => ['readings', 'list', params] as const,
  },
  thresholds: {
    list: (siteId?: string) => ['thresholds', 'list', siteId] as const,
  },
  reports: {
    list: (params?: unknown) => ['reports', 'list', params] as const,
    detail: (id: string) => ['reports', 'detail', id] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params?: unknown) => ['users', 'list', params] as const,
    byId: (id: string) => ['users', 'detail', id] as const,
  },
  ia: {
    health: ['ia', 'health'] as const,
    forecast: (zoneId: string) => ['ia', 'forecast', zoneId] as const,
    anomalies: (zoneId: string) => ['ia', 'anomalies', zoneId] as const,
    retrainDataset: (scope?: unknown) => ['ia', 'retrain', 'dataset', scope] as const,
    retrainLatestJob: ['ia', 'retrain', 'job', 'latest'] as const,
    retrainJob: (jobId: string) => ['ia', 'retrain', 'job', jobId] as const,
  },
}
