import { IsNull } from 'typeorm'
import { AppDataSource } from '../../config/data-source'
import { RefreshToken } from '../../entities/RefreshToken'
import { User } from '../../entities/User'
import { AppError } from '../../utils/AppError'
import { hashPassword, verifyPassword } from '../../utils/password'
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../../utils/tokens'
import { createAccountFor } from '../accounts/accounts.service'
import type {
  LoginInput,
  RegisterInput,
  SetTransactionPinInput,
  UpdateProfileInput,
} from './auth.schema'

const userRepository = () => AppDataSource.getRepository(User)
const refreshTokenRepository = () => AppDataSource.getRepository(RefreshToken)

export type PublicUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  role: User['role']
  status: User['status']
  emailVerified: boolean
  /** Lets the UI prompt for setup instead of failing at transfer time. */
  hasTransactionPin: boolean
  createdAt: Date
}

export type SessionContext = {
  userAgent?: string
  ipAddress?: string
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    address: user.address,
    city: user.city,
    country: user.country,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    hasTransactionPin: user.transactionPinHash !== null,
    createdAt: user.createdAt,
  }
}

async function issueSession(user: User, context: SessionContext) {
  const { token, tokenHash, expiresAt } = generateRefreshToken()

  await refreshTokenRepository().save(
    refreshTokenRepository().create({
      tokenHash,
      userId: user.id,
      expiresAt,
      userAgent: context.userAgent?.slice(0, 255) ?? null,
      ipAddress: context.ipAddress?.slice(0, 60) ?? null,
    }),
  )

  return {
    accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    refreshToken: token,
    refreshTokenExpiresAt: expiresAt,
  }
}

export async function register(input: RegisterInput, context: SessionContext) {
  const existing = await userRepository().findOne({ where: { email: input.email } })

  if (existing) {
    throw AppError.conflict('An account with this email already exists')
  }

  const passwordHash = await hashPassword(input.password)
  const transactionPinHash = await hashPassword(input.pin)

  const { user, account } = await AppDataSource.transaction(async (manager) => {
    const created = await manager.save(
      manager.create(User, {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        transactionPinHash,
      }),
    )

    // Every customer starts with a primary checking account they can transact on.
    const primaryAccount = await createAccountFor(manager, created.id, {
      type: 'checking',
      isPrimary: true,
    })

    return { user: created, account: primaryAccount }
  })

  return {
    user: toPublicUser(user),
    account,
    tokens: await issueSession(user, context),
  }
}

export async function login(input: LoginInput, context: SessionContext) {
  const user = await userRepository().findOne({ where: { email: input.email } })

  // Compare against a dummy hash when the user is missing so that response
  // timing does not reveal whether the email is registered.
  const passwordMatches = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyPassword(input.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv')

  if (!user || !passwordMatches) {
    throw AppError.unauthorized('Incorrect email or password')
  }

  if (user.status !== 'active') {
    throw AppError.forbidden(`Your account is ${user.status}. Contact support for help.`)
  }

  user.lastLoginAt = new Date()
  await userRepository().save(user)

  return { user: toPublicUser(user), tokens: await issueSession(user, context) }
}

export async function refreshSession(rawToken: string, context: SessionContext) {
  const stored = await refreshTokenRepository().findOne({
    where: { tokenHash: hashRefreshToken(rawToken) },
    relations: { user: true },
  })

  if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
    throw AppError.unauthorized('Refresh token is invalid or expired')
  }

  if (stored.user.status !== 'active') {
    throw AppError.forbidden(`Your account is ${stored.user.status}.`)
  }

  // Rotate: the presented token is retired as soon as a new one is issued.
  stored.revokedAt = new Date()
  await refreshTokenRepository().save(stored)

  return {
    user: toPublicUser(stored.user),
    tokens: await issueSession(stored.user, context),
  }
}

export async function logout(rawToken: string) {
  await refreshTokenRepository().update(
    { tokenHash: hashRefreshToken(rawToken), revokedAt: IsNull() },
    { revokedAt: new Date() },
  )
}

export async function getProfile(userId: string) {
  const user = await userRepository().findOne({ where: { id: userId } })

  if (!user) {
    throw AppError.notFound('User not found')
  }

  return toPublicUser(user)
}

export async function getUsers() {
  const users = await userRepository().find()
  return users.map(toPublicUser)
}

/**
 * Sets or rotates the customer's own transfer PIN. Once a PIN exists the
 * current one has to be supplied, so a hijacked session cannot silently
 * replace it.
 */
export async function setTransactionPin(userId: string, input: SetTransactionPinInput) {
  const user = await userRepository().findOne({ where: { id: userId } })
  if (!user) throw AppError.notFound('User not found')

  if (user.transactionPinHash) {
    if (!input.currentPin) {
      throw AppError.badRequest('Enter your current PIN', [
        { field: 'currentPin', message: 'Enter your current PIN' },
      ])
    }

    const matches = await verifyPassword(input.currentPin, user.transactionPinHash)
    if (!matches) {
      throw AppError.badRequest('Your current PIN is incorrect', [
        { field: 'currentPin', message: 'Incorrect PIN' },
      ])
    }
  }

  user.transactionPinHash = await hashPassword(input.pin)
  await userRepository().save(user)

  return toPublicUser(user)
}

/** Admin override: replaces a customer's PIN without knowing the old one. */
export async function setTransactionPinForUser(userId: string, pin: string) {
  const user = await userRepository().findOne({ where: { id: userId } })
  if (!user) throw AppError.notFound('User not found')

  user.transactionPinHash = await hashPassword(pin)
  await userRepository().save(user)

  return toPublicUser(user)
}

/**
 * Gate in front of every money movement. Throws a coded error the UI can act
 * on: prompt for setup, or flag the PIN field as wrong.
 */
export async function assertTransactionPin(userId: string, pin: string) {
  const user = await userRepository().findOne({ where: { id: userId } })
  if (!user) throw AppError.unauthorized('User not found')

  if (!user.transactionPinHash) {
    throw new AppError(
      400,
      'TRANSACTION_PIN_NOT_SET',
      'Set your 4 digit transaction PIN in Settings before sending money',
    )
  }

  const matches = await verifyPassword(pin, user.transactionPinHash)
  if (!matches) {
    throw new AppError(400, 'INVALID_TRANSACTION_PIN', 'Incorrect transaction PIN', [
      { field: 'pin', message: 'Incorrect PIN' },
    ])
  }
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await userRepository().findOne({ where: { id: userId } })

  if (!user) {
    throw AppError.notFound('User not found')
  }

  // Blanking an optional field is meaningful, so empty strings become null
  // while omitted fields are left untouched.
  const optional = (value: string | undefined) =>
    value === undefined ? undefined : value.length > 0 ? value : null

  if (input.firstName !== undefined) user.firstName = input.firstName
  if (input.lastName !== undefined) user.lastName = input.lastName

  const phone = optional(input.phone)
  const address = optional(input.address)
  const city = optional(input.city)
  const country = optional(input.country)

  if (phone !== undefined) user.phone = phone
  if (address !== undefined) user.address = address
  if (city !== undefined) user.city = city
  if (country !== undefined) user.country = country

  await userRepository().save(user)

  return toPublicUser(user)
}
