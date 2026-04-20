import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { alertApi } from '../api/alertApi'
import type { AlertFilters } from '../types/alert.types'

export function useAlerts(filters: AlertFilters = {}) {
  return useQuery({
    queryKey: queryKeys.alerts.list(filters),
    queryFn: () => alertApi.list(filters),
    staleTime: 10_000,
  })
}

export function useAlertStats(params: { siteId?: string; zoneId?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.alerts.stats,
    queryFn: () => alertApi.stats(params),
    staleTime: 15_000,
  })
}
