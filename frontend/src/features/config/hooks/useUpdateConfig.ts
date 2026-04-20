import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '@/features/kpi/api/kpiApi'
import { queryKeys } from '@/lib/api/queryClient'
import { useToast } from '@/components/ui/Toast/ToastProvider'

export function useUpdateAirflow() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (airflow: number) => kpiApi.updateAirflow(airflow),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.kpi.config })
      toast.success('Débit mis à jour')
    },
    onError: () => toast.error('Mise à jour du débit échouée'),
  })
}

export function useUpdateWeights() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (weights: Record<string, number>) => kpiApi.updateWeights(weights),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.kpi.config })
      toast.success('Pondérations mises à jour')
    },
    onError: () => toast.error('Mise à jour des pondérations échouée'),
  })
}

export function useUpdateTargets() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (targets: { TD?: number; IPE?: number; RCO2?: number; EMJ?: number }) =>
      kpiApi.updateTargets(targets as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.kpi.config })
      toast.success('Objectifs mis à jour')
    },
    onError: () => toast.error('Mise à jour des objectifs échouée'),
  })
}
