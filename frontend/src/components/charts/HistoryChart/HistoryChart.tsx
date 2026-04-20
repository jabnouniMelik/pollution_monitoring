import { Line } from 'react-chartjs-2'
import '../chartSetup'
import { hexToRgba, lineChartOptions } from '@/lib/utils/chartHelpers'

export interface HistorySeries {
  label: string
  color: string
  points: Array<{ t: string | number | Date; v: number }>
  threshold?: number
}

interface HistoryChartProps {
  series: HistorySeries[]
  unit?: string
}

export function HistoryChart({ series, unit }: HistoryChartProps) {
  const datasets = series.map((s) => ({
    label: s.label,
    data: s.points.map((p) => ({ x: p.t as unknown as number, y: p.v })),
    borderColor: s.color,
    backgroundColor: hexToRgba(s.color, 0.1),
    fill: false,
    tension: 0.3,
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 2,
  }))

  const annotations = series
    .filter((s) => typeof s.threshold === 'number')
    .map((s) => ({
      label: `Seuil ${s.label}`,
      data: s.points.map((p) => ({ x: p.t as unknown as number, y: s.threshold! })),
      borderColor: s.color,
      borderDash: [4, 4],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
    }))

  return (
    <Line
      data={{ datasets: [...datasets, ...annotations] }}
      options={lineChartOptions({
        scales: {
          x: {
            type: 'time',
            time: { tooltipFormat: 'dd MMM yyyy HH:mm', displayFormats: { hour: 'HH:mm', day: 'dd/MM' } },
            grid: { display: false },
          },
          y: {
            title: unit ? { display: true, text: unit } : undefined,
            grid: { color: 'rgba(148, 163, 184, 0.15)' },
          },
        },
      })}
    />
  )
}
