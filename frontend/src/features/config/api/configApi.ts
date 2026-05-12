import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { PollutantThresholdLimits, ThresholdConfig } from '@/features/kpi/types/kpi.types'

// Backend returns a single Mongoose doc with French keys (`polluants`) and no
// `siteId` (config is global). The UI expects `ThresholdConfig` with `pollutants`,
// so we normalize here. Returning [] on a 404 keeps the Compliance page
// rendering with regulatory limits even when no site config has been provisioned yet.
type RawThresholdConfig = {
  _id?: string
  siteId?: string
  polluants?: Record<string, PollutantThresholdLimits>
  pollutants?: ThresholdConfig['pollutants']
}

/** Merge backend keys (NOx) with frontend codes (NOX) for lookups. */
function aliasPollutantKeys(
  pollutants: Record<string, PollutantThresholdLimits>,
): Record<string, PollutantThresholdLimits> {
  const out = { ...pollutants }
  if (pollutants.NOx && !pollutants.NOX) {
    out.NOX = pollutants.NOx
  }
  return out
}

function normalize(raw: RawThresholdConfig | RawThresholdConfig[] | null | undefined): ThresholdConfig[] {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((cfg) => ({
    _id: cfg._id,
    siteId: cfg.siteId,
    pollutants: aliasPollutantKeys(
      (cfg.pollutants ?? cfg.polluants ?? {}) as Record<string, PollutantThresholdLimits>,
    ),
  }))
}

export type PollutantsPayload = Record<
  string,
  {
    min: number
    max: number
    warning: number
    critical: number
    unit: string
    reference?: string
  }
>

export const thresholdApi = {
  /** Active global threshold config. Backend has no `GET /thresholds/site/:id`; `siteId` is ignored. */
  async list(_siteId?: string): Promise<ThresholdConfig[]> {
    const url = endpoints.thresholds.base
    try {
      const resp = await api.get<ApiSuccess<RawThresholdConfig | RawThresholdConfig[]>>(url)
      return normalize(unwrap(resp.data))
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (status === 404) return []
      throw err
    }
  },

  async updateAllPollutants(configId: string, pollutantsData: PollutantsPayload): Promise<ThresholdConfig> {
    const resp = await api.put<ApiSuccess<RawThresholdConfig>>(
      endpoints.thresholds.allPollutants(configId),
      { pollutantsData },
    )
    return normalize(unwrap(resp.data))[0]
  },

  async resetToDefaults(configId: string): Promise<ThresholdConfig> {
    const resp = await api.put<ApiSuccess<RawThresholdConfig>>(endpoints.thresholds.reset(configId))
    return normalize(unwrap(resp.data))[0]
  },
}
