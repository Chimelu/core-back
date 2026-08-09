import type { NextFunction, Request, Response } from 'express'
import type { UserRole } from '../entities/User'
import { AppError } from '../utils/AppError'

/** Must run after `authenticate`. */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(AppError.unauthorized())
      return
    }

    if (!roles.includes(req.auth.role)) {
      next(AppError.forbidden())
      return
    }

    next()
  }
}
