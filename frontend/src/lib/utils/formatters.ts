import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export function formatNumber(
  value: number | null | undefined,
  decimals = 1,
  locale = 'fr-FR',
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercentage(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${formatNumber(value, decimals)} %`
}

export function formatSignedDelta(value: number, decimals = 1, unit = '%'): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(value, decimals)}${unit}`
}

export function formatDate(
  value: string | Date | null | undefined,
  pattern = 'dd MMM yyyy',
): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? parseISO(value) : value
  if (!d || Number.isNaN(d.getTime())) return '—'
  return format(d, pattern, { locale: fr })
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, 'dd MMM yyyy HH:mm')
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? parseISO(value) : value
  if (!d || Number.isNaN(d.getTime())) return '—'
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: fr })
}

export function truncate(value: string, max = 80): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}
