import { Link } from 'react-router-dom'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge/Badge'
import type { LstmForecast } from '../types/ia.types'
import { buildForecastPoints } from '../utils/forecastMapping'
import type { PollutantCode } from '@/lib/constants/pollutants'
import { POLLUTANTS } from '@/lib/constants/pollutants'

interface ForecastBannerProps {
  forecast: LstmForecast | null | undefined
  pollutant: PollutantCode
  loading?: boolean
}

export function ForecastBanner({ forecast, pollutant, loading }: ForecastBannerProps) {
  if (loading) {
    return (
      <p className="text-xs text-text-tertiary animate-pulse">
        Chargement des prévisions IA…
      </p>
    )
  }

  if (!forecast) {
    return (
      <div>
        <p className="text-xs text-text-secondary">
        Aucune prévision IA pour cette zone — lancez le simulateur puis attendez l&apos;agrégation horaire (H:05) ou{' '}
        <Link to="/ai" className="text-accent underline">
          ouvrez Prédictions IA
        </Link>
        .
        </p>
      </div>
    )
  }

  const points = buildForecastPoints(forecast, pollutant)
  const anchor = new Date(forecast.anchorPeriodStart).toLocaleString('fr-TN', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent/20 bg-accent/5 px-3 py-2 text-xs">
      <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
      <span className="text-text-secondary">
        Prévision LSTM 4h · ancrée {anchor}
      </span>
      {points.map((p) => (
        <Badge key={p.stepHours} variant={p.source === 'LSTM' ? 'success' : 'neutral'}>
          +{p.stepHours}h: {p.v.toFixed(1)} {POLLUTANTS[pollutant].unit}
          {p.source !== 'LSTM' ? ' (pers.)' : ''}
        </Badge>
      ))}
      <Link to="/ai" className="ml-auto text-accent hover:underline">
        Détail IA →
      </Link>
      </div>
    </div>
  )
}

interface AnomalyBannerProps {
  isAnomaly: boolean
  score?: number
  periodStart?: string
}

export function AnomalyBanner({ isAnomaly, score, periodStart }: AnomalyBannerProps) {
  if (!isAnomaly) return null

  const when = periodStart
    ? new Date(periodStart).toLocaleString('fr-TN', { dateStyle: 'short', timeStyle: 'short' })
    : 'dernier créneau'

  return (
    <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        Profil multivarié atypique (Isolation Forest) — {when}
        {score != null ? ` · score ${score.toFixed(3)}` : ''}
      </span>
      <Link to="/ai" className="ml-auto underline">
        Voir IA
      </Link>
    </div>
  )
}
