import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email requis' })
    .min(1, 'Email requis')
    .email('Email invalide'),
  password: z
    .string({ required_error: 'Mot de passe requis' })
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  rememberMe: z.boolean().optional(),
})

export type LoginFormValues = z.infer<typeof loginSchema>
