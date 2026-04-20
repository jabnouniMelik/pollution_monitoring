import { Line } from 'react-chartjs-2'
import '../chartSetup'
import { hexToRgba, miniChartOptions } from '@/lib/utils/chartHelpers'

interface MiniTrendChartProps {
  values: number[]
  color?: string
  label?: string
  height?: number
}

export function MiniTrendChart({
  values,
  color = '#1565C0',
  label = 'trend',
  height = 40,
}: MiniTrendChartProps) {
  return (
    <div style={{ height }} aria-hidden="true">
      <Line
        data={{
          labels: values.map((_, i) => i),
          datasets: [
            {
              label,
              data: values,
              borderColor: color,
              backgroundColor: hexToRgba(color, 0.15),
              fill: true,
              tension: 0.35,
              pointRadius: 0,
              borderWidth: 2,
            },
          ],
        }}
        options={miniChartOptions()}
      />
    </div>
  )
}
