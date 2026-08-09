import 'reflect-metadata'
import type { Request, Response } from 'express'
import { createApp } from '../src/app'
import { AppDataSource } from '../src/config/data-source'

/**
 * Vercel serverless entry point.
 *
 * Vercel invokes the default export per request, so the app is built once per
 * warm container and the database connection is opened lazily and cached. All
 * routes are rewritten to this function via vercel.json, so Express still sees
 * the original `/api/v1/...` path.
 */
const app = createApp()

let dbReady: Promise<unknown> | null = null

function ensureDatabase() {
  if (AppDataSource.isInitialized) return Promise.resolve()
  if (!dbReady) dbReady = AppDataSource.initialize()
  return dbReady
}

export default async function handler(req: Request, res: Response) {
  try {
    await ensureDatabase()
  } catch (error) {
    // A failed init should not be cached, so the next request can retry.
    dbReady = null
    console.error('[api] database initialization failed', error)
    res.status(500).json({
      success: false,
      error: { code: 'DB_INIT_FAILED', message: 'Database connection failed' },
    })
    return
  }

  ;(app as unknown as (req: Request, res: Response) => void)(req, res)
}
