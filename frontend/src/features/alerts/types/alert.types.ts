export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertType = 'threshold_breach' | 'sensor_malfunction' | 'calibration_due'
export type AlertStatus = 'open' | 'acknowledged' | 'escalated' | 'resolved'

export interface Alert {
  id: string
  sensorId?: string
  nodeId?: string
  siteId?: string
  zoneId?: string
  pollutant: string
  type: AlertType
  severity: AlertSeverity
  status?: AlertStatus
  message: string
  value: number
  threshold: number
  timestamp: string
  acknowledged?: boolean
  acknowledgedAt?: string
  acknowledgedBy?: string
  resolvedAt?: string
  resolvedBy?: string
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
