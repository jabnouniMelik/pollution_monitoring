import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '@/features/kpi/api/kpiApi'
import { queryKeys } from '@/lib/api/queryClient'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import type { KPIConfig } from '@/features/kpi/types/kpi.types'

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as { response?: { data?: { error?: string; message?: string } } }
  return (
    axiosErr?.response?.data?.error ??
    axiosErr?.response?.data?.message ??
    (err instanceof Error ? err.message : fallback)
  )
}

export function useUpdateAirflow() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (airflow: number) => kpiApi.updateAirflow(airflow),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.kpi.config })
      toast.success('Débit mis à jour')
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Mise à jour du débit échouée')),
  })
}

export function useUpdateBaseline() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (baselineCo2: number) => kpiApi.updateBaseline(baselineCo2),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.kpi.config })
      toast.success('Baseline CO₂ mise à jour')
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Mise à jour baseline échouée')),
  })
}

export function useUpdateSampleInterval() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (seconds: number) => kpiApi.updateSampleInterval(seconds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.kpi.config })
      toast.success('Intervalle d’échantillonnage mis à jour')
    },
    onError: (err) =>
      toast.error(extractErrorMessage(err, 'Mise à jour de l’intervalle échouée')),
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
    onError: (err) =>
      toast.error(extractErrorMessage(err, 'Mise à jour des pondérations échouée')),
  })
}

export function useUpdateTargets() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (targets: KPIConfig['targets']) => kpiApi.updateTargets(targets),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.kpi.config })
      toast.success('Objectifs mis à jour')
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Mise à jour des objectifs échouée')),
  })
}
