import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { zoneApi } from '../api/zoneApi'
import type { ZoneFilters, CreateZoneInput, UpdateZoneInput, AssignOperatorInput } from '../types/zone.types'
import { useToast } from '@/components/ui/Toast/ToastProvider'

export function useZones(filters: ZoneFilters = {}) {
  return useQuery({
    queryKey: queryKeys.zones.list(filters),
    queryFn: () => zoneApi.list(filters),
    staleTime: 10_000,
  })
}

export function useZoneById(id: string) {
  return useQuery({
    queryKey: queryKeys.zones.detail(id),
    queryFn: () => zoneApi.getById(id),
    staleTime: 10_000,
    enabled: !!id,
  })
}

export function useCreateZone() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (input: CreateZoneInput) => zoneApi.create(input),
    onSuccess: () => {
      toast.success('Zone créée')
      queryClient.invalidateQueries({ queryKey: queryKeys.zones.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la création'
      toast.error(message)
    },
  })
}

export function useUpdateZone() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateZoneInput }) =>
      zoneApi.update(id, input),
    onSuccess: (_, { id }) => {
      toast.success('Zone mise à jour')
      queryClient.invalidateQueries({ queryKey: queryKeys.zones.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.zones.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la mise à jour'
      toast.error(message)
    },
  })
}

export function useDeleteZone() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (id: string) => zoneApi.delete(id),
    onSuccess: () => {
      toast.success('Zone supprimée')
      queryClient.invalidateQueries({ queryKey: queryKeys.zones.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la suppression'
      toast.error(message)
    },
  })
}

export function useAssignOperator() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignOperatorInput }) =>
      zoneApi.assignOperator(id, input),
    onSuccess: (_, { id }) => {
      toast.success('Opérateur assigné')
      queryClient.invalidateQueries({ queryKey: queryKeys.zones.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.zones.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de l\'assignation'
      toast.error(message)
    },
  })
}
