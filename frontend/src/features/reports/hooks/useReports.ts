import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { reportApi } from '../api/reportApi'
import type { GenerateReportPayload, ReportWorkflowStatus } from '../types/report.types'
import { useToast } from '@/components/ui/Toast/ToastProvider'

export function useReports(params: { siteId?: string; status?: ReportWorkflowStatus } = {}) {
  return useQuery({
    queryKey: queryKeys.reports.list(params),
    queryFn: () => reportApi.list(params),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useGenerateReport() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (payload: GenerateReportPayload) => reportApi.generate(payload),
    onSuccess: (report) => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      const msg =
        report.workflowStatus === 'APPROVED'
          ? 'Rapport généré et validé'
          : 'Rapport généré (brouillon)'
      toast.success(msg)
    },
    onError: () => toast.error('Échec de la génération du rapport'),
  })
}

export function useSubmitReport() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => reportApi.submit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Rapport soumis pour validation')
    },
    onError: () => toast.error('Échec de la soumission du rapport'),
  })
}

export function useApproveReport() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      reportApi.approve(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Rapport approuvé')
    },
    onError: () => toast.error('Échec de l’approbation'),
  })
}

export function useRejectReport() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      reportApi.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Rapport refusé')
    },
    onError: () => toast.error('Échec du refus'),
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => reportApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Rapport supprimé')
    },
    onError: () => toast.error('Impossible de supprimer ce rapport'),
  })
}
