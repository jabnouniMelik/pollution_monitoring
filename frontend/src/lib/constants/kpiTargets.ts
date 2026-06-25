/**
 * Default KPI targets.
 * Backend may override these per site via `/api/kpi/config`.
 * Keep defaults aligned with Tunisia Décret 2018-928 guidelines.
 */
export const KPI_TARGETS = {
  /** TD — Taux de Dépassement. Lower is better. Unit: % */
  TD: { target: 2, warning: 3, comparator: '<=' as const, unit: '%' },
  /** IPE — Indice Performance Environnementale. Higher is better. Unit: /100 */
  IPE: { target: 95, warning: 85, comparator: '>=' as const, unit: '/100' },
  /** RCO2 — Réduction CO₂ (vs baseline). More negative = better. Unit: % */
  RCO2: { target: -5, warning: -2, comparator: '<=' as const, unit: '%' },
  /** EMJ — Émission Massique Journalière. Unit: kg/day. Target set per pollutant. */
  EMJ: { target: Number.POSITIVE_INFINITY, warning: Number.POSITIVE_INFINITY, comparator: '<=' as const, unit: 'kg/j' },
}

export type KPICode = keyof typeof KPI_TARGETS

export const DEFAULT_POLLUTANT_WEIGHTS: Record<string, number> = {
  CO2: 0.05,
  NOX: 0.30,
  SO2: 0.25,
  PM25: 0.15,
  PM10: 0.10,
  COV: 0.15,
}
