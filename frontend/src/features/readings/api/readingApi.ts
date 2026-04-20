import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { Reading, ReadingQuery } from '../types/reading.types'

/**
 * Shape actually returned by `GET /api/readings` (flat, one row per pollutant
 * sample — backend populates `PolluantId` with { name, unit, regulatoryLimit }).
 */
interface BackendReading {
  _id: string
  sensorId?:
    | string
    | {
        _id?: string
        name?: string
        model?: string
        type?: string
      }
  PolluantId?:
    | string
    | {
        _id?: string
        name?: string
        unit?: string
        regulatoryLimit?: number
      }
  nodeId?: string
  value: number
  unit?: string
  timestamp: string
}

/**
 * Normalize backend pollutant names to the codes the UI expects.
 * Backend uses: CO2, NOX, SO2, COV, PM25, TEMPERATURE, HUMIDITY.
 * UI constants use: CO2, NOX, SO2, COV, PM (+ others), so PM25 → PM.
 */
function normalizePollutantCode(name: string | undefined): string | undefined {
  if (!name) return undefined
  const upper = name.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (upper === 'PM25' || upper === 'PM2') return 'PM'
  return upper
}

function getPollutantObject(
  p: BackendReading['PolluantId'],
): { name?: string; unit?: string } | undefined {
  return typeof p === 'object' && p !== null ? p : undefined
}

function getSensorId(s: BackendReading['sensorId']): string {
  if (!s) return ''
  if (typeof s === 'string') return s
  return s._id ?? ''
}

/**
 * Collapse the flat per-pollutant rows into `Reading` objects grouped by
 * (rounded-minute timestamp, node). Each group exposes a `measurements` map
 * keyed by pollutant code (CO2, NOX, …), which is the shape the Overview
 * page consumes.
 */
function adaptReadings(rows: BackendReading[]): Reading[] {
  if (!Array.isArray(rows)) return []

  const groups = new Map<string, Reading>()
  const MINUTE = 60_000

  for (const row of rows) {
    if (!row || typeof row.value !== 'number') continue

    const ts = new Date(row.timestamp)
    if (Number.isNaN(ts.getTime())) continue

    const bucket = new Date(Math.floor(ts.getTime() / MINUTE) * MINUTE).toISOString()
    const nodeId = row.nodeId ?? ''
    const key = `${bucket}|${nodeId}`

    let reading = groups.get(key)
    if (!reading) {
      reading = {
        id: key,
        sensorId: getSensorId(row.sensorId),
        nodeId: nodeId || undefined,
        timestamp: bucket,
        measurements: {},
      }
      groups.set(key, reading)
    }

    const pollutant = getPollutantObject(row.PolluantId)
    const code = normalizePollutantCode(pollutant?.name)
    if (!code) continue

    // Keep the max (latest bucket already ensures time grouping; if the same
    // pollutant appears twice in one minute, we take the higher value).
    const existing = reading.measurements[code]
    if (!existing || row.value > existing.value) {
      reading.measurements[code] = {
        value: row.value,
        unit: row.unit ?? pollutant?.unit ?? '',
      }
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

function buildQuery(params: ReadingQuery, defaultLimit: number) {
  const qp: Record<string, string | number> = { limit: params.limit ?? defaultLimit }
  if (params.sensorId) qp.sensorId = params.sensorId
  if (params.pollutant) qp.polluantId = params.pollutant
  if (params.from) qp.from = params.from
  if (params.to) qp.to = params.to
  return qp
}

export const readingApi = {
  async latest(params: ReadingQuery = {}): Promise<Reading[]> {
    const resp = await api.get<ApiSuccess<BackendReading[]>>(endpoints.readings.base, {
      params: buildQuery(params, 200),
    })
    const rows = unwrap(resp.data) ?? []
    return adaptReadings(rows)
  },
  async history(params: ReadingQuery = {}): Promise<Reading[]> {
    const resp = await api.get<ApiSuccess<BackendReading[]>>(endpoints.readings.base, {
      params: buildQuery(params, 500),
    })
    const rows = unwrap(resp.data) ?? []
    return adaptReadings(rows)
  },
}
