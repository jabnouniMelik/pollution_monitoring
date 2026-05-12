import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type {
  User,
  UserListResponse,
  UserFilters,
  CreateUserInput,
  UpdateUserInput,
} from '../types/user.types'

// Normalization function to handle backend payload variations
function normalizeUser(raw: any): User {
  // industryId can be a populated object { _id, nom, secteur } or a plain string ID
  const industryId = raw.industryId || raw.industry_id || null

  // sitesManaging can be populated objects or plain IDs
  const sitesManaging = raw.sitesManaging || raw.sites_managing || []

  // zonesAssigned can be populated objects or plain IDs
  const zonesAssigned = raw.zonesAssigned || raw.zones_assigned || []

  return {
    id: raw._id || raw.id,
    username: raw.username,
    email: raw.email,
    role: raw.role,
    industryId,
    sitesManaging,
    zonesAssigned,
    isActive: raw.isActive !== undefined ? raw.isActive : true,
    lastLogin: raw.lastLogin || raw.last_login || null,
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
  }
}

export const userApi = {
  async list(filters: UserFilters = {}): Promise<UserListResponse> {
    const params = new URLSearchParams()
    if (filters.page) params.append('page', String(filters.page))
    if (filters.pageSize) params.append('pageSize', String(filters.pageSize))
    if (filters.role) params.append('role', filters.role)
    if (filters.search) params.append('search', filters.search)
    if (filters.status) params.append('status', filters.status)

    const queryString = params.toString()
    const url = queryString ? `${endpoints.users.base}?${queryString}` : endpoints.users.base

    const response = await api.get<any>(url)
    const data = unwrap(response.data) as any

    // Backend returns either:
    //   { users: [], total, page, pageSize }  (paginated shape)
    //   User[]                                (flat array — legacy shape)
    const rawList: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.users)
        ? data.users
        : []

    // Client-side search filter (backend may not support it)
    const filtered = filters.search
      ? rawList.filter((u) => {
          const q = filters.search!.toLowerCase()
          return (
            u.email?.toLowerCase().includes(q) ||
            u.username?.toLowerCase().includes(q)
          )
        })
      : rawList

    const page = filters.page || 1
    const pageSize = filters.pageSize || 10
    const total = data?.total ?? filtered.length

    return {
      users: filtered.map(normalizeUser),
      total,
      page: data?.page ?? page,
      pageSize: data?.pageSize ?? pageSize,
    }
  },

  async getById(id: string): Promise<User> {
    const response = await api.get<any>(endpoints.users.byId(id))
    const data = unwrap(response.data)
    return normalizeUser(data)
  },

  async create(input: CreateUserInput): Promise<User> {
    const response = await api.post<any>(endpoints.users.base, {
      username: input.username,
      email: input.email,
      password: input.password,
      role: input.role,
      industryId: input.industryId,
    })
    const data = unwrap(response.data)
    return normalizeUser(data)
  },

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const response = await api.put<any>(endpoints.users.byId(id), input)
    const data = unwrap(response.data)
    return normalizeUser(data)
  },

  async delete(id: string): Promise<void> {
    const response = await api.delete<any>(endpoints.users.byId(id))
    unwrap(response.data)
  },

  async toggleActive(id: string, isActive: boolean): Promise<User> {
    const response = await api.patch<any>(endpoints.users.byId(id), {
      isActive,
    })
    const data = unwrap(response.data)
    return normalizeUser(data)
  },

  async changeRole(id: string, role: string): Promise<User> {
    const response = await api.put<any>(endpoints.users.role(id), {
      role,
    })
    const data = unwrap(response.data)
    return normalizeUser(data)
  },

  async assignSites(id: string, siteIds: string[]): Promise<User> {
    const response = await api.post<any>(endpoints.users.assignSites(id), {
      siteIds,
    })
    const data = unwrap(response.data)
    return normalizeUser(data)
  },

  async assignZones(id: string, zoneIds: string[]): Promise<User> {
    const response = await api.post<any>(endpoints.users.assignZones(id), {
      zoneIds,
    })
    const data = unwrap(response.data)
    return normalizeUser(data)
  },
}
