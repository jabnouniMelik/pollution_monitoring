import type { ChartOptions } from 'chart.js'

export const DEFAULT_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export function lineChartOptions(overrides: Partial<ChartOptions<'line'>> = {}): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          font: { family: DEFAULT_FONT_FAMILY, size: 11 },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(30, 58, 95, 0.95)',
        titleFont: { family: DEFAULT_FONT_FAMILY, size: 12, weight: 600 },
        bodyFont: { family: DEFAULT_FONT_FAMILY, size: 12 },
        padding: 10,
        boxPadding: 4,
        cornerRadius: 6,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: DEFAULT_FONT_FAMILY, size: 10 }, color: '#64748B' },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        ticks: { font: { family: DEFAULT_FONT_FAMILY, size: 10 }, color: '#64748B' },
      },
    },
    ...overrides,
  }
}

export function miniChartOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: {
      point: { radius: 0 },
      line: { tension: 0.35, borderWidth: 2 },
    },
  }
}

export function hexToRgba(hex: string, alpha = 1): string {
  const normalized = hex.replace('#', '')
  const bigint = parseInt(
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized,
    16,
  )
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
