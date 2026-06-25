import { Line } from 'react-chartjs-2'
import type { ChartDataset } from 'chart.js'
import '../chartSetup'
import { hexToRgba, lineChartOptions } from '@/lib/utils/chartHelpers'

export interface HistorySeries {
  label: string
  color: string
  points: Array<{ t: string | number | Date; v: number }>
  threshold?: number
  /** Série prévisionnelle (trait pointillé) */
  dashed?: boolean
  borderWidth?: number
}

export interface HistoryEnvPoint {
  t: string | number | Date
  temperature?: number
  humidity?: number
}

interface HistoryChartProps {
  series: HistorySeries[]
  unit?: string
  envPoints?: HistoryEnvPoint[]
  showTemperature?: boolean
  showHumidity?: boolean
}

const TEMP_COLOR = '#EF6C00'
const HUM_COLOR = '#0288D1'

type LineDataset = ChartDataset<'line', Array<{ x: number; y: number }>>

/**
 * Compute smart Y-axis bounds so that:
 * 1. Actual data values are clearly visible (not squashed at the bottom)
 * 2. Threshold lines are visible but don't dominate the scale
 *
 * Strategy:
 * - dataMax = max of all actual measurement values
 * - thresholdMax = max of all threshold values
 * - If thresholdMax >> dataMax (e.g. 10× larger), cap the Y-axis at
 *   max(dataMax * 1.4, thresholdMax * 0.3) so the threshold is still
 *   visible as a line near the top without pushing data to the floor.
 * - Otherwise use max(dataMax, thresholdMax) * 1.15 as normal.
 */
function computeYBounds(series: HistorySeries[]): { min: number; max: number } {
  let dataMax = 0
  let thresholdMax = 0

  for (const s of series) {
    if (s.dashed) continue
    for (const p of s.points) {
      if (Number.isFinite(p.v) && p.v > dataMax) dataMax = p.v
    }
    if (typeof s.threshold === 'number' && s.threshold > thresholdMax) {
      thresholdMax = s.threshold
    }
  }

  // Prévision : inclure seulement si proche des mesures (évite d'écraser l'échelle)
  for (const s of series) {
    if (!s.dashed) continue
    for (const p of s.points) {
      if (!Number.isFinite(p.v)) continue
      if (dataMax === 0 || p.v <= dataMax * 2.5) {
        dataMax = Math.max(dataMax, p.v)
      }
    }
  }

  if (dataMax === 0 && thresholdMax === 0) return { min: 0, max: 100 }

  // If no threshold, just pad data by 20%
  if (thresholdMax === 0) return { min: 0, max: dataMax * 1.2 }

  // If no data yet, show up to threshold + 20%
  if (dataMax === 0) return { min: 0, max: thresholdMax * 1.2 }

  const ratio = thresholdMax / dataMax

  if (ratio > 4) {
    // Threshold is much higher than data — cap Y so data is readable
    // Show at least 40% above data, but also show threshold if it's within 3× data
    const cappedMax = Math.max(dataMax * 1.4, thresholdMax * 0.25)
    return { min: 0, max: Math.max(cappedMax, dataMax * 1.4) }
  }

  // Normal case — threshold and data are in similar range
  return { min: 0, max: Math.max(dataMax, thresholdMax) * 1.15 }
}

/** Bornes X à partir des mesures ; extension optionnelle pour la prévision alignée. */
function computeXBounds(series: HistorySeries[]): { min?: number; max?: number } {
  const hist = series.filter((s) => !s.dashed)
  const forecast = series.filter((s) => s.dashed)

  let min = Infinity
  let max = -Infinity

  for (const s of hist) {
    for (const p of s.points) {
      const t = new Date(p.t).getTime()
      if (Number.isFinite(t)) {
        min = Math.min(min, t)
        max = Math.max(max, t)
      }
    }
  }

  if (!Number.isFinite(min)) return {}

  for (const s of forecast) {
    for (const p of s.points) {
      const t = new Date(p.t).getTime()
      if (Number.isFinite(t)) max = Math.max(max, t)
    }
  }

  const span = Math.max(max - min, 60_000)
  const pad = span * 0.03
  return { min: min - pad, max: max + pad }
}

