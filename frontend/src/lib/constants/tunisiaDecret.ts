/**
 * Tunisia Décret 2010-2516 — Valeurs limites d'émission (VLE).
 * Source: Journal Officiel de la République Tunisienne, décret n° 2010-2516.
 * Used as regulatory thresholds when no per-site override exists.
 *
 * IMPORTANT: These values are advisory defaults. The backend `ThresholdConfig`
 * is authoritative. Always prefer server-provided thresholds when available.
 */
export const TUNISIA_DECRET_LIMITS = {
  /** mg/Nm³ — general combustion sources */
  NOX: { limit: 500, unit: 'mg/Nm³', reference: 'Art. 14, Annexe II' },
  /** mg/Nm³ — general combustion sources */
  SO2: { limit: 1700, unit: 'mg/Nm³', reference: 'Art. 14, Annexe II' },
  /** mg/Nm³ — particulate matter */
  PM: { limit: 50, unit: 'mg/Nm³', reference: 'Art. 14, Annexe I' },
  /** mg/Nm³ — volatile organic compounds */
  COV: { limit: 150, unit: 'mg/Nm³', reference: 'Annexe IV' },
  /** ppm — informational (no hard VLE in décret) */
  CO2: { limit: 1000, unit: 'ppm', reference: 'Recommandation' },
} as const

export const DECRET_NAME = 'Décret n° 2010-2516'
export const DECRET_URL =
  'https://www.environnement.gov.tn/index.php/fr/reglementation/decrets'
