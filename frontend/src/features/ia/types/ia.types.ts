export type PredictionSource = 'LSTM' | 'PERSISTENCE' | 'blend'

export interface ForecastPollutant {
  name: string
  valuePhysical: number
  valueNormalized: number
  predictionSource: PredictionSource
  skillAtTrain: number
  unit: string | null
  regulatoryLimit: number | null
  exceedsRegulatory: boolean
  severity: 'Warning' | 'High' | 'Critical' | null
}

export interface ForecastStep {
  stepHours: number
  stepLabel: string
  targetTime: string
  pollutants: ForecastPollutant[]
}

export interface LstmForecast {
  _id: string
  zoneId: string
  siteId: string
  runAt: string
  anchorPeriodStart: string
  goDeploy: boolean
  alertSource: string
  horizonHours: number
  lookbackHours: number
  steps: ForecastStep[]
}

export interface AnomalyDetection {
  _id: string
  zoneId: string
  siteId: string
  periodStart: string
  runAt: string
  isAnomaly: boolean
  anomalyScore: number
  prediction: number
  scoreThreshold: number
  severity: 'Warning' | 'High' | 'Critical' | null
  featureCols: string[]
  featureValues: number[]
  alertSource: string
}

export interface IAHealthPayload {
  status: string
  enabled?: boolean
  lstm?: {
    loaded: boolean
    go_deploy?: boolean
    horizon_hours?: number
    lookback_hours?: number
  }
  isolation_forest?: {
    loaded: boolean
    feature_cols?: string[]
    score_threshold?: number
  }
  skill?: {
    acceptance?: { go_deploy?: boolean; recommendation?: string }
    global_skill?: number
    per_pollutant_skill?: Record<string, number>
  } | null
}

export interface IADatasetSnapshot {
  _id: string
  status: 'ready' | 'invalid'
  periodStart: string
  periodEnd: string
  rowCount: number
  missingRatio: number
  featureColumns: string[]
  paths: {
    datasetCsv: string
    manifestJson: string
  }
  quality: {
    minRows: number
    maxMissingRatio: number
    validForTraining: boolean
    reasons: string[]
  }
  createdAt: string
}

export interface IARetrainJob {
  _id: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'rolled_back'
  progressPct: number
  stage: string
  datasetId: IADatasetSnapshot | string
  logsTail: string[]
  errorMessage: string | null
  metrics?: {
    previousGlobalSkill?: number | null
    newGlobalSkill?: number | null
    skillDelta?: number | null
    deploySuggested?: boolean
    rollbackApplied?: boolean
  }
  process?: {
    pid?: number | null
    startedAt?: string | null
    finishedAt?: string | null
    exitCode?: number | null
  }
  createdAt: string
}
