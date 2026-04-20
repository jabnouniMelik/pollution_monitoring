import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { LoginPayload, LoginResponse, User } from '../types/auth.types'
import { normalizeUser } from '../utils/normalizeUser'

type RawLoginResponse = {
  accessToken?: string
  token?: string
  user: unknown
}

export const authApi = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const resp = await api.post<ApiSuccess<RawLoginResponse>>(endpoints.auth.login, payload)
    const data = unwrap(resp.data)
    return {
      accessToken: data.accessToken ?? data.token ?? '',
      user: normalizeUser(data.user),
    }
  },

  async logout(): Promise<void> {
    await api.post(endpoints.auth.logout)
  },

  async me(): Promise<User> {
    const resp = await api.get<ApiSuccess<unknown>>(endpoints.auth.me)
    return normalizeUser(unwrap(resp.data))
  },
}
