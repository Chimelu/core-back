import 'reflect-metadata'
import cors from 'cors'
import express, { type Request, type Response } from 'express'
import helmet from 'helmet'
import { AppDataSource } from './config/data-source'
import { env } from './config/env'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { apiRouter } from './routes'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

  app.use(helmet())

  // Origins come from CORS_ORIGINS (comma-separated). Use "*" to allow any.
  const allowlist = env.corsOrigins
  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      // Non-browser clients send no Origin header — always allow those.
      if (!origin || allowlist.includes('*') || allowlist.includes(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }

  app.use(cors(corsOptions))
  app.options('*', cors(corsOptions))

  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: true }))

  app.use('/api/v1', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

/**
 * Serverless default export.
 *
 * Some platforms (e.g. Vercel) build this module directly and require a default
 * export that is a request handler. The app is created once per warm container
 * and the database connection is opened lazily and cached.
 */
const serverlessApp = createApp()
let dbReady: Promise<unknown> | null = null

export default async function handler(req: Request, res: Response) {
  if (!AppDataSource.isInitialized) {
    if (!dbReady) dbReady = AppDataSource.initialize()
    try {
      await dbReady
    } catch (error) {
      dbReady = null
      console.error('[api] database initialization failed', error)
      res.status(500).json({
        success: false,
        error: { code: 'DB_INIT_FAILED', message: 'Database connection failed' },
      })
      return
    }
  }

  ;(serverlessApp as unknown as (req: Request, res: Response) => void)(req, res)
}