import { z } from 'zod'

export const createCardSchema = z.object({
  accountId: z.string().uuid('Select the account to link this card to'),
  type: z.enum(['virtual', 'physical']),
  label: z.string().trim().min(2).max(60).optional(),
  brand: z.enum(['VISA', 'Mastercard']).default('VISA'),
  spendingLimit: z.coerce.number().min(0).max(1_000_000).default(1000),
  onlinePaymentsEnabled: z.boolean().default(true),
  internationalEnabled: z.boolean().default(false),
})

export const updateCardSchema = z
  .object({
    label: z.string().trim().min(2).max(60).optional(),
    spendingLimit: z.coerce.number().min(0).max(1_000_000).optional(),
    onlinePaymentsEnabled: z.boolean().optional(),
    internationalEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  })

export type CreateCardInput = z.infer<typeof createCardSchema>
export type UpdateCardInput = z.infer<typeof updateCardSchema>
