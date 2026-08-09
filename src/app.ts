import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { apiRouter } from './routes'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

  app.use(helmet())

  const corsOptions = {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
    ],
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