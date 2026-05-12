import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { KPIConfig, KPIHistory, KPIHistoryPoint, KPISummary } from '../types/kpi.types'

export interface SummaryParams {
  siteId?: string
  zoneId?: string
  period?: 'hour' | 'day' | 'week' | 'month' | 'year'
  from?: string
  to?: string
}

type PeriodBucket = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

type RawSummaryPolluant = {
  name?: string
  tauxDepassement?: number
  emissionKgDay?: number
  reductionPct?: number
}

type RawSummaryPayload = {
  period?: string
  periodStart?: string
  periodEnd?: string
  globalIPE?: number | null
  polluants?: RawSummaryPolluant[]
}

// The backend expects an UPPERCASE period + explicit ISO periodStart/periodEnd.
// The frontend uses lowercase period labels ('hour' | 'day' | ...). Adapt here
// so callers can keep using the user-facing values.
const PERIOD_MAP: Record<NonNullable<SummaryParams['period']>, PeriodBucket> = {
  hour: 'HOURLY',
  day: 'DAILY',
  week: 'WEEKLY',
  month: 'MONTHLY',
  // Backend has no YEARLY bucket; fall back to MONTHLY (schedulers still roll up into monthly docs)
  year: 'MONTHLY',
}

type RawPolluantRef = {
  _id: string
  name?: string
  formula?: string
}

let polluantCodeToIdCache: Record<string, string> | null = null

function normalizePolluantKey(value: string): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function isMongoObjectId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value)
}

async function resolvePolluantId(pollutantOrId: string): Promise<string> {
  if (isMongoObjectId(pollutantOrId)) return pollutantOrId

  const wantedKey = normalizePolluantKey(pollutantOrId)
  if (!wantedKey) return pollutantOrId

  if (polluantCodeToIdCache?.[wantedKey]) {
    return polluantCodeToIdCache[wantedKey]
  }

  const resp = await api.get<ApiSuccess<RawPolluantRef[]>>(endpoints.polluants.base)
  const polluants = unwrap(resp.data) ?? []

  const map: Record<string, string> = {}
  for (const p of polluants) {
    if (!p?._id) continue
    const keys = [p.name, p.formula].filter((k): k is string => Boolean(k))
    for (const key of keys) {
      const normalized = normalizePolluantKey(key)
      if (normalized) map[normalized] = p._id
    }
  }

  polluantCodeToIdCache = map
  return map[wantedKey] ?? pollutantOrId
}

