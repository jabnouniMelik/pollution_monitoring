export type ReportFormat = 'pdf' | 'csv' | 'xlsx'

export type ReportWorkflowStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export interface ReportAuthor {
  id?: string
  username?: string
  email?: string
}

export interface Report {
  id: string
  title: string
  period: string
  generatedAt: string
  generatedBy?: string | ReportAuthor
  generatedById?: string
  generatedByName?: string
  siteId?: string
  format: ReportFormat
  sizeBytes?: number
  url?: string
  workflowStatus: ReportWorkflowStatus
  submittedAt?: string
  approvedAt?: string
  rejectedAt?: string
  approvedByName?: string
  rejectedByName?: string
  rejectionReason?: string
  notes?: string
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
