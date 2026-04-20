import { Bar } from 'react-chartjs-2'
import '../chartSetup'
import { lineChartOptions } from '@/lib/utils/chartHelpers'

interface MTDTrendChartProps {
  labels: string[]
  values: number[]
  target?: number
  unit?: string
  color?: string
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
}: MTDTrendChartProps) {
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
          },
        },
      }) as never}
    />
  )
}
