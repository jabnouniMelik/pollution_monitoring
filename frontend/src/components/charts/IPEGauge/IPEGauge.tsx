import { Doughnut } from 'react-chartjs-2'
import '../chartSetup'
import { formatNumber } from '@/lib/utils/formatters'

interface IPEGaugeProps {
  value: number
  target?: number
  label?: string
}

function colorForValue(value: number, target = 95): string {
  if (value >= target) return '#1B5E20'
  if (value >= target * 0.9) return '#E65100'
  return '#B71C1C'
}

export function IPEGauge({ value, target = 95, label = 'IPE' }: IPEGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const color = colorForValue(clamped, target)

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <Doughnut
        data={{
          labels: ['Score', 'Reste'],
          datasets: [
            {
              data: [clamped, 100 - clamped],
              backgroundColor: [color, '#E0E7EF'],
              borderWidth: 0,
              circumference: 270,
              rotation: 225,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-3xl font-semibold" style={{ color }}>
          {formatNumber(clamped, 1)}
          <span className="text-sm text-text-secondary">/100</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</div>
        <div className="text-[10px] text-text-secondary">cible ≥ {target}</div>
      </div>
    </div>
  )
}