export function HistoryChart({
  series,
  unit,
  envPoints,
  showTemperature = true,
  showHumidity = true,
}: HistoryChartProps) {
  const toTime = (value: string | number | Date): number => {
    const date = value instanceof Date ? value : new Date(value)
    return date.getTime()
  }

  const yBounds = computeYBounds(series)
  const xBounds = computeXBounds(series)

  const datasets: LineDataset[] = series.map((s) => ({
    label: s.label,
    data: s.points.map((p) => ({ x: toTime(p.t), y: p.v })),
    borderColor: s.color,
    backgroundColor: hexToRgba(s.color, s.dashed ? 0 : 0.1),
    fill: false,
    tension: s.dashed ? 0.2 : 0.3,
    cubicInterpolationMode: 'monotone',
    pointRadius: s.dashed ? 3 : 0,
    pointHoverRadius: s.dashed ? 5 : 4,
    borderWidth: s.borderWidth ?? (s.dashed ? 2.5 : 2),
    borderDash: s.dashed ? [8, 5] : undefined,
    yAxisID: 'y',
  }))

  const annotations: LineDataset[] = series
    .filter((s) => typeof s.threshold === 'number' && !s.dashed)
    .map((s) => ({
      label: `Seuil ${s.label}`,
      data: s.points.map((p) => ({ x: toTime(p.t), y: s.threshold! })),
      borderColor: s.color,
      borderDash: [4, 4],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      yAxisID: 'y',
    }))

  const tempData =
    envPoints
      ?.filter((p) => Number.isFinite(p.temperature))
      .map((p) => ({ x: toTime(p.t), y: p.temperature as number })) ?? []
  const humData =
    envPoints
      ?.filter((p) => Number.isFinite(p.humidity))
      .map((p) => ({ x: toTime(p.t), y: p.humidity as number })) ?? []

  const hasTemp = showTemperature && tempData.length > 0
  const hasHum = showHumidity && humData.length > 0

  const envDatasets: LineDataset[] = []

  if (hasTemp) {
    envDatasets.push({
      label: 'Température (°C)',
      data: tempData,
      borderColor: TEMP_COLOR,
      backgroundColor: hexToRgba(TEMP_COLOR, 0.08),
      borderDash: [6, 4],
      fill: false,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 3,
      borderWidth: 1.75,
      yAxisID: 'yTemp',
    })
  }

  if (hasHum) {
    envDatasets.push({
      label: 'Humidité (%)',
      data: humData,
      borderColor: HUM_COLOR,
      backgroundColor: hexToRgba(HUM_COLOR, 0.08),
      borderDash: [2, 3],
      fill: false,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 3,
      borderWidth: 1.75,
      yAxisID: 'yHum',
    })
  }

  return (
    <Line
      data={{ datasets: [...datasets, ...annotations, ...envDatasets] }}
      options={lineChartOptions({
        scales: {
          x: {
            type: 'time',
            min: xBounds.min,
            max: xBounds.max,
            time: {
              tooltipFormat: 'dd MMM yyyy HH:mm',
              displayFormats: { hour: 'HH:mm', day: 'dd/MM' },
            },
            grid: { display: false },
          },
          y: {
            position: 'left',
            min: yBounds.min,
            max: yBounds.max,
            title: unit ? { display: true, text: unit } : undefined,
            grid: { color: 'rgba(148, 163, 184, 0.15)' },
            ticks: {
              // Show at most 6 ticks for readability
              maxTicksLimit: 6,
              callback: (value: number | string) => {
                const v = Number(value)
                // Use compact notation for large numbers
                if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
                return v % 1 === 0 ? v : v.toFixed(1)
              },
            },
          },
          ...(hasTemp
            ? {
                yTemp: {
                  position: 'right',
                  title: { display: true, text: '°C', color: TEMP_COLOR },
                  grid: { display: false },
                  ticks: { color: TEMP_COLOR },
                },
              }
            : {}),
          ...(hasHum
            ? {
                yHum: {
                  position: 'right',
                  title: { display: true, text: '%', color: HUM_COLOR },
                  grid: { display: false },
                  ticks: { color: HUM_COLOR },
                  min: 0,
                  max: 100,
                  offset: hasTemp,
                },
              }
            : {}),
        },
      })}
    />
  )
}
