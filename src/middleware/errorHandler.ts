import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env'
import { AppError } from '../utils/AppError'

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  })
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    })
    return
  }

  console.error('[unhandled error]', err)

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.isProduction
        ? 'Something went wrong. Please try again.'
        : err instanceof Error
          ? err.message
          : 'Unknown error',
    },
  })
}
