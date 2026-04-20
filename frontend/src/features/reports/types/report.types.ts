export type ReportFormat = 'pdf' | 'csv' | 'xlsx'

export interface Report {
  id: string
  title: string
  period: string
  generatedAt: string
  generatedBy?: string
  siteId?: string
  format: ReportFormat
  sizeBytes?: number
  url?: string
  status?: 'pending' | 'ready' | 'failed'
}

export interface GenerateReportPayload {
  title: string
  from: string
  to: string
  siteId?: string
  zoneId?: string
  format: ReportFormat
  includeCompliance?: boolean
  includeAlerts?: boolean
}
