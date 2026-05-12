import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { alertApi } from '../api/alertApi'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import type { AlertFilters } from '../types/alert.types'

export function useAlerts(filters: AlertFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.alerts.list(filters),
    queryFn: () => alertApi.list(filters),
    staleTime: 10_000,
    enabled: options.enabled !== false,
  })
}

export function useAlertStats(params: { siteId?: string; zoneId?: string } = {}) {
  return useQuery({
    queryKey: [...queryKeys.alerts.stats, params],
    queryFn: () => alertApi.stats(params),
    staleTime: 0,
  })
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  const toast = useToast()
  
  return useMutation({
    mutationFn: (id: string) => alertApi.acknowledge(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Alerte acquittée')
    },
    onError: (error: any) => {
      // 409 = already acknowledged — not a real error, just refresh the list
      if (error?.status === 409) {
        qc.invalidateQueries({ queryKey: ['alerts'] })
        return
      }
      toast.error('Échec de l\'acquittement')
    },
  })
}

export function useEscalateAlert() {
  const qc = useQueryClient()
  const toast = useToast()
  
  return useMutation({
    mutationFn: ({ id, newSeverity, reason }: { id: string; newSeverity: string; reason?: string }) =>
      alertApi.escalate(id, newSeverity, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Alerte escaladée')
    },
    onError: () => toast.error('Échec de l\'escalade'),
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  const toast = useToast()
  
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => alertApi.resolve(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Alerte résolue')
    },
    onError: (error: any) => {
      if (error?.status === 409) {
        qc.invalidateQueries({ queryKey: ['alerts'] })
        return
      }
      toast.error('Échec de la résolution')
    },
  })
}
