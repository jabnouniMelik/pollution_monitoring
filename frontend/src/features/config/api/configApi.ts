import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { ThresholdConfig } from '@/features/kpi/types/kpi.types'

// Backend returns a single Mongoose doc with French keys (`polluants`) and no
// `siteId` (config is global). The UI expects an array of `ThresholdConfig`
// with `pollutants`, so we normalize here. Returning [] on a 404 keeps the
// Compliance page rendering with regulatory limits even when no site config
// has been provisioned yet.
type RawThresholdConfig = {
  _id?: string
  siteId?: string
  polluants?: Record<string, { min: number; max: number; warning: number; critical: number; unit: string }>
  pollutants?: ThresholdConfig['pollutants']
}

function normalize(raw: RawThresholdConfig | RawThresholdConfig[] | null | undefined): ThresholdConfig[] {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((cfg) => ({
    siteId: cfg.siteId,
    pollutants: cfg.pollutants ?? cfg.polluants ?? {},
  }))
}

export const thresholdApi = {
  async list(siteId?: string): Promise<ThresholdConfig[]> {
    const url = siteId ? endpoints.thresholds.bySite(siteId) : endpoints.thresholds.base
    try {
      const resp = await api.get<ApiSuccess<RawThresholdConfig | RawThresholdConfig[]>>(url)
      return normalize(unwrap(resp.data))
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (status === 404) return []
      throw err
    }
  },
  async update(id: string, payload: Partial<ThresholdConfig>): Promise<ThresholdConfig> {
    const resp = await api.put<ApiSuccess<RawThresholdConfig>>(endpoints.thresholds.byId(id), payload)
    return normalize(unwrap(resp.data))[0]
  },
}
