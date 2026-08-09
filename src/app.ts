import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
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