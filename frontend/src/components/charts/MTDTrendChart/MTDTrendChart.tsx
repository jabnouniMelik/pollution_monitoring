import { Bar } from 'react-chartjs-2'
import '../chartSetup'
import { lineChartOptions } from '@/lib/utils/chartHelpers'

interface MTDTrendChartProps {
  labels: string[]
  values: number[]
  target?: number
  unit?: string
  color?: string
  /** When true, y-axis always starts at 0 so zero values remain visible */
  beginAtZero?: boolean
}

/**
 * Month-to-date (MTD) bar chart for cumulative emissions.
 */
export function MTDTrendChart({
  labels,
  values,
  target,
  unit,
  color = '#1565C0',
  beginAtZero = true,
}: MTDTrendChartProps) {
  const dataMax = values.length ? Math.max(...values) : 0
  const dataMin = values.length ? Math.min(...values) : 0
  const targetVal = typeof target === 'number' ? target : null
  const yMax = Math.max(dataMax, targetVal ?? 0, 0.01) * 1.15
  const yMin = beginAtZero
    ? 0
    : Math.min(dataMin, targetVal ?? dataMin, 0) * 1.15
  const datasets: Array<Record<string, unknown>> = [
    {
      type: 'bar',
      label: 'Cumul',
      data: values,
      backgroundColor: color,
      borderRadius: 4,
      maxBarThickness: 28,
    },
  ]

  if (typeof target === 'number') {
    datasets.push({
      type: 'line',
      label: 'Cible',
      data: labels.map(() => target),
      borderColor: '#B71C1C',
      borderDash: [4, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    })
  }

  return (
    <Bar
      data={{ labels, datasets: datasets as never }}
      options={lineChartOptions({
        scales: {
          x: { grid: { display: false } },
          y: {
            title: unit ? { display: true, text: unit } : undefined,
            grid: { color: 'rgba(148, 163, 184, 0.15)' },
            beginAtZero,
            suggestedMax: yMax,
            suggestedMin: beginAtZero ? undefined : yMin,
          },
        },
      }) as never}
    />
  )
}
