import { Line } from 'react-chartjs-2'
import '../chartSetup'
import { hexToRgba, lineChartOptions } from '@/lib/utils/chartHelpers'
import { ENVIRONMENT_PARAMS } from '@/lib/constants/environment'

export interface EnvPoint {
  t: string | number | Date
  temperature?: number
  humidity?: number
}

interface EnvironmentChartProps {
  points: EnvPoint[]
}

export function EnvironmentChart({ points }: EnvironmentChartProps) {
  const temp = ENVIRONMENT_PARAMS.TEMPERATURE
  const hum = ENVIRONMENT_PARAMS.HUMIDITY

  const datasets = [
    {
      label: `${temp.label} (${temp.unit})`,
      data: points.map((p) => ({ x: p.t as unknown as number, y: p.temperature ?? null })),
      borderColor: temp.color,
      backgroundColor: hexToRgba(temp.color, 0.1),
      yAxisID: 'yTemp',
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 2,
      fill: false,
      spanGaps: true,
    },
    {
      label: `${hum.label} (${hum.unit})`,
      data: points.map((p) => ({ x: p.t as unknown as number, y: p.humidity ?? null })),
      borderColor: hum.color,
      backgroundColor: hexToRgba(hum.color, 0.1),
      yAxisID: 'yHum',
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 2,
      fill: false,
      spanGaps: true,
    },
  ]

  return (
    <Line
      data={{ datasets }}
      options={lineChartOptions({
        scales: {
          x: {
            type: 'time',
            time: {
              tooltipFormat: 'dd MMM yyyy HH:mm',
              displayFormats: { hour: 'HH:mm', day: 'dd/MM' },
            },
            grid: { display: false },
          },
          yTemp: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: `${temp.label} (${temp.unit})`, color: temp.color },
            ticks: { color: temp.color },
            grid: { color: 'rgba(148, 163, 184, 0.15)' },
          },
          yHum: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 100,
            title: { display: true, text: `${hum.label} (${hum.unit})`, color: hum.color },
            ticks: { color: hum.color },
            grid: { display: false },
          },
        },
        interaction: { mode: 'index', intersect: false },
      })}
    />
  )
}
