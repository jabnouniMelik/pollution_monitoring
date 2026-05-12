import axios from 'axios'
import { api, unwrap } from '@/lib/api/axios'
import { endpoints } from '@/lib/api/endpoints'
import type { GenerateReportPayload, Report, ReportFormat } from '../types/report.types'

// Backend Report shape (see backend/models/Report.js):
//   { _id, periodStart, periodEnd, overallScore, polluantScores, breachCount,
//     generatedAt, generatedBy, status: 'DRAFT'|'SUBMITTED'|'APPROVED', fileUrl }
// The UI expects the camelCase/flat shape defined in report.types.ts.
// Normalize here so `r.format.toUpperCase()` and friends can't crash on an
// undefined field.
type RawReport = Partial<Report> & {
  _id?: string
  periodStart?: string
  periodEnd?: string
  fileUrl?: string
  status?: string
  format?: string
}

const BACKEND_STATUS_MAP: Record<string, NonNullable<Report['status']>> = {
  DRAFT: 'pending',
  SUBMITTED: 'ready',
  APPROVED: 'ready',
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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function normalizeReport(raw: RawReport): Report {
  const rawUrl = raw.url ?? raw.fileUrl
  // fileUrl from backend is a relative path like /uploads/reports/xxx.pdf
  // Prepend the backend base URL so the browser fetches from the right server
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

  const status: Report['status'] = raw.status
    ? (BACKEND_STATUS_MAP[raw.status] ?? (raw.status as Report['status']))
    : 'ready'

  return {
    id: (raw.id ?? raw._id ?? '') as string,
    title: raw.title ?? `Rapport du ${new Date(raw.generatedAt ?? Date.now()).toLocaleDateString('fr-FR')}`,
    period: raw.period ?? formatPeriod(raw.periodStart, raw.periodEnd),
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    generatedBy: raw.generatedBy,
    siteId: raw.siteId,
    format,
    sizeBytes: raw.sizeBytes,
    url,
    status,
  }
}

export const reportApi = {
  async list(params: { siteId?: string; page?: number; pageSize?: number } = {}): Promise<Report[]> {
    const resp = await api.get<ApiSuccess<RawReport[]>>(endpoints.reports.base, { params })
    const raw = unwrap(resp.data) ?? []
    return (Array.isArray(raw) ? raw : []).map(normalizeReport)
  },
  async byId(id: string): Promise<Report> {
    const resp = await api.get<ApiSuccess<RawReport>>(endpoints.reports.byId(id))
    return normalizeReport(unwrap(resp.data))
  },
  async generate(payload: GenerateReportPayload): Promise<Report> {
    // Backend's /reports/generate expects { periodStart, periodEnd, generatedBy }
    // — translate the UI-friendly { from, to, title, format } payload.
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
  /**
   * Backend has no `GET /reports/:id/export`. Download via `fileUrl` or same-origin path.
   */
  async export(id: string): Promise<Blob> {
    const r = await reportApi.byId(id)
    if (!r.url) {
      throw new Error(
        'Aucun fichier associé à ce rapport. Export serveur non disponible (endpoint manquant côté API).',
      )
    }
    if (r.url.startsWith('http://') || r.url.startsWith('https://')) {
      const resp = await axios.get<Blob>(r.url, { responseType: 'blob' })
      return resp.data
    }
    const resp = await api.get<Blob>(r.url, { responseType: 'blob' })
    return resp.data
  },
}
