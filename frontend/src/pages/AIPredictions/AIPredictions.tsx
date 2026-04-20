import { Bot, Sparkles, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card/Card'
import { Badge } from '@/components/ui/Badge/Badge'
import { Button } from '@/components/ui/Button/Button'
import { ChartWrapper } from '@/components/charts/ChartWrapper/ChartWrapper'
import { HistoryChart } from '@/components/charts/HistoryChart/HistoryChart'
import { PermissionGate } from '@/components/common/PermissionGate/PermissionGate'
import { POLLUTANTS } from '@/lib/constants/pollutants'

export default function AIPredictions() {
  const now = Date.now()
  const hist = Array.from({ length: 24 }, (_, i) => ({
    t: now - (24 - i) * 3_600_000,
    v: 200 + Math.sin(i / 3) * 40 + Math.random() * 20,
  }))
  const forecast = Array.from({ length: 12 }, (_, i) => ({
    t: now + i * 3_600_000,
    v: 220 + Math.sin((24 + i) / 3) * 40 + (i > 6 ? 30 : 0),
  }))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Prédictions IA"
        subtitle="Prévisions d’émissions basées sur le modèle LSTM entraîné sur l’historique du site"
        actions={
          <PermissionGate permission="RETRAIN_MODEL">
            <Button variant="secondary" size="sm" leftIcon={<Sparkles className="h-3.5 w-3.5" />}>
              Ré-entraîner le modèle
            </Button>
          </PermissionGate>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardHeader title="Modèle actif" subtitle="LSTM — fenêtre 48h" action={<Badge variant="success">v2.4</Badge>} />
          <div className="mt-2 flex items-center gap-2">
            <Bot className="h-4 w-4 text-accent" />
            <span className="text-sm text-text-secondary">MAE 4.8 · RMSE 6.2 · R² 0.92</span>
          </div>
        </Card>
        <Card>
          <CardHeader title="Prochaine alerte prédite" subtitle="Probabilité dépassement NOₓ" />
          <div className="mt-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-warning" />
            <span className="text-lg font-semibold text-warning">61 %</span>
            <span className="text-xs text-text-secondary">dans 7h</span>
          </div>
        </Card>
        <Card>
          <CardHeader title="Fenêtre de prévision" subtitle="Horizon & intervalle" />
          <div className="mt-2 text-sm text-text-secondary">12h · pas de 1h · IC 95%</div>
        </Card>
      </div>

      <ChartWrapper
        title="Prévision NOₓ — 12h"
        subtitle="Historique récent + projection du modèle"
        height={360}
      >
        <HistoryChart
          series={[
            { label: 'Historique', color: POLLUTANTS.NOX.color, points: hist, threshold: 500 },
            { label: 'Prévision', color: '#7B1FA2', points: forecast },
          ]}
          unit="mg/Nm³"
        />
      </ChartWrapper>
    </div>
  )
}
