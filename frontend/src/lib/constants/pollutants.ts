/**
 * Canonical pollutant definitions.
 * Units and colors stay consistent across the dashboard.
 */
export const POLLUTANTS = {
  CO2: {
    code: 'CO2',
    label: 'CO\u2082',
    longLabel: 'Dioxyde de carbone',
    unit: 'ppm',
    color: '#2E7D32',
    tailwindColor: 'pollutant-co2',
  },
  NOX: {
    code: 'NOX',
    label: 'NO\u2093',
    longLabel: 'Oxydes d\u2019azote',
    unit: 'mg/Nm\u00B3',
    color: '#1565C0',
    tailwindColor: 'pollutant-nox',
  },
  SO2: {
    code: 'SO2',
    label: 'SO\u2082',
    longLabel: 'Dioxyde de soufre',
    unit: 'mg/Nm\u00B3',
    color: '#7B1FA2',
    tailwindColor: 'pollutant-so2',
  },
  PM: {
    code: 'PM',
    label: 'PM\u2082.\u2085',
    longLabel: 'Particules fines (PM\u2082.\u2085)',
    unit: '\u00B5g/m\u00B3',
    color: '#E65100',
    tailwindColor: 'pollutant-pm',
  },
  COV: {
    code: 'COV',
    label: 'COV',
    longLabel: 'Compos\u00E9s organiques volatils',
    unit: 'mg/Nm\u00B3',
    color: '#00897B',
    tailwindColor: 'pollutant-cov',
  },
} as const

export type PollutantCode = keyof typeof POLLUTANTS
export const POLLUTANT_CODES = Object.keys(POLLUTANTS) as PollutantCode[]
export const POLLUTANT_LIST = Object.values(POLLUTANTS)
