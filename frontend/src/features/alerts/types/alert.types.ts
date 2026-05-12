export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertType = 'threshold_breach' | 'sensor_malfunction' | 'calibration_due'
export type AlertStatus = 'open' | 'acknowledged' | 'escalated' | 'resolved'

export interface Alert {
  id: string
  sensorId?: string
  sensor?: string
  nodeId?: string
  nodeName?: string   // SensorNode name
  siteId?: string
  siteName?: string   // populated site name
  zoneId?: string
  zoneName?: string   // populated zone name (from SensorNode.zone)
  pollutant: string
  type: AlertType
  severity: AlertSeverity
  status?: AlertStatus
  message: string
  value: number
  threshold: number
  unit?: string
  timestamp: string
  acknowledged?: boolean
  acknowledgedAt?: string
  acknowledgedBy?: string
  resolved?: boolean
  resolvedAt?: string
  resolvedBy?: string
  resolutionNote?: string
}

export interface AlertFilters {
  severity?: AlertSeverity
  status?: AlertStatus
  pollutant?: string
  siteId?: string
  zoneId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  search?: string
}

export interface AlertStats {
  total: number
  critical: number
  warning: number
  info: number
  open: number
  acknowledged: number
  resolved: number
}
