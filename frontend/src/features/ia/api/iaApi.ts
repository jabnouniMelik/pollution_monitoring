import { api, unwrap } from '@/lib/api/axios'

import { endpoints } from '@/lib/api/endpoints'

import type {
  AnomalyDetection,
  IADatasetSnapshot,
  IAHealthPayload,
  IARetrainJob,
  LstmForecast,
} from '../types/ia.types'



export const iaApi = {

  async health(): Promise<IAHealthPayload> {

    const res = await api.get<ApiSuccess<{ health: IAHealthPayload; skill: IAHealthPayload['skill'] }>>(

      endpoints.ia.health,

    )

    const body = unwrap(res.data)

    return { ...body.health, skill: body.skill ?? null }

  },



  async latestForecast(zoneId: string): Promise<LstmForecast | null> {

    try {

      const res = await api.get<ApiSuccess<{ forecast: LstmForecast }>>(

        endpoints.ia.forecastLatest(zoneId),

      )

      return unwrap(res.data).forecast

    } catch (err: unknown) {

      const status = (err as { status?: number })?.status

      if (status === 404) return null

      throw err

    }

  },



  async anomalyHistory(zoneId: string, limit = 20): Promise<AnomalyDetection[]> {

    const res = await api.get<ApiSuccess<{ history: AnomalyDetection[] }>>(

      endpoints.ia.anomalyHistory(zoneId),

      { params: { limit } },

    )

    return unwrap(res.data).history ?? []

  },



  async runForecast(zoneId: string): Promise<LstmForecast> {

    const res = await api.post<ApiSuccess<{ forecast: LstmForecast }>>(

      endpoints.ia.runForecast(zoneId),

      {},

      { timeout: 180_000 },

    )

    return unwrap(res.data).forecast

  },



  async runDetection(zoneId: string): Promise<AnomalyDetection> {

    const res = await api.post<ApiSuccess<{ detection: AnomalyDetection }>>(

      endpoints.ia.runDetect(zoneId),

      {},

      { timeout: 120_000 },

    )

    return unwrap(res.data).detection

  },

  async prepareRetrainDataset(payload: {
    periodStart: string
    periodEnd: string
    siteId?: string | null
    zoneId?: string | null
  }): Promise<IADatasetSnapshot> {
    const res = await api.post<ApiSuccess<{ dataset: IADatasetSnapshot }>>(
      endpoints.ia.retrainPrepareDataset,
      payload,
      { timeout: 120_000 },
    )
    return unwrap(res.data).dataset
  },

  async latestRetrainDataset(scope?: {
    siteId?: string | null
    zoneId?: string | null
  }): Promise<IADatasetSnapshot | null> {
    const res = await api.get<ApiSuccess<{ dataset: IADatasetSnapshot | null }>>(
      endpoints.ia.retrainLatestDataset,
      { params: scope },
    )
    return unwrap(res.data).dataset ?? null
  },

  async startRetrain(datasetId?: string): Promise<IARetrainJob> {
    const res = await api.post<ApiSuccess<{ job: IARetrainJob }>>(
      endpoints.ia.retrainStart,
      datasetId ? { datasetId } : {},
      { timeout: 30_000 },
    )
    return unwrap(res.data).job
  },

  async latestRetrainJob(): Promise<IARetrainJob | null> {
    const res = await api.get<ApiSuccess<{ job: IARetrainJob | null }>>(
      endpoints.ia.retrainLatestJob,
    )
    return unwrap(res.data).job ?? null
  },

  async retrainJobById(jobId: string): Promise<IARetrainJob> {
    const res = await api.get<ApiSuccess<{ job: IARetrainJob }>>(
      endpoints.ia.retrainJobById(jobId),
    )
    return unwrap(res.data).job
  },

}

