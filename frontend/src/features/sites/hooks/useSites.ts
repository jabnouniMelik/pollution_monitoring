import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { siteApi } from '../api/siteApi'

export function useSites() {
  return useQuery({
    queryKey: queryKeys.sites.list,
    queryFn: () => siteApi.list(),
    staleTime: 60_000,
  })
}

export function useSite(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sites.detail(id ?? ''),
    queryFn: () => siteApi.byId(id as string),
    enabled: Boolean(id),
  })
}
