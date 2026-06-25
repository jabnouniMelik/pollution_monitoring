import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type {
  Zone,
  ZoneListResponse,
  ZoneFilters,
  CreateZoneInput,
  UpdateZoneInput,
  AssignOperatorInput,
} from '../types/zone.types'

function normalizeZone(raw: any): Zone {
  return {
    id: raw._id || raw.id,
    code: raw.code,
    nom: raw.nom,
    siteId: raw.siteId || raw.site_id,
    industrieId: raw.industrieId || raw.industrie_id,
    description: raw.description,
    localisation: raw.localisation,
    operatorsAssigned: raw.operatorsAssigned || raw.operators_assigned || [],
    pollutants: raw.pollutants || [],
    actif: raw.actif !== undefined ? raw.actif : true,
    sensorNodeCount: raw.sensorNodeCount || 0,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  }
}

export const zoneApi = {
  async list(filters: ZoneFilters = {}): Promise<ZoneListResponse> {
    const params = new URLSearchParams()
    if (filters.siteId) params.append('siteId', filters.siteId)
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.pageSize) params.append('pageSize', String(filters.pageSize))

    const queryString = params.toString()
    const url = queryString ? `${endpoints.zones.base}?${queryString}` : endpoints.zones.base

    const response = await api.get<any>(url)
    const data = unwrap(response.data) as any

    return {
      zones: (data?.zones || data || []).map(normalizeZone),
      total: data?.total || 0,
      page: data?.page || 1,
      pageSize: data?.pageSize || 10,
    }
  },

  async getById(id: string): Promise<Zone> {
    const response = await api.get<any>(endpoints.zones.byId(id))
    const data = unwrap(response.data) as any
    return normalizeZone(data)
  },

  async create(input: CreateZoneInput): Promise<Zone> {
    const response = await api.post<any>(endpoints.zones.base, input)
    const data = unwrap(response.data) as any
    return normalizeZone(data)
  },

  async update(id: string, input: UpdateZoneInput): Promise<Zone> {
    const response = await api.put<any>(endpoints.zones.byId(id), input)
    const data = unwrap(response.data) as any
    return normalizeZone(data)
  },

  async delete(id: string): Promise<void> {
    const response = await api.delete<any>(endpoints.zones.byId(id))
    unwrap(response.data)
  },

  async assignOperator(id: string, input: AssignOperatorInput): Promise<Zone> {
    const response = await api.post<any>(endpoints.zones.assignOperators(id), input)
    const data = unwrap(response.data) as any
    return normalizeZone(data)
  },

  async removeOperator(zoneId: string, operatorId: string): Promise<void> {
    const response = await api.delete<any>(endpoints.zones.removeOperator(zoneId, operatorId))
    unwrap(response.data)
  },

  async getBySite(siteId: string): Promise<Zone[]> {
    const response = await api.get<any>(endpoints.zones.bySite(siteId))
    const data = unwrap(response.data) as any
    return (data || []).map(normalizeZone)
  },

  async getSensorsCount(id: string): Promise<number> {
    const response = await api.get<any>(endpoints.zones.sensorsCount(id))
    const data = unwrap(response.data) as any
    return data?.sensorCount ?? data?.count ?? 0
  },
}
