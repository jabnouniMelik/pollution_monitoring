import { z } from 'zod'

export const airflowSchema = z.object({
  airflow: z
    .number({ invalid_type_error: 'Valeur numérique requise' })
    .positive('Le débit doit être positif')
    .max(10_000, 'Valeur anormalement élevée'),
})

export const weightsSchema = z
  .record(z.string(), z.number().min(0).max(1))
  .refine(
    (weights) => {
      const sum = Object.values(weights).reduce((s, w) => s + w, 0)
      return Math.abs(sum - 1) < 0.01
    },
    { message: 'La somme des poids doit être égale à 1' },
  )

export const targetsSchema = z.object({
  TD: z.number().min(0).max(100).optional(),
  IPE: z.number().min(0).max(100).optional(),
  RCO2: z.number().min(-100).max(100).optional(),
  EMJ: z.number().min(0).optional(),
})

export const thresholdSchema = z.object({
  pollutant: z.string().min(1),
  warning: z.number().min(0),
  critical: z.number().min(0),
  unit: z.string().min(1),
}).refine((t) => t.critical > t.warning, {
  message: 'Le seuil critique doit être supérieur au seuil d’alerte',
  path: ['critical'],
})
