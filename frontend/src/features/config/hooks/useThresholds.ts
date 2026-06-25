import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import type { PollutantsPayload } from '../api/configApi'
import { thresholdApi } from '../api/configApi'
import { useToast } from '@/components/ui/Toast/ToastProvider'

export function useThresholds(siteId?: string) {
  return useQuery({
    queryKey: queryKeys.thresholds.list(siteId),
    queryFn: () => thresholdApi.list(siteId),
    staleTime: 60_000,
  })
}

export function useUpdateThresholdPollutants() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, pollutantsData }: { id: string; pollutantsData: PollutantsPayload }) =>
      thresholdApi.updateAllPollutants(id, pollutantsData),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['thresholds'] })
      toast.success('Seuils réglementaires enregistrés')
    },
    onError: () => toast.error('Échec de l’enregistrement des seuils'),
  })
}

export function useResetThresholdConfig() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => thresholdApi.resetToDefaults(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['thresholds'] })
      toast.success('Seuils réinitialisés aux valeurs Décret 2018-928')
    },
    onError: () => toast.error('Échec de la réinitialisation'),
  })
}
