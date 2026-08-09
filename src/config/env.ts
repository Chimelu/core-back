import 'dotenv/config'
import { z } from 'zod'

const boolish = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  /** Single connection string (Neon, Supabase, Render…). Takes precedence over DB_* below. */
  DATABASE_URL: z.string().min(1).optional(),
  DB_HOST: z.string().min(1).optional(),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USERNAME: z.string().min(1).optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().min(1).optional(),
  DB_SSL: boolish,
  DB_SYNCHRONIZE: boolish,
  DB_LOGGING: boolish,

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  CARD_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'CARD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),
  INTERNATIONAL_TRANSFER_FEE_PERCENT: z.coerce.number().min(0).max(10).default(1),
})
.superRefine((value, ctx) => {
  if (value.DATABASE_URL) return

  for (const key of ['DB_HOST', 'DB_USERNAME', 'DB_NAME'] as const) {
    if (!value[key]) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `Set ${key} or provide DATABASE_URL instead`,
      })
    }
  }
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment configuration:\n${issues}`)
}

// Hosted Postgres (Neon, Supabase…) terminates TLS with certificates the default
// CA bundle does not cover, so verification is relaxed when SSL is requested.
const urlRequiresSsl =
  !!parsed.data.DATABASE_URL && /sslmode=(require|verify-full|verify-ca)/.test(parsed.data.DATABASE_URL)

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  useSsl: parsed.data.DB_SSL || urlRequiresSsl,
  databaseLabel: parsed.data.DATABASE_URL
    ? new URL(parsed.data.DATABASE_URL).host
    : `${parsed.data.DB_NAME}@${parsed.data.DB_HOST}:${parsed.data.DB_PORT}`,
}
