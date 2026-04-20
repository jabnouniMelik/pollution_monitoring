import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { CreateSitePayload, Site } from '../types/site.types'

export const siteApi = {
  async list(): Promise<Site[]> {
    const resp = await api.get<ApiSuccess<Site[]>>(endpoints.sites.base)
    return unwrap(resp.data)
  },
  async byId(id: string): Promise<Site> {
    const resp = await api.get<ApiSuccess<Site>>(endpoints.sites.byId(id))
    return unwrap(resp.data)
  },
  async create(payload: CreateSitePayload): Promise<Site> {
    const resp = await api.post<ApiSuccess<Site>>(endpoints.sites.base, payload)
    return unwrap(resp.data)
  },
  async update(id: string, payload: Partial<CreateSitePayload>): Promise<Site> {
    const resp = await api.put<ApiSuccess<Site>>(endpoints.sites.byId(id), payload)
    return unwrap(resp.data)
  },
  async remove(id: string): Promise<void> {
    await api.delete(endpoints.sites.byId(id))
  },
}
