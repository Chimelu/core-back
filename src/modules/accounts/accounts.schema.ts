import { z } from 'zod'

export const openAccountSchema = z.object({
  type: z.enum(['checking', 'savings', 'business']),
  name: z.string().trim().min(2).max(60).optional(),
  currency: z.string().trim().toUpperCase().length(3).default('USD'),
  openingDeposit: z.coerce.number().min(0).max(1_000_000).default(0),
})

export const updateAccountSchema = z.object({
  name: z.string().trim().min(2).max(60),
})

export const depositSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero').max(10_000_000),
  description: z.string().trim().max(180).optional(),
})

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const allTransactionsQuerySchema = transactionQuerySchema.extend({
  accountId: z.string().uuid().optional(),
  direction: z.enum(['credit', 'debit']).optional(),
})

export type OpenAccountInput = z.infer<typeof openAccountSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
export type DepositInput = z.infer<typeof depositSchema>
