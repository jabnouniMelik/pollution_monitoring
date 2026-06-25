import type { ThresholdConfig } from '../types/kpi.types'

export interface Reading {
  timestamp: string | Date
  measurements: Record<string, { value: number; unit: string } | undefined>
}

/**
 * TD — Taux de Dépassement (Exceedance Rate).
 * Fraction (in %) of readings that exceed the limit for a given pollutant.
 * Target per Décret 2018-928: TD ≤ 2%.
 */
export function calculateTD(readings: Reading[], pollutant: string, limit: number): number {
  if (readings.length === 0) return 0
  const exceedances = readings.filter((r) => {
    const value = r.measurements[pollutant]?.value
    return typeof value === 'number' && value > limit
  }).length
  return (exceedances / readings.length) * 100
}

/**
 * EMJ — Émission Massique Journalière.
 * Converts mean concentration (mg/Nm³) + airflow (Nm³/s) into kg/day.
 * Formula: airflow * concentration * durationSeconds / 1e6
 */
export function calculateEMJ(
  averageConcentration: number,
  airflow: number,
  durationSeconds = 86_400,
): number {
  if (!Number.isFinite(averageConcentration) || !Number.isFinite(airflow)) return 0
  return (airflow * averageConcentration * durationSeconds) / 1_000_000
}

/**
 * IPE — Indice de Performance Environnementale (0..100, higher = better).
 * Weighted inverse of normalized pollutant loads: IPE = 100 - Σ (normalized × weight)
 */
export function calculateIPE(
  pollutants: Record<string, number>,
  thresholds: ThresholdConfig,
  weights: Record<string, number>,
): number {
  let weightedLoad = 0
  let totalWeight = 0

  for (const [code, weight] of Object.entries(weights)) {
    const current = pollutants[code]
    const config = thresholds.pollutants[code]
    if (typeof current !== 'number' || !config) continue

    const range = config.max - config.min
    if (range <= 0) continue

    const normalized = Math.max(0, Math.min(100, ((current - config.min) / range) * 100))
    weightedLoad += normalized * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return 100
  return Math.max(0, 100 - weightedLoad / totalWeight)
}

/**
 * RCO2 — Variation % vs période de référence (négatif = réduction).
 */
export function calculateRCO2(current: number, reference: number): number {
  if (!Number.isFinite(reference) || reference === 0) return 0
  return ((current - reference) / reference) * 100
}

/**
 * Taux d'atteinte de l'objectif de réduction CO₂.
 * Ex. objectif -5 %, réel -3,2 % → 64 %.
 */
export function calculateRCO2GoalAttainment(
  reductionPct: number,
  targetReductionPct = -5,
): number {
  const target = Math.abs(targetReductionPct)
  if (target <= 0) return 100
  const achieved = -reductionPct
  if (!Number.isFinite(achieved) || achieved <= 0) return 0
  return Math.min(100, (achieved / target) * 100)
}

export type KPIKind = 'TD' | 'IPE' | 'RCO2' | 'EMJ'
export type KPIStatus = 'success' | 'warning' | 'danger'

/**
 * Returns a qualitative status for a KPI against its target.
 */
export function getKPIStatus(value: number, target: number, type: KPIKind): KPIStatus {
  switch (type) {
    case 'TD':
      if (value <= target) return 'success'
      if (value <= target * 1.5) return 'warning'
      return 'danger'
    case 'IPE':
      if (value >= target) return 'success'
      if (value >= target * 0.9) return 'warning'
      return 'danger'
    case 'RCO2':
      if (value <= target) return 'success'
      if (target < 0 && value <= target * 0.6) return 'warning'
      if (target >= 0 && value <= target * 1.25) return 'warning'
      return 'danger'
    case 'EMJ':
      if (!Number.isFinite(target)) return 'success'
      if (value <= target) return 'success'
      if (value <= target * 1.25) return 'warning'
      return 'danger'
    default:
      return 'success'
  }
}
