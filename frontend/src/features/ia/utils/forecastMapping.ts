import type { PollutantCode } from '@/lib/constants/pollutants'
import type { ForecastStep, LstmForecast } from '../types/ia.types'

/** Noms LSTM / IF → code UI Historique */
export const LSTM_NAMES_BY_POLLUTANT: Record<PollutantCode, string[]> = {
  CO2: ['CO2'],
  NOX: ['NOX'],
  SO2: ['SOX'],
  PM25: ['PM25'],
  PM10: ['PM10'],
  COV: ['COV'],
}

const FORECAST_COLOR = '#7B1FA2'

export function findPollutantInStep(
  step: ForecastStep,
  code: PollutantCode,
): ForecastStep['pollutants'][0] | undefined {
  const names = LSTM_NAMES_BY_POLLUTANT[code]
  return step.pollutants.find((p) => names.includes(p.name))
}

export function buildForecastPoints(
  forecast: LstmForecast | null | undefined,
  code: PollutantCode,
): Array<{ t: string; v: number; source: string; stepHours: number }> {
  if (!forecast?.steps?.length) return []

  return forecast.steps
    .map((step) => {
      const p = findPollutantInStep(step, code)
      if (!p) return null
      return {
        t: step.targetTime,
        v: p.valuePhysical,
        source: p.predictionSource,
        stepHours: step.stepHours,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
}

export function forecastSeriesForChart(
  forecast: LstmForecast | null | undefined,
  code: PollutantCode,
  options?: { bridgeFrom?: { t: string | number | Date; v: number } },
) {
  const points = buildForecastPoints(forecast, code).map((p) => ({
    t: p.t,
    v: p.v,
  }))

  if (options?.bridgeFrom && points.length > 0) {
    points.unshift({
      t: options.bridgeFrom.t,
      v: options.bridgeFrom.v,
    })
  }

  const source =
    buildForecastPoints(forecast, code)[0]?.source ?? 'PERSISTENCE'

  return {
    label: `Prévision 4h (${source})`,
    color: FORECAST_COLOR,
    points,
    dashed: true as const,
    isForecast: true as const,
    source,
  }
}

export function nextStepExceeding(
  forecast: LstmForecast | null | undefined,
  code: PollutantCode,
): { stepHours: number; severity: string } | null {
  if (!forecast) return null
  for (const step of forecast.steps) {
    const p = findPollutantInStep(step, code)
    if (p?.exceedsRegulatory && p.severity) {
      return { stepHours: step.stepHours, severity: p.severity }
    }
  }
  return null
}

/**
 * True si la fenêtre de prévision [ancre … +4h] chevauche la période affichée.
 * Évite d'étirer l'axe X quand l'ancrage est historique (fallback backend).
 */
export function isForecastOverlappingWindow(
  forecast: LstmForecast | null | undefined,
  from: string | Date,
  to: string | Date,
): boolean {
  if (!forecast?.anchorPeriodStart || !forecast.steps?.length) return false

  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime()
  const anchorMs = new Date(forecast.anchorPeriodStart).getTime()
  const lastStep = forecast.steps[forecast.steps.length - 1]
  const endMs = new Date(lastStep.targetTime).getTime()

  if (![fromMs, toMs, anchorMs, endMs].every(Number.isFinite)) return false

  return endMs >= fromMs && anchorMs <= toMs
}
