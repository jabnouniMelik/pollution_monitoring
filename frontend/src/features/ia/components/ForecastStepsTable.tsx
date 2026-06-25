import { Badge } from '@/components/ui/Badge/Badge'
import { POLLUTANTS, type PollutantCode } from '@/lib/constants/pollutants'
import type { LstmForecast } from '../types/ia.types'
import { findPollutantInStep } from '../utils/forecastMapping'

interface ForecastStepsTableProps {
  forecast: LstmForecast
  pollutant: PollutantCode
}

export function ForecastStepsTable({ forecast, pollutant }: ForecastStepsTableProps) {
  const unit = POLLUTANTS[pollutant].unit

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-tertiary">
            <th className="py-2 pr-4">Horizon</th>
            <th className="py-2 pr-4">Valeur</th>
            <th className="py-2 pr-4">Source</th>
            <th className="py-2 pr-4">Seuil</th>
            <th className="py-2">Risque</th>
          </tr>
        </thead>
        <tbody>
          {forecast.steps.map((step) => {
            const p = findPollutantInStep(step, pollutant)
            if (!p) return null
            const target = new Date(step.targetTime).toLocaleString('fr-TN', {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
            return (
              <tr key={step.stepHours} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">
                  {step.stepLabel}
                  <span className="block text-[10px] font-normal text-text-tertiary">{target}</span>
                </td>
                <td className="py-2 pr-4">
                  {p.valuePhysical.toFixed(2)} {unit}
                </td>
                <td className="py-2 pr-4">
                  <Badge variant={p.predictionSource === 'LSTM' ? 'success' : 'neutral'}>
                    {p.predictionSource}
                  </Badge>
                </td>
                <td className="py-2 pr-4 text-text-secondary">
                  {p.regulatoryLimit != null ? p.regulatoryLimit : '—'}
                </td>
                <td className="py-2">
                  {p.exceedsRegulatory ? (
                    <Badge variant="danger">{p.severity ?? 'Alerte'}</Badge>
                  ) : (
                    <span className="text-text-tertiary">OK</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
