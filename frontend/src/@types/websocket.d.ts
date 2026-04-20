export type WSConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

export interface WSKPIUpdate {
  type: 'kpi_update'
  topic: string
  timestamp: string
  data: {
    metrics: Record<string, number>
    pollutants: Record<string, number>
    sites?: Array<{ id: string; name: string; ipe?: number; td?: number }>
  }
}

export interface WSAlertMessage {
  type: 'alert'
  timestamp: string
  alert: {
    id?: string
    type: 'warning' | 'critical' | 'info'
    pollutant: string
    message: string
    threshold: number
    actualValue: number
    site?: string
    zone?: string
  }
}

export interface WSControlMessage {
  type: 'connected' | 'authenticated' | 'subscribed' | 'unsubscribed' | 'pong' | 'error'
  message?: string
  topics?: string[]
  clientId?: string
}

export type WSMessage = WSKPIUpdate | WSAlertMessage | WSControlMessage
