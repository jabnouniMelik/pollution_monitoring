import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { Alert, AlertFilters, AlertSeverity, AlertStats, AlertType } from '../types/alert.types'

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

function normalizeSeverity(raw: unknown): AlertSeverity {
  const s = String(raw ?? '').toLowerCase()
  if (s === 'critical') return 'critical'
  // 'high' is treated as critical in the frontend (escalated state)
  if (s === 'high') return 'critical'
  if (s === 'warning') return 'warning'
  if (s === 'info') return 'info'
  return 'info'
}

function normalizeType(raw: unknown): AlertType {
  const t = String(raw ?? '').toLowerCase()
  if (t === 'threshold' || t === 'threshold_breach') return 'threshold_breach'
  if (t === 'sensorfault' || t === 'sensor_malfunction') return 'sensor_malfunction'
  if (t === 'anomaly' || t === 'calibration_due') return 'calibration_due'
  return 'threshold_breach'
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

  // Extract node name and zone from the populated SensorId → sensorNodeId chain
  const sensorNode =
    typeof raw.SensorId === 'object' && raw.SensorId !== null
      ? (raw.SensorId as any)?.sensorNodeId
      : null

  const nodeName: string | undefined =
    typeof sensorNode === 'object' && sensorNode !== null
      ? sensorNode.nom ?? undefined
      : undefined

  const zoneName: string | undefined =
    typeof sensorNode === 'object' && sensorNode !== null
      ? sensorNode.zone ?? undefined
      : undefined

  return {
    ...raw,
    id: (raw.id ?? raw._id ?? '') as string,
    pollutant: pollutantName,
    sensorId,
    nodeName,
    zoneName,
    // acknowledged = operator explicitly acknowledged it (isAcknowledged flag)
    // resolving does NOT imply acknowledging
    acknowledged: raw.acknowledged ?? raw.isAcknowledged ?? false,
    acknowledgedAt: raw.acknowledgedAt ?? raw.acknowledged_at,
    acknowledgedBy: raw.acknowledgedBy as string | undefined,
    // resolved = resolvedAt is set (either manual or auto-resolve)
    resolved: !!(raw.resolved ?? raw.resolvedAt),
    resolvedAt: raw.resolvedAt as string | undefined,
    resolvedBy: raw.resolvedBy as string | undefined,
    severity: normalizeSeverity(raw.severity),
    type: normalizeType(raw.type),
  } as Alert
}

export const alertApi = {
  async list(filters: AlertFilters = {}): Promise<{ items: Alert[]; total: number; page: number; pageSize: number }> {
    // Backend now returns paginated response:
    // { success, data: Alert[], pagination: { total, page, pageSize, totalPages } }
    const resp = await api.get<ApiSuccess<RawAlert[]> & { pagination?: { total: number; page: number; pageSize: number; totalPages: number } }>(
      endpoints.alerts.base,
      { params: filters },
    )
    const data = unwrap(resp.data)
    const rawItems: RawAlert[] = Array.isArray(data) ? data : []
    const items = rawItems.map(normalizeAlert)
    
    // Extract pagination from response
    const pagination = (resp.data as any)?.pagination
    
    return {
      items,
      total: pagination?.total ?? items.length,
      page: pagination?.page ?? (filters.page ?? 1),
      pageSize: pagination?.pageSize ?? (filters.pageSize ?? 20),
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

  async escalate(id: string, newSeverity: string, reason?: string): Promise<Alert> {
    const resp = await api.post<ApiSuccess<RawAlert>>(endpoints.alerts.escalate(id), { newSeverity, reason })
    return normalizeAlert(unwrap(resp.data))
  },

  async resolve(id: string, note?: string): Promise<Alert> {
    const resp = await api.post<ApiSuccess<RawAlert>>(endpoints.alerts.resolve(id), { note })
    return normalizeAlert(unwrap(resp.data))
  },
}
