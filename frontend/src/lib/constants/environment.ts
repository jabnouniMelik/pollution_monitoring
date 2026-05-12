/**
 * Environmental parameters (not regulated pollutants) measured alongside
 * emissions: temperature + humidity. Kept separate from POLLUTANTS so the
 * Décret compliance logic ignores them.
 */
export const ENVIRONMENT_PARAMS = {
  TEMPERATURE: {
    code: 'TEMPERATURE',
    label: 'Temp.',
    longLabel: 'Température',
    unit: '°C',
    color: '#E65100',
    icon: 'thermometer',
    /** Typical comfort / safe operating range (min, max). */
    normalRange: [15, 35] as [number, number],
  },
  HUMIDITY: {
    code: 'HUMIDITY',
    label: 'Humidité',
    longLabel: 'Humidité relative',
    unit: '%',
    color: '#1565C0',
    icon: 'droplets',
    normalRange: [30, 70] as [number, number],
  },
} as const

export type EnvParamCode = keyof typeof ENVIRONMENT_PARAMS
export const ENV_PARAM_CODES = Object.keys(ENVIRONMENT_PARAMS) as EnvParamCode[]
