import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/queryClient'
import { userApi } from '../api/userApi'
import type { UserFilters, CreateUserInput, UpdateUserInput } from '../types/user.types'
import { useToast } from '@/components/ui/Toast/ToastProvider'

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => userApi.list(filters),
    staleTime: 0,  // always re-fetch after invalidation
  })
}

export function useUserById(id: string) {
  return useQuery({
    queryKey: queryKeys.users.byId(id),
    queryFn: () => userApi.getById(id),
    staleTime: 10_000,
    enabled: !!id,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (input: CreateUserInput) => userApi.create(input),
    onSuccess: () => {
      toast.success('Utilisateur créé')
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la création'
      toast.error(message)
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      userApi.update(id, input),
    onSuccess: () => {
      toast.success('Utilisateur mis à jour')
      // Force immediate refetch so the list shows fresh populated data
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la mise à jour'
      toast.error(message)
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => {
      toast.success('Utilisateur supprimé')
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la suppression'
      toast.error(message)
    },
  })
}

export function useToggleUserActive() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userApi.toggleActive(id, isActive),
    onSuccess: (_, { id, isActive }) => {
      toast.success(isActive ? 'Utilisateur activé' : 'Utilisateur désactivé')
      queryClient.invalidateQueries({ queryKey: queryKeys.users.byId(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la mise à jour'
      toast.error(message)
    },
  })
}

export function useChangeUserRole() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => userApi.changeRole(id, role),
    onSuccess: () => {
      toast.success('Rôle mis à jour')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de la mise à jour du rôle'
      toast.error(message)
    },
  })
}

export function useAssignZones() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, zoneIds }: { id: string; zoneIds: string[] }) =>
      userApi.assignZones(id, zoneIds),
    onSuccess: () => {
      toast.success('Zones mises à jour')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de l\'assignation des zones'
      toast.error(message)
    },
  })
}

export function useAssignSites() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, siteIds }: { id: string; siteIds: string[] }) =>
      userApi.assignSites(id, siteIds),
    onSuccess: () => {
      toast.success('Sites mis à jour')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      const message = error?.message || 'Erreur lors de l\'assignation des sites'
      toast.error(message)
    },
  })
}