function computePeriodWindow(period: NonNullable<SummaryParams['period']>): {
  periodStart: string
  periodEnd: string
} {
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
  const window =
    params.from && params.to
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

function normalizeSummaryPeriod(period: string | undefined): KPISummary['period'] {
  const p = String(period ?? '').toUpperCase()
  if (p === 'HOURLY') return 'hour'
  if (p === 'WEEKLY') return 'week'
  if (p === 'MONTHLY') return 'month'
  return 'day'
}

function normalizeSummary(raw: unknown): KPISummary {
  const fallback: KPISummary = {
    period: 'day',
    td: 0,
    emj: {},
    ipe: 0,
    rco2: 0,
    timestamp: new Date().toISOString(),
  }

  if (!raw || typeof raw !== 'object') return fallback

  const maybeKpi = raw as Partial<KPISummary>
  if (
    typeof maybeKpi.td === 'number' ||
    typeof maybeKpi.ipe === 'number' ||
    typeof maybeKpi.rco2 === 'number' ||
    typeof maybeKpi.emj === 'object'
  ) {
    return {
      period: maybeKpi.period ?? 'day',
      td: Number(maybeKpi.td ?? 0),
      emj: (maybeKpi.emj as Record<string, number>) ?? {},
      ipe: Number(maybeKpi.ipe ?? 0),
      rco2: Number(maybeKpi.rco2 ?? 0),
      deltas: maybeKpi.deltas,
      timestamp: maybeKpi.timestamp ?? new Date().toISOString(),
      siteId: maybeKpi.siteId,
    }
  }

  const summary = raw as RawSummaryPayload
  const emj: Record<string, number> = {}
  let tdAccumulator = 0
  let tdCount = 0
  let rco2 = 0

  for (const p of summary.polluants ?? []) {
    const code = normalizePolluantKey(p?.name ?? '')
    if (code) emj[code === 'PM25' ? 'PM' : code] = Number(p?.emissionKgDay ?? 0)
    if (Number.isFinite(p?.tauxDepassement)) {
      tdAccumulator += Number(p?.tauxDepassement)
      tdCount += 1
    }
    if (code === 'CO2' && Number.isFinite(p?.reductionPct)) {
      rco2 = Number(p?.reductionPct)
    }
  }

  return {
    period: normalizeSummaryPeriod(summary.period),
    td: tdCount > 0 ? Number((tdAccumulator / tdCount).toFixed(2)) : 0,
    emj,
    ipe: Number(summary.globalIPE ?? 0),
    rco2,
    timestamp: summary.periodEnd ?? summary.periodStart ?? new Date().toISOString(),
  }
}

export const kpiApi = {
  async summary(params: SummaryParams = {}): Promise<KPISummary> {
    const resp = await api.get<ApiSuccess<unknown>>(endpoints.kpi.summary, {
      params: toBackendSummaryParams(params),
    })
    return normalizeSummary(unwrap(resp.data))
  },

  async ipe(
    params: SummaryParams = {},
  ): Promise<{ value: number; components: Record<string, number> }> {
    const resp = await api.get<ApiSuccess<{ value: number; components: Record<string, number> }>>(
      endpoints.kpi.ipe,
      { params },
    )
    return unwrap(resp.data)
  },

  async td(pollutantId: string, params: SummaryParams = {}): Promise<{ value: number }> {
    const resp = await api.get<ApiSuccess<{ value: number }>>(endpoints.kpi.td(pollutantId), {
      params,
    })
    return unwrap(resp.data)
  },

  async emj(pollutantId: string, params: SummaryParams = {}): Promise<{ value: number }> {
    const resp = await api.get<ApiSuccess<{ value: number }>>(endpoints.kpi.emj(pollutantId), {
      params,
    })
    return unwrap(resp.data)
  },

  async rco2(pollutantId: string, params: SummaryParams = {}): Promise<{ value: number }> {
    const resp = await api.get<ApiSuccess<{ value: number }>>(endpoints.kpi.rco2(pollutantId), {
      params,
    })
    return unwrap(resp.data)
  },

  /**
   * Backend returns `{ success, polluantId, period, count, data: AggregateData[] }`
   * (not `{ data: KPIHistory }`). Map `avgValue` + `periodStart` → points.
   */
  async history(pollutantId: string, params: SummaryParams = {}): Promise<KPIHistory> {
    const periodKey = params.period ?? 'month'
    const resolvedPolluantId = await resolvePolluantId(pollutantId)
    const historyLimit = periodKey === 'day' ? 45 : 30
    const resp = await api.get<{
      success: boolean
      polluantId?: string
      period?: string
      data?: Array<{
        periodStart?: string
        timestamp?: string
        avgValue?: number
        value?: number
      }>
    }>(endpoints.kpi.history(resolvedPolluantId), {
      params: { period: PERIOD_MAP[periodKey], limit: historyLimit },
    })
    const body = resp.data
    if (!body?.success || !Array.isArray(body.data)) {
      return { pollutantId: resolvedPolluantId, period: PERIOD_MAP[periodKey], points: [] }
    }
    const points: KPIHistoryPoint[] = body.data.map((row) => ({
      timestamp: new Date(row.periodStart ?? row.timestamp ?? 0).toISOString(),
      value: Number(row.avgValue ?? row.value ?? 0),
    }))
    return {
      pollutantId: String(body.polluantId ?? resolvedPolluantId),
      period: String(body.period ?? PERIOD_MAP[periodKey]),
      points,
    }
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
