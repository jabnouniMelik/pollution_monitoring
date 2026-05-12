import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { Reading, ReadingQuery } from '../types/reading.types'

type RawPolluantRef = {
  _id: string
  name?: string
  code?: string
  formula?: string
}

let polluantCodeToIdCache: Record<string, string> | null = null

// Reset cache on module reload (dev HMR) or explicit call
export function resetPolluantCache() {
  polluantCodeToIdCache = null
}

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
    // Map by name, code, and formula — all normalized to uppercase
    const keys = [p.name, p.code, p.formula].filter((k): k is string => Boolean(k))
    for (const key of keys) {
      const normalized = normalizePolluantKey(key)
      if (normalized) map[normalized] = p._id
    }
  }
  // Also add PM → PM25 alias
  if (map['PM25'] && !map['PM']) map['PM'] = map['PM25']
  if (map['PM'] && !map['PM25']) map['PM25'] = map['PM']

  polluantCodeToIdCache = map
  return map[wantedKey] ?? pollutantOrId
}

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

interface BackendLatestReadingGroup {
  _id: string
  latestReading?: BackendReading
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
 * (10-second timestamp, node). Each group exposes a `measurements` map
 * keyed by pollutant code (CO2, NOX, …), which is the shape the Overview
 * page consumes.
 */
function adaptReadings(rows: BackendReading[]): Reading[] {
  if (!Array.isArray(rows)) return []

  const groups = new Map<string, Reading>()
  const BUCKET = 30_000 // 30 seconds — matches the slowest simulator interval (NOX/SO2/COV)

  for (const row of rows) {
    if (!row || typeof row.value !== 'number') continue

    const ts = new Date(row.timestamp)
    if (Number.isNaN(ts.getTime())) continue

    const bucket = new Date(Math.floor(ts.getTime() / BUCKET) * BUCKET).toISOString()
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

    // Handle PolluantId as either object or string ID
    const pollutant = getPollutantObject(row.PolluantId)
    let pollutantName = pollutant?.name

    // If PolluantId is a string ID and we don't have the name, we can use unit hints
    // from the row itself (backend already includes unit for latest readings)
    if (!pollutantName && typeof row.PolluantId === 'string' && row.unit) {
      // Map units to pollutant names as fallback
      const unitMap: Record<string, string> = {
        ppm: 'CO2',
        'mg/Nm³': 'NOX', // or SO2, COV - ambiguous but will work
        'µg/m³': 'PM25',
        '°C': 'TEMPERATURE',
        '%RH': 'HUMIDITY',
        '%': 'HUMIDITY',
      }
      pollutantName = unitMap[row.unit]
    }

    const code = normalizePollutantCode(pollutantName)
    if (!code) continue

    // Keep the max (latest bucket already ensures time grouping; if the same
    // pollutant appears twice in one 30s window, we take the higher value).
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

async function buildQuery(params: ReadingQuery, defaultLimit: number) {
  const qp: Record<string, string | number> = { limit: params.limit ?? defaultLimit }
  if (params.sensorId) qp.sensorId = params.sensorId
  if (params.siteId) qp.siteId = params.siteId
  if (params.zoneId) qp.zoneId = params.zoneId
  if (params.nodeId) qp.nodeId = params.nodeId
  if (params.pollutant) qp.polluantId = await resolvePolluantId(params.pollutant)
  if (params.from) qp.from = params.from
  if (params.to) qp.to = params.to
  return qp
}

export const readingApi = {
  async latest(params: ReadingQuery = {}): Promise<Reading[]> {
    const qp: Record<string, string | number> = { limit: params.limit ?? 200 }
    if (params.siteId) qp.siteId = params.siteId
    if (params.zoneId) qp.zoneId = params.zoneId
    if (params.nodeId) qp.nodeId = params.nodeId
    else if (params.sensorId) qp.sensorId = params.sensorId
    if (params.pollutant) qp.polluantId = await resolvePolluantId(params.pollutant)

    const resp = await api.get<ApiSuccess<Array<BackendReading | BackendLatestReadingGroup>>>(
      endpoints.readings.latest,
      {
        params: qp,
      },
    )
    const rawRows = unwrap(resp.data) ?? []
    const rows = rawRows
      .map((row) =>
        row && typeof row === 'object' && 'latestReading' in row && row.latestReading
          ? row.latestReading
          : (row as BackendReading),
      )
      .filter((row): row is BackendReading => Boolean(row && row.timestamp))
    return adaptReadings(rows)
  },
  async history(params: ReadingQuery = {}): Promise<Reading[]> {
    const resp = await api.get<ApiSuccess<BackendReading[]>>(endpoints.readings.base, {
      params: await buildQuery(params, 500),
    })
    const rows = unwrap(resp.data) ?? []
    return adaptReadings(rows)
  },
}
