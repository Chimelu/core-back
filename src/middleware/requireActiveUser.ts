import type { NextFunction, Request, Response } from 'express'
import { AppDataSource } from '../config/data-source'
import { User } from '../entities/User'
import { AppError } from '../utils/AppError'

/** Must run after `authenticate`. Blocks suspended or closed users from banking ops. */
export async function requireActiveUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) {
    next(AppError.unauthorized())
    return
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: req.auth.sub },
    select: ['id', 'status', 'role'],
  })

  if (!user) {
    next(AppError.unauthorized('User not found'))
    return
  }

  if (user.status !== 'active') {
    next(
      AppError.forbidden(
        `Your account is ${user.status}. Contact support if you think this is a mistake.`,
      ),
    )
    return
  }

  next()
}
