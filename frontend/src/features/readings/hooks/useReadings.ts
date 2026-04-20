import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { readingApi } from '../api/readingApi'
import type { ReadingQuery } from '../types/reading.types'

export function useLatestReadings(params: ReadingQuery = {}) {
  return useQuery({
    queryKey: queryKeys.readings.latest(params),
    queryFn: () => readingApi.latest(params),
    refetchInterval: 15_000,
  })
}

export function useHistoricalReadings(params: ReadingQuery = {}) {
  return useQuery({
    queryKey: queryKeys.readings.history(params),
    queryFn: () => readingApi.history(params),
    staleTime: 30_000,
  })
}
