import type { KPIHistoryPoint } from '../types/kpi.types'

/** Map backend pollutant names to frontend PollutantCode keys. */
export function normalizePollutantCode(name: string): string {
  const key = String(name ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (key === 'PM' || key === 'PM2') return 'PM25'
  return key
}

/** Resolve EMJ/TD value from summary map regardless of key casing. */
export function lookupPollutantMetric(
  map: Record<string, number> | undefined,
  code: string,
): number {
  if (!map) return 0
  const wanted = normalizePollutantCode(code)
  for (const [key, value] of Object.entries(map)) {
    if (normalizePollutantCode(key) === wanted) {
      return Number.isFinite(value) ? value : 0
    }
  }
  return 0
}

/** Build daily values for the current calendar month from history points. */
export function buildMtdDailyValues(
  points: KPIHistoryPoint[],
  daysInMonth: number,
  year: number,
  month: number,
): number[] {
  const daily = new Array<number>(daysInMonth).fill(0)
  const counts = new Array<number>(daysInMonth).fill(0)

  for (const point of points) {
    const d = new Date(point.timestamp)
    if (Number.isNaN(d.getTime())) continue
    if (d.getFullYear() !== year || d.getMonth() !== month) continue
    const idx = d.getDate() - 1
    if (idx < 0 || idx >= daysInMonth) continue
    daily[idx] += Math.max(0, Number(point.value) || 0)
    counts[idx] += 1
  }

  return daily.map((v, i) =>
    counts[i] > 0 ? Number((v / counts[i]).toFixed(2)) : 0,
  )
}

/** Build cumulative month-to-date series from daily values. */
export function buildMtdCumulativeValues(dailyValues: number[]): number[] {
  let cumulative = 0
  return dailyValues.map((v) => {
    cumulative += v
    return Number(cumulative.toFixed(2))
  })
}

/** Day-of-month count to include in MTD charts (excludes future days). */
export function mtdActiveDayCount(
  year: number,
  month: number,
  referenceDate: Date = new Date(),
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  if (referenceDate.getFullYear() !== year || referenceDate.getMonth() !== month) {
    return daysInMonth
  }
  return Math.min(referenceDate.getDate(), daysInMonth)
}

/** Labels 01..N for the active portion of the current month. */
export function buildMtdLabels(
  daysInMonth: number,
  activeDays: number,
): string[] {
  const count = Math.max(0, Math.min(activeDays, daysInMonth))
  return Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0'))
}

/** Truncate a full-month daily series to the active day count. */
export function truncateMtdSeries(series: number[], activeDays: number): number[] {
  if (activeDays <= 0) return []
  return series.slice(0, activeDays)
}

/** Average multiple daily MTD series (e.g. TD across pollutants). */
export function averageMtdSeries(series: number[][]): number[] {
  if (series.length === 0) return []
  const len = series[0]?.length ?? 0
  return Array.from({ length: len }, (_, dayIdx) => {
    const values = series
      .map((s) => s[dayIdx])
      .filter((v) => Number.isFinite(v))
    if (values.length === 0) return 0
    return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
  })
}
