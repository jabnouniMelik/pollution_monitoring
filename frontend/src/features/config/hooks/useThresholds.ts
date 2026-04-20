import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { thresholdApi } from '../api/configApi'

export function useThresholds(siteId?: string) {
  return useQuery({
    queryKey: queryKeys.thresholds.list(siteId),
    queryFn: () => thresholdApi.list(siteId),
    staleTime: 60_000,
  })
}
