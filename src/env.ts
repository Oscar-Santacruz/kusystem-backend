import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL requerido'),
  ALLOW_ORIGIN: z.string().optional(),
  PORT: z
    .string()
    .transform((v) => (v ? Number(v) : 4000))
    .pipe(z.number().int().positive())
    .optional(),
})

export type AppEnv = z.infer<typeof envSchema>

export const env: AppEnv = envSchema.parse(process.env)
