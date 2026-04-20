import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { KPIConfig, KPIHistory, KPISummary } from '../types/kpi.types'

export interface SummaryParams {
  siteId?: string
  zoneId?: string
  period?: 'hour' | 'day' | 'week' | 'month' | 'year'
  from?: string
  to?: string
}

// The backend expects an UPPERCASE period + explicit ISO periodStart/periodEnd.
// The frontend uses lowercase period labels ('hour' | 'day' | ...). Adapt here
// so callers can keep using the user-facing values.
const PERIOD_MAP: Record<NonNullable<SummaryParams['period']>, 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY'> = {
  hour: 'HOURLY',
  day: 'DAILY',
  week: 'WEEKLY',
  month: 'MONTHLY',
  // Backend has no YEARLY bucket; fall back to MONTHLY (schedulers still roll up into monthly docs)
  year: 'MONTHLY',
}

function computePeriodWindow(period: NonNullable<SummaryParams['period']>): { periodStart: string; periodEnd: string } {
  const end = new Date()
  const start = new Date(end)
  switch (period) {
    case 'hour':
      start.setHours(start.getHours() - 1)
      break
    case 'day':
      start.setDate(start.getDate() - 1)
      break
    case 'week':
      start.setDate(start.getDate() - 7)
      break
    case 'month':
      start.setMonth(start.getMonth() - 1)
      break
    case 'year':
      start.setFullYear(start.getFullYear() - 1)
      break
  }
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() }
}

function toBackendSummaryParams(params: SummaryParams): Record<string, string> {
  const period = params.period ?? 'day'
  const window = params.from && params.to
    ? { periodStart: params.from, periodEnd: params.to }
    : computePeriodWindow(period)
  const out: Record<string, string> = {
    period: PERIOD_MAP[period],
    ...window,
  }
  if (params.siteId) out.siteId = params.siteId
  if (params.zoneId) out.zoneId = params.zoneId
  return out
}

export const kpiApi = {
  async summary(params: SummaryParams = {}): Promise<KPISummary> {
    const resp = await api.get<ApiSuccess<KPISummary>>(endpoints.kpi.summary, {
      params: toBackendSummaryParams(params),
    })
    return unwrap(resp.data)
  },

  async ipe(params: SummaryParams = {}): Promise<{ value: number; components: Record<string, number> }> {
    const resp = await api.get<ApiSuccess<{ value: number; components: Record<string, number> }>>(
      endpoints.kpi.ipe,
      { params },
    )
    return unwrap(resp.data)
  },

  async td(pollutantId: string, params: SummaryParams = {}): Promise<{ value: number }> {
    const resp = await api.get<ApiSuccess<{ value: number }>>(endpoints.kpi.td(pollutantId), { params })
    return unwrap(resp.data)
  },

  async emj(pollutantId: string, params: SummaryParams = {}): Promise<{ value: number }> {
    const resp = await api.get<ApiSuccess<{ value: number }>>(endpoints.kpi.emj(pollutantId), { params })
    return unwrap(resp.data)
  },

  async rco2(pollutantId: string, params: SummaryParams = {}): Promise<{ value: number }> {
    const resp = await api.get<ApiSuccess<{ value: number }>>(endpoints.kpi.rco2(pollutantId), { params })
    return unwrap(resp.data)
  },

  async history(pollutantId: string, params: SummaryParams = {}): Promise<KPIHistory> {
    const resp = await api.get<ApiSuccess<KPIHistory>>(endpoints.kpi.history(pollutantId), { params })
    return unwrap(resp.data)
  },

  async config(): Promise<KPIConfig> {
    const resp = await api.get<ApiSuccess<RawKPIConfig>>(endpoints.kpi.config)
    return normalizeKPIConfig(unwrap(resp.data))
  },

  async updateAirflow(airflow: number) {
    const resp = await api.put<ApiSuccess<RawKPIConfig>>(endpoints.kpi.configAirflow, { airflow })
    return normalizeKPIConfig(unwrap(resp.data))
  },

  async updateWeights(weights: Record<string, number>) {
    const resp = await api.put<ApiSuccess<RawKPIConfig>>(endpoints.kpi.configWeights, { weights })
    return normalizeKPIConfig(unwrap(resp.data))
  },

  async updateTargets(targets: KPIConfig['targets']) {
    const resp = await api.put<ApiSuccess<RawKPIConfig>>(endpoints.kpi.configTargets, { targets })
    return normalizeKPIConfig(unwrap(resp.data))
  },
}

// Backend returns the config with French-flavoured field names
// (`polluantWeights`) and only the fields it chose to update on PUT endpoints
// (e.g. `{ airflow, updatedAt }` for updateAirflow). Normalize to the flat
// `KPIConfig` shape the UI expects and provide safe defaults so `Object.values`
// on `weights`/`targets` never crashes when the backend omits a field.
type RawKPIConfig = Partial<KPIConfig> & {
  polluantWeights?: Record<string, number>
  weights?: Record<string, number>
  targets?: Partial<KPIConfig['targets']>
  airflow?: number | null
}

function normalizeKPIConfig(raw: RawKPIConfig | null | undefined): KPIConfig {
  const weights = raw?.weights ?? raw?.polluantWeights ?? {}
  const targets = {
    TD: raw?.targets?.TD ?? 2,
    IPE: raw?.targets?.IPE ?? 95,
    RCO2: raw?.targets?.RCO2 ?? -5,
    EMJ: raw?.targets?.EMJ ?? 0,
  }
  return {
    airflow: typeof raw?.airflow === 'number' ? raw.airflow : 0,
    weights,
    targets,
    baseline: raw?.baseline,
  }
}
