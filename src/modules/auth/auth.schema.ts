import { z } from 'zod'

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, 'First name is too short').max(60),
  lastName: z.string().trim().min(2, 'Last name is too short').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(180),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number')
    .optional(),
  password,
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

// Email is deliberately not editable here — changing it would need a
// verification flow before it can be trusted as a login identifier.
export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2, 'First name is too short').max(60).optional(),
  lastName: z.string().trim().min(2, 'Last name is too short').max(60).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,20}$/, 'Enter a valid phone number')
    .or(z.literal(''))
    .optional(),
  address: z.string().trim().max(180).optional(),
  city: z.string().trim().max(90).optional(),
  country: z.string().trim().max(90).optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
