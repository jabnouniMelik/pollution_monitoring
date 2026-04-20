import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { reportApi } from '../api/reportApi'
import type { GenerateReportPayload } from '../types/report.types'
import { useToast } from '@/components/ui/Toast/ToastProvider'

export function useReports(params: { siteId?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.reports.list(params),
    queryFn: () => reportApi.list(params),
    staleTime: 30_000,
  })
}

export function useGenerateReport() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (payload: GenerateReportPayload) => reportApi.generate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Rapport généré')
    },
    onError: () => toast.error('Échec de la génération du rapport'),
  })
}
