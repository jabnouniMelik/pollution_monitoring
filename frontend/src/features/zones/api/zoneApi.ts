import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { Zone } from '../types/zone.types'

export const zoneApi = {
  async list(siteId?: string): Promise<Zone[]> {
    const url = siteId ? endpoints.zones.bySite(siteId) : endpoints.zones.base
    const resp = await api.get<ApiSuccess<Zone[]>>(url)
    return unwrap(resp.data)
  },
  async byId(id: string): Promise<Zone> {
    const resp = await api.get<ApiSuccess<Zone>>(endpoints.zones.byId(id))
    return unwrap(resp.data)
  },
}
