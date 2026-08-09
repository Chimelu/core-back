import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../utils/AppError'
import { verifyAccessToken } from '../utils/tokens'

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized('Missing bearer token'))
    return
  }

  try {
    req.auth = verifyAccessToken(header.slice(7))
    next()
  } catch {
    next(AppError.unauthorized('Invalid or expired token'))
  }
}
