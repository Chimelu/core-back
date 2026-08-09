import crypto from 'node:crypto'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { env } from '../config/env'
import type { UserRole } from '../entities/User'

export type AccessTokenPayload = {
  sub: string
  email: string
  role: UserRole
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  }
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options)
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload
}

/** Refresh tokens are opaque random strings; only their hash is persisted. */
export function generateRefreshToken() {
  const token = crypto.randomBytes(48).toString('hex')
  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  )
  return { token, tokenHash: hashRefreshToken(token), expiresAt }
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
