import { z } from 'zod'

const amount = z.coerce
  .number()
  .positive('Amount must be greater than zero')
  .max(1_000_000, 'Amount exceeds the per-transfer limit')

const description = z.string().trim().max(255).optional()

export const coreTrustTransferSchema = z.object({
  sourceAccountId: z.string().uuid('Select a valid source account'),
  recipientAccountNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'CoreTrust account numbers are 10 digits'),
  amount,
  description,
})

export const localTransferSchema = z.object({
  sourceAccountId: z.string().uuid('Select a valid source account'),
  recipientName: z.string().trim().min(2).max(120),
  recipientAccountNumber: z.string().trim().min(6).max(40),
  bankName: z.string().trim().min(2).max(120),
  amount,
  description,
})

export const internationalTransferSchema = z.object({
  sourceAccountId: z.string().uuid('Select a valid source account'),
  recipientName: z.string().trim().min(2).max(120),
  recipientAccountNumber: z.string().trim().min(6).max(40),
  recipientAddress: z.string().trim().min(4, 'Enter the recipient address').max(255),
  bankName: z.string().trim().min(2).max(120),
  bankCountry: z.string().trim().min(2, 'Enter the bank country').max(90),
  bankAddress: z.string().trim().min(4, 'Enter the bank address').max(255),
  swiftCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8,11}$/, 'Enter a valid routing number or SWIFT/BIC code'),
  amount,
  description,
})

export const listTransfersQuerySchema = z.object({
  kind: z.enum(['coretrust', 'local', 'international']).optional(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const resolveAccountQuerySchema = z.object({
  accountNumber: z.string().trim().regex(/^[0-9]{10}$/, 'Enter a 10 digit account number'),
})

export type CoreTrustTransferInput = z.infer<typeof coreTrustTransferSchema>
export type LocalTransferInput = z.infer<typeof localTransferSchema>
export type InternationalTransferInput = z.infer<typeof internationalTransferSchema>
