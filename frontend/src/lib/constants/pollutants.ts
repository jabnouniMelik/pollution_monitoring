/**
 * Canonical pollutant definitions.
 * Units and colors stay consistent across the dashboard.
 */
export const POLLUTANTS = {
  CO2: {
    code: 'CO2',
    label: 'CO₂',
    longLabel: 'Dioxyde de carbone',
    unit: 'ppm',
    color: '#2E7D32',
    tailwindColor: 'pollutant-co2',
  },
  NOX: {
    code: 'NOX',
    label: 'NOₓ',
    longLabel: 'Oxydes d’azote',
    unit: 'mg/Nm³',
    color: '#1565C0',
    tailwindColor: 'pollutant-nox',
  },
  SO2: {
    code: 'SO2',
    label: 'SO₂',
    longLabel: 'Dioxyde de soufre',
    unit: 'mg/Nm³',
    color: '#7B1FA2',
    tailwindColor: 'pollutant-so2',
  },
  PM: {
    code: 'PM',
    label: 'PM',
    longLabel: 'Particules (PM₁₀/PM₂.₅)',
    unit: 'µg/m³',
    color: '#E65100',
    tailwindColor: 'pollutant-pm',
  },
  COV: {
    code: 'COV',
    label: 'COV',
    longLabel: 'Composés organiques volatils',
    unit: 'mg/Nm³',
    color: '#00897B',
    tailwindColor: 'pollutant-cov',
  },
} as const

export type PollutantCode = keyof typeof POLLUTANTS
export const POLLUTANT_CODES = Object.keys(POLLUTANTS) as PollutantCode[]
export const POLLUTANT_LIST = Object.values(POLLUTANTS)
