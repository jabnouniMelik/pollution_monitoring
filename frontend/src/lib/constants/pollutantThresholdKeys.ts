import type { PollutantCode } from '@/lib/constants/pollutants'
import type { PollutantThresholdLimits } from '@/features/kpi/types/kpi.types'

/** Backend `ThresholdConfig.polluants` uses `NOx`; frontend codes use `NOX`. */
export const POLLUTANT_TO_BACKEND_KEY: Record<PollutantCode, string> = {
  CO2: 'CO2',
  NOX: 'NOx',
  SO2: 'SO2',
  PM: 'PM',
  COV: 'COV',
}

export function getPollutantThresholdRow(
  pollutants: Record<string, PollutantThresholdLimits> | undefined,
  code: PollutantCode,
): PollutantThresholdLimits | undefined {
  if (!pollutants) return undefined
  return pollutants[code] ?? pollutants[POLLUTANT_TO_BACKEND_KEY[code]]
}
