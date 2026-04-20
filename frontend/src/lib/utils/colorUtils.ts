export type Status = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export const STATUS_TEXT: Record<Status, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-text-secondary',
}

export const STATUS_BG: Record<Status, string> = {
  success: 'bg-success-light',
  warning: 'bg-warning-light',
  danger: 'bg-danger-light',
  info: 'bg-info-light',
  neutral: 'bg-bg',
}

export const STATUS_BORDER: Record<Status, string> = {
  success: 'border-success',
  warning: 'border-warning',
  danger: 'border-danger',
  info: 'border-info',
  neutral: 'border-border',
}

/**
 * Compute a status from a single numeric value against a limit.
 * - ratio < warnBand => success
 * - warnBand <= ratio < 1 => warning
 * - ratio >= 1 => danger
 */
export function statusFromLimit(value: number, limit: number, warnBand = 0.8): Status {
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) return 'neutral'
  const ratio = value / limit
  if (ratio >= 1) return 'danger'
  if (ratio >= warnBand) return 'warning'
  return 'success'
}
