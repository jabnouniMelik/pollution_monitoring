import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { zoneApi } from '../api/zoneApi'

export function useZones(siteId?: string) {
  return useQuery({
    queryKey: queryKeys.zones.list(siteId),
    queryFn: () => zoneApi.list(siteId),
    staleTime: 60_000,
  })
}
