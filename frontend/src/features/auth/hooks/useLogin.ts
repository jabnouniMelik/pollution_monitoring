import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../store/authStore'
import type { LoginPayload, LoginResponse } from '../types/auth.types'

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)

  return useMutation<LoginResponse, unknown, LoginPayload>({
    mutationFn: (payload) => authApi.login(payload),
    onSuccess: ({ user, accessToken }) => {
      setSession(user, accessToken)
    },
  })
}
