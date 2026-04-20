import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { Alert, AlertFilters, AlertStats } from '../types/alert.types'

// Backend currently returns raw Mongoose documents (no DTO applied in the
// list/detail controllers) so fields land in PascalCase Mongo shape:
// `_id`, `PolluantId` (populated object), `SensorId` (populated object),
// `isAcknowledged`. Normalize into the camelCase `Alert` shape the UI expects,
// most importantly the `id` field — without this, React's `key={a.id}` becomes
// `key={undefined}` and you get the "unique key prop" warning in AlertList.
type RawAlert = Partial<Alert> & {
  _id?: string
  PolluantId?: string | { _id?: string; name?: string } | null
  SensorId?: string | { _id?: string } | null
  isAcknowledged?: boolean
  acknowledged_at?: string
  // allow any extra server fields without tripping TS
  [k: string]: unknown
}

function normalizeAlert(raw: RawAlert): Alert {
  const pollutantName =
    typeof raw.pollutant === 'string'
      ? raw.pollutant
      : typeof raw.PolluantId === 'object' && raw.PolluantId?.name
        ? raw.PolluantId.name
        : typeof raw.PolluantId === 'string'
          ? raw.PolluantId
          : ''

  const sensorId =
    typeof raw.sensorId === 'string'
      ? raw.sensorId
      : typeof raw.SensorId === 'object' && raw.SensorId?._id
        ? String(raw.SensorId._id)
        : typeof raw.SensorId === 'string'
          ? raw.SensorId
          : undefined

  return {
    ...raw,
    id: (raw.id ?? raw._id ?? '') as string,
    pollutant: pollutantName,
    sensorId,
    acknowledged: raw.acknowledged ?? raw.isAcknowledged ?? false,
    acknowledgedAt: raw.acknowledgedAt ?? raw.acknowledged_at,
  } as Alert
}

export const alertApi = {
  async list(filters: AlertFilters = {}): Promise<{ items: Alert[]; total: number; page: number; pageSize: number }> {
    // Backend currently returns `{ success, count, data: Alert[] }` for
    // GET /api/alerts (no server-side pagination). Adapt that flat shape into
    // the paginated envelope the UI expects.
    const resp = await api.get<ApiSuccess<RawAlert[] | { alerts: RawAlert[]; total?: number; page?: number; pageSize?: number }>>(
      endpoints.alerts.base,
      { params: filters },
    )
    const data = unwrap(resp.data)
    const rawItems: RawAlert[] = Array.isArray(data) ? data : (data?.alerts ?? [])
    const items = rawItems.map(normalizeAlert)
    const pageSize = (filters as { pageSize?: number })?.pageSize ?? items.length
    const page = (filters as { page?: number })?.page ?? 1
    return {
      items,
      total: Array.isArray(data) ? items.length : (data?.total ?? items.length),
      page: Array.isArray(data) ? page : (data?.page ?? page),
      pageSize: Array.isArray(data) ? pageSize : (data?.pageSize ?? pageSize),
    }
  },

  async byId(id: string): Promise<Alert> {
    const resp = await api.get<ApiSuccess<RawAlert>>(endpoints.alerts.byId(id))
    return normalizeAlert(unwrap(resp.data))
  },

  async stats(params: { siteId?: string; zoneId?: string } = {}): Promise<AlertStats> {
    const resp = await api.get<ApiSuccess<AlertStats>>(endpoints.alerts.stats, { params })
    return unwrap(resp.data)
  },

  async acknowledge(id: string): Promise<Alert> {
    const resp = await api.post<ApiSuccess<RawAlert>>(endpoints.alerts.acknowledge(id))
    return normalizeAlert(unwrap(resp.data))
  },

  async escalate(id: string, note?: string): Promise<Alert> {
    const resp = await api.post<ApiSuccess<RawAlert>>(endpoints.alerts.escalate(id), { note })
    return normalizeAlert(unwrap(resp.data))
  },

  async resolve(id: string, note?: string): Promise<Alert> {
    const resp = await api.post<ApiSuccess<RawAlert>>(endpoints.alerts.resolve(id), { note })
    return normalizeAlert(unwrap(resp.data))
  },
}
