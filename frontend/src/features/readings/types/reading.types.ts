export interface Measurement {
  value: number
  unit: string
}

export interface Reading {
  id: string
  sensorId: string
  nodeId?: string
  siteId?: string
  zoneId?: string
  timestamp: string
  measurements: Record<string, Measurement>
}

export interface ReadingQuery {
  siteId?: string
  zoneId?: string
  sensorId?: string
  pollutant?: string
  from?: string
  to?: string
  limit?: number
}
