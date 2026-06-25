import { formatNumber } from '@/lib/utils/formatters'
import type { KPIKind } from './kpiCalculations'

export function formatKPIValue(value: number, type: KPIKind): string {
  switch (type) {
    case 'TD':
    case 'RCO2':
      return `${formatNumber(value, 1)} %`
    case 'IPE':
      return `${formatNumber(value, 1)} / 100`
    case 'EMJ':
      return `${formatNumber(value, 1)} kg/j`
  }
}

export function kpiComparator(type: KPIKind): string {
  switch (type) {
    case 'IPE':
      return '≥'
    case 'TD':
    case 'RCO2':
    case 'EMJ':
      return '≤'
  }
}

/** Format a KPI target for display (RCO₂ targets are negative reductions). */
export function formatKpiTarget(value: number, type: KPIKind, decimals = 1): string {
  if (!Number.isFinite(value)) return '—'
  if (type === 'RCO2' && value > 0) {
    return formatNumber(-value, decimals)
  }
  return formatNumber(value, decimals)
}
