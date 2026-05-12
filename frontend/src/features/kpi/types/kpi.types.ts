import type { PollutantCode } from '@/lib/constants/pollutants'

export interface ThresholdEntry {
  pollutant: PollutantCode | string
  warning: number
  critical: number
  unit: string
  /** Derived from regulation (e.g. Décret 2010-2516) */
  regulatory?: number
  min?: number
  max?: number
}

/** One pollutant row in global threshold config (API + UI). */
export interface PollutantThresholdLimits {
  min: number
  max: number
  warning: number
  critical: number
  unit: string
  reference?: string
}

export interface ThresholdConfig {
  siteId?: string
  _id?: string
  pollutants: Record<string, PollutantThresholdLimits>
}

export interface KPIConfig {
  airflow: number
  weights: Record<string, number>
  targets: { TD: number; IPE: number; RCO2: number; EMJ?: number }
  baseline?: { CO2?: number }
}

export interface KPISummary {
  siteId?: string
  period: 'hour' | 'day' | 'week' | 'month' | 'year'
  td: number
  emj: Record<string, number>
  ipe: number
  rco2: number
  deltas?: { td?: number; ipe?: number; rco2?: number }
  timestamp: string
}

export interface KPIHistoryPoint {
  timestamp: string
  value: number
}

export interface KPIHistory {
  pollutantId: string
  period: string
  points: KPIHistoryPoint[]
}
