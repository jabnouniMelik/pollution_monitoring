import axios from 'axios'
import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type {
  GenerateReportPayload,
  Report,
  ReportAuthor,
  ReportFormat,
  ReportWorkflowStatus,
} from '../types/report.types'

type RawReport = Partial<Report> & {
  _id?: string
  periodStart?: string
  periodEnd?: string
  fileUrl?: string
  status?: string
  format?: string
  generatedBy?: string | ReportAuthor & { _id?: string }
  approvedBy?: string | ReportAuthor & { _id?: string }
  rejectedBy?: string | ReportAuthor & { _id?: string }
}

function inferFormat(url?: string): ReportFormat {
  if (!url) return 'pdf'
  const ext = url.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  return 'pdf'
}

function formatPeriod(start?: string, end?: string): string {
  if (!start && !end) return '—'
  const toDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')
  return `${toDate(start)} → ${toDate(end)}`
}

function resolveAuthorName(
  author?: string | (ReportAuthor & { _id?: string }),
): string | undefined {
  if (!author) return undefined
  if (typeof author === 'string') return author
  return author.username || author.email
}

function resolveAuthorId(
  author?: string | (ReportAuthor & { _id?: string }),
): string | undefined {
  if (!author) return undefined
  if (typeof author === 'string') return author
  return author.id || author._id
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function normalizeReport(raw: RawReport): Report {
  const rawUrl = raw.url ?? raw.fileUrl
  const url = rawUrl
    ? rawUrl.startsWith('http')
      ? rawUrl
      : `${API_BASE}${rawUrl}`
    : undefined

  const rawFormat = typeof raw.format === 'string' ? raw.format.toLowerCase() : undefined
  const format: ReportFormat =
    rawFormat === 'pdf' || rawFormat === 'csv' || rawFormat === 'xlsx'
      ? rawFormat
      : inferFormat(url)

  const workflowStatus = (raw.status ?? raw.workflowStatus ?? 'DRAFT') as ReportWorkflowStatus

  return {
    id: (raw.id ?? raw._id ?? '') as string,
    title: raw.title ?? `Rapport du ${new Date(raw.generatedAt ?? Date.now()).toLocaleDateString('fr-FR')}`,
    period: raw.period ?? formatPeriod(raw.periodStart, raw.periodEnd),
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    generatedBy: raw.generatedBy,
    generatedById: resolveAuthorId(raw.generatedBy),
    generatedByName: resolveAuthorName(raw.generatedBy),
    siteId: raw.siteId,
    format,
    sizeBytes: raw.sizeBytes,
    url,
    workflowStatus,
    submittedAt: raw.submittedAt,
    approvedAt: raw.approvedAt,
    rejectedAt: raw.rejectedAt,
    approvedByName: resolveAuthorName(raw.approvedBy),
    rejectedByName: resolveAuthorName(raw.rejectedBy),
    rejectionReason: raw.rejectionReason,
    notes: raw.notes,
  }
}

export const reportApi = {
  async list(params: { siteId?: string; status?: ReportWorkflowStatus } = {}): Promise<Report[]> {
    const resp = await api.get<ApiSuccess<RawReport[]>>(endpoints.reports.base, { params })
    const raw = unwrap(resp.data) ?? []
    return (Array.isArray(raw) ? raw : []).map(normalizeReport)
  },

  async byId(id: string): Promise<Report> {
    const resp = await api.get<ApiSuccess<RawReport>>(endpoints.reports.byId(id))
    return normalizeReport(unwrap(resp.data))
  },

  async generate(payload: GenerateReportPayload): Promise<Report> {
    const body = {
      periodStart: payload.from,
      periodEnd: payload.to,
      title: payload.title,
      format: payload.format,
      siteId: payload.siteId,
      zoneId: payload.zoneId,
      includeCompliance: payload.includeCompliance,
      includeAlerts: payload.includeAlerts,
    }
    const resp = await api.post<ApiSuccess<RawReport>>(endpoints.reports.generate, body)
    return normalizeReport(unwrap(resp.data))
  },

  async submit(id: string): Promise<Report> {
    const resp = await api.post<ApiSuccess<RawReport>>(endpoints.reports.submit(id))
    return normalizeReport(unwrap(resp.data))
  },

  async approve(id: string, notes?: string): Promise<Report> {
    const resp = await api.post<ApiSuccess<RawReport>>(endpoints.reports.approve(id), { notes })
    return normalizeReport(unwrap(resp.data))
  },

  async reject(id: string, reason: string): Promise<Report> {
    const resp = await api.post<ApiSuccess<RawReport>>(endpoints.reports.reject(id), {
      rejectionReason: reason,
    })
    return normalizeReport(unwrap(resp.data))
  },

  async remove(id: string): Promise<void> {
    await api.delete(endpoints.reports.byId(id))
  },

  async export(id: string): Promise<Blob> {
    const r = await reportApi.byId(id)
    if (!r.url) {
      throw new Error('Aucun fichier associé à ce rapport.')
    }
    if (r.url.startsWith('http://') || r.url.startsWith('https://')) {
      const resp = await axios.get<Blob>(r.url, { responseType: 'blob' })
      return resp.data
    }
    const resp = await api.get<Blob>(r.url, { responseType: 'blob' })
    return resp.data
  },
}
