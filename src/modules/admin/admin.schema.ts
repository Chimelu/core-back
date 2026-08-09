import { z } from 'zod'

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'suspended', 'closed']).optional(),
  role: z.enum(['user', 'admin']).optional(),
})

export const updateUserSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    status: z.enum(['active', 'suspended', 'closed']).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: 'Provide role and/or status to update',
  })

export const adminCreateAccountSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['checking', 'savings', 'business']),
  name: z.string().trim().min(2).max(60).optional(),
  currency: z.string().trim().toUpperCase().length(3).default('USD'),
  balance: z.coerce.number().min(0).max(10_000_000).default(0),
})

export const adminUpdateAccountSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    type: z.enum(['checking', 'savings', 'business']).optional(),
    status: z.enum(['active', 'frozen', 'closed']).optional(),
    balance: z.coerce.number().min(0).max(10_000_000).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.type !== undefined ||
      value.status !== undefined ||
      value.balance !== undefined,
    { message: 'Provide at least one field to update' },
  )

export const adminListTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().max(120).optional(),
  userId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
})

export const adminTopUpSchema = z.object({
  amount: z.coerce.number().positive().max(10_000_000),
  description: z.string().trim().min(1).max(180).optional(),
})

export const adminListAccountsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
})

export const adminCreateTransactionSchema = z.object({
  accountId: z.string().uuid(),
  direction: z.enum(['credit', 'debit']),
  amount: z.coerce.number().positive().max(10_000_000),
  category: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(180),
  // Optional posting date; defaults to now when omitted.
  date: z.coerce.date().optional(),
})

export const adminUpdateTransactionSchema = z
  .object({
    description: z.string().trim().min(1).max(180).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    amount: z.coerce.number().positive().max(10_000_000).optional(),
    direction: z.enum(['credit', 'debit']).optional(),
  })
  .refine(
    (value) =>
      value.description !== undefined ||
      value.category !== undefined ||
      value.amount !== undefined ||
      value.direction !== undefined,
    { message: 'Provide at least one field to update' },
  )

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type AdminCreateAccountInput = z.infer<typeof adminCreateAccountSchema>
export type AdminUpdateAccountInput = z.infer<typeof adminUpdateAccountSchema>
export type AdminListTransactionsQuery = z.infer<typeof adminListTransactionsQuerySchema>
export type AdminUpdateTransactionInput = z.infer<typeof adminUpdateTransactionSchema>
export type AdminTopUpInput = z.infer<typeof adminTopUpSchema>
export type AdminListAccountsQuery = z.infer<typeof adminListAccountsQuerySchema>
export type AdminCreateTransactionInput = z.infer<typeof adminCreateTransactionSchema>
