import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import * as authService from './auth.service'
import type {
  LoginInput,
  RefreshInput,
  RegisterInput,
  UpdateProfileInput,
} from './auth.schema'

function sessionContext(req: Request): authService.SessionContext {
  return { userAgent: req.get('user-agent') ?? undefined, ipAddress: req.ip }
}

export async function register(req: Request, res: Response) {
  const result = await authService.register(req.body as RegisterInput, sessionContext(req))
  res.status(201).json({ success: true, data: result })
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body as LoginInput, sessionContext(req))
  res.status(200).json({ success: true, data: result })
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as RefreshInput
  const result = await authService.refreshSession(refreshToken, sessionContext(req))
  res.status(200).json({ success: true, data: result })
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body as RefreshInput
  await authService.logout(refreshToken)
  res.status(200).json({ success: true, data: { message: 'Signed out' } })
}

export async function me(req: Request, res: Response) {
  if (!req.auth) throw AppError.unauthorized()
  const user = await authService.getProfile(req.auth.sub)
  res.status(200).json({ success: true, data: { user } })
}

export async function updateMe(req: Request, res: Response) {
  if (!req.auth) throw AppError.unauthorized()
  const user = await authService.updateProfile(req.auth.sub, req.body as UpdateProfileInput)
  res.status(200).json({ success: true, data: { user } })
}

export async function getUsers(req: Request, res: Response) {
  const users = await authService.getUsers()
  res.status(200).json({ success: true, data: { users } })
}

