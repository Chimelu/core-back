import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { apiRouter } from './routes'

export function createApp() {
  const app = express()

  // Required for correct req.ip behind Render/Railway/Fly style proxies.
  app.set('trust proxy', 1)

  app.use(helmet())
 app.use(cors())
  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: true }))

  app.use('/api/v1', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
