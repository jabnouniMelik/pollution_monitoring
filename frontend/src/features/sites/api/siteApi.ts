import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type {
  Site,
  SiteListResponse,
  SiteFilters,
  CreateSiteInput,
  UpdateSiteInput,
  AssignSupervisorInput,
} from '../types/site.types'

function normalizeSite(raw: any): Site {
  return {
    id: raw._id || raw.id,
    nom: raw.nom,
    industrieId: raw.industrieId || raw.industrie_id,
    supervisorId: raw.supervisorId || raw.supervisor_id || null,
    localisation: raw.localisation,
    contact: raw.contact,
    actif: raw.actif !== undefined ? raw.actif : true,
    zoneCount: raw.zoneCount || 0,
    description: raw.description,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  }
}

export const siteApi = {
  async list(filters: SiteFilters = {}): Promise<SiteListResponse> {
    const params = new URLSearchParams()
    if (filters.industrieId) params.append('industrieId', filters.industrieId)
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.pageSize) params.append('pageSize', String(filters.pageSize))

    const queryString = params.toString()
    const url = queryString ? `${endpoints.sites.base}?${queryString}` : endpoints.sites.base

    const response = await api.get<any>(url)
    const data = unwrap(response.data) as any

    return {
      sites: (data?.sites || data || []).map(normalizeSite),
      total: data?.total || 0,
      page: data?.page || 1,
      pageSize: data?.pageSize || 10,
    }
  },

  async getById(id: string): Promise<Site> {
    const response = await api.get<any>(endpoints.sites.byId(id))
    const data = unwrap(response.data) as any
    return normalizeSite(data)
  },

  async create(input: CreateSiteInput): Promise<Site> {
    const response = await api.post<any>(endpoints.sites.base, input)
    const data = unwrap(response.data) as any
    return normalizeSite(data)
  },

  async update(id: string, input: UpdateSiteInput): Promise<Site> {
    const response = await api.put<any>(endpoints.sites.byId(id), input)
    const data = unwrap(response.data) as any
    return normalizeSite(data)
  },

  async delete(id: string): Promise<void> {
    const response = await api.delete<any>(endpoints.sites.byId(id))
    unwrap(response.data)
  },

  async assignSupervisor(id: string, input: AssignSupervisorInput): Promise<Site> {
    const response = await api.put<any>(endpoints.sites.supervisor(id), input)
    const data = unwrap(response.data) as any
    return normalizeSite(data)
  },

  async getByIndustrie(industrieId: string): Promise<Site[]> {
    const response = await api.get<any>(endpoints.sites.byIndustry(industrieId))
    const data = unwrap(response.data) as any
    return (data || []).map(normalizeSite)
  },

  async getZonesCount(id: string): Promise<number> {
    const response = await api.get<any>(endpoints.sites.zonesCount(id))
    const data = unwrap(response.data) as any
    return data?.count || 0
  },
}
