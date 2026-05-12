import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { siteApi } from '../api/siteApi'
import type { SiteFilters, CreateSiteInput, UpdateSiteInput, AssignSupervisorInput } from '../types/site.types'
import { useToast } from '@/components/ui/Toast/ToastProvider'

export function useSites(filters: SiteFilters = {}) {
  return useQuery({
    queryKey: queryKeys.sites.list(filters),
    queryFn: () => siteApi.list(filters),
    staleTime: 10_000,
  })
}

export function useSiteById(id: string) {
  return useQuery({
    queryKey: queryKeys.sites.detail(id),
    queryFn: () => siteApi.getById(id),
    staleTime: 10_000,
    enabled: !!id,
  })
}

export function useCreateSite() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (input: CreateSiteInput) => siteApi.create(input),
    onSuccess: () => {
      toast.success('Site créé')
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la création'
      toast.error(message)
    },
  })
}

export function useUpdateSite() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSiteInput }) =>
      siteApi.update(id, input),
    onSuccess: (_, { id }) => {
      toast.success('Site mis à jour')
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la mise à jour'
      toast.error(message)
    },
  })
}

export function useDeleteSite() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (id: string) => siteApi.delete(id),
    onSuccess: () => {
      toast.success('Site supprimé')
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la suppression'
      toast.error(message)
    },
  })
}

export function useAssignSupervisor() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignSupervisorInput }) =>
      siteApi.assignSupervisor(id, input),
    onSuccess: (_, { id }) => {
      toast.success('Superviseur assigné')
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de l\'assignation'
      toast.error(message)
    },
  })
}
