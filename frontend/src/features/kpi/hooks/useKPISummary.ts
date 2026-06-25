import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { kpiApi, type SummaryParams } from '../api/kpiApi'

export function useKPISummary(params: SummaryParams = {}) {
  const enabled = Boolean(params.siteId)
  return useQuery({
    queryKey: queryKeys.kpi.summary(params),
    queryFn: () => kpiApi.summary(params),
    enabled,
    staleTime: 15_000,
  })
}

export function useKPIConfig() {
  return useQuery({
    queryKey: queryKeys.kpi.config,
    queryFn: () => kpiApi.config(),
    staleTime: 60_000,
  })
}

export function useKPIHistory(pollutantId: string | undefined, params: SummaryParams = {}) {
  const enabled = Boolean(pollutantId) && Boolean(params.siteId)
  return useQuery({
    queryKey: queryKeys.kpi.history(pollutantId ?? '', params),
    queryFn: () => kpiApi.history(pollutantId as string, params),
    enabled,
    staleTime: 30_000,
  })
}
