import { useMutation, useQueryClient } from '@tanstack/react-query'
import { alertApi } from '../api/alertApi'
import { useToast } from '@/components/ui/Toast/ToastProvider'

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => alertApi.acknowledge(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Alerte acquittée')
    },
    onError: () => toast.error('Échec de l’acquittement'),
  })
}

export function useEscalateAlert() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => alertApi.escalate(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      toast.info('Alerte escaladée')
    },
    onError: () => toast.error('Échec de l’escalade'),
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
    onError: () => toast.error('Échec de la résolution'),
  })
}
