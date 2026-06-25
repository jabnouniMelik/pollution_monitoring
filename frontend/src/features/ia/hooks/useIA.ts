import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/api/queryClient'

import { iaApi } from '../api/iaApi'



export function useIAHealth() {

  return useQuery({

    queryKey: queryKeys.ia.health,

    queryFn: () => iaApi.health(),

    staleTime: 60_000,

    refetchInterval: 120_000,

  })

}



export function useLatestForecast(zoneId: string | null | undefined) {

  return useQuery({

    queryKey: queryKeys.ia.forecast(zoneId ?? ''),

    queryFn: () => iaApi.latestForecast(zoneId as string),

    enabled: Boolean(zoneId),

    staleTime: 60_000,

    refetchInterval: 120_000,

  })

}



export function useAnomalyHistory(zoneId: string | null | undefined, limit = 10) {

  return useQuery({

    queryKey: queryKeys.ia.anomalies(zoneId ?? ''),

    queryFn: () => iaApi.anomalyHistory(zoneId as string, limit),

    enabled: Boolean(zoneId),

    staleTime: 60_000,

    refetchInterval: 120_000,

  })

}



/** Lance IF + LSTM pour la zone sélectionnée (HEAD_SUPERVISOR / SUPER_ADMIN). */

export function useRunIAForZone(zoneId: string | null | undefined) {

  const queryClient = useQueryClient()

  return useMutation({

    mutationFn: async () => {

      if (!zoneId) throw new Error('Zone requise')

      await iaApi.runDetection(zoneId)

      return iaApi.runForecast(zoneId)

    },

    onSuccess: () => {

      if (!zoneId) return

      queryClient.invalidateQueries({ queryKey: queryKeys.ia.forecast(zoneId) })

      queryClient.invalidateQueries({ queryKey: queryKeys.ia.anomalies(zoneId) })

      queryClient.invalidateQueries({ queryKey: queryKeys.ia.health })

    },

  })

}

export function useLatestRetrainDataset(scope: { siteId?: string | null; zoneId?: string | null }) {
  return useQuery({
    queryKey: queryKeys.ia.retrainDataset(scope),
    queryFn: () => iaApi.latestRetrainDataset(scope),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function usePrepareRetrainDataset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: iaApi.prepareRetrainDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ia.retrainDataset({}) })
      queryClient.invalidateQueries({ queryKey: queryKeys.ia.retrainLatestJob })
    },
  })
}

export function useStartRetrain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datasetId?: string) => iaApi.startRetrain(datasetId),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ia.retrainLatestJob })
      queryClient.invalidateQueries({ queryKey: queryKeys.ia.retrainJob(job._id) })
    },
  })
}

export function useLatestRetrainJob() {
  return useQuery({
    queryKey: queryKeys.ia.retrainLatestJob,
    queryFn: () => iaApi.latestRetrainJob(),
    staleTime: 5_000,
    refetchInterval: 5_000,
  })
}

