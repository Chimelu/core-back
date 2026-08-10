import type { Request, Response } from 'express'
import { env } from '../../config/env'
import { AppError } from '../../utils/AppError'
import * as transfersService from './transfers.service'
import {
  listTransfersQuerySchema,
  resolveAccountQuerySchema,
  type CoreTrustTransferInput,
  type InternationalTransferInput,
  type LocalTransferInput,
} from './transfers.schema'

function userId(req: Request): string {
  if (!req.auth) throw AppError.unauthorized()
  return req.auth.sub
}

export async function list(req: Request, res: Response) {
  const filters = listTransfersQuerySchema.parse(req.query)
  const data = await transfersService.listTransfers(userId(req), filters)
  res.json({ success: true, data })
}

export async function summary(req: Request, res: Response) {
  const data = await transfersService.getMonthlySummary(userId(req))
  res.json({ success: true, data })
}

/** Pricing the transfer forms need up front so previews match what is charged. */
export async function config(_req: Request, res: Response) {
  res.json({
    success: true,
    data: { internationalFeePercent: env.INTERNATIONAL_TRANSFER_FEE_PERCENT },
  })
}

export async function resolve(req: Request, res: Response) {
  const { accountNumber } = resolveAccountQuerySchema.parse(req.query)
  const data = await transfersService.resolveRecipient(accountNumber)
  res.json({ success: true, data })
}

export async function detail(req: Request, res: Response) {
  const transfer = await transfersService.getTransfer(userId(req), req.params.id)
  res.json({ success: true, data: { transfer } })
}

export async function coretrust(req: Request, res: Response) {
  const transfer = await transfersService.createCoreTrustTransfer(
    userId(req),
    req.body as CoreTrustTransferInput,
  )
  res.status(201).json({ success: true, data: { transfer } })
}

export async function local(req: Request, res: Response) {
  const transfer = await transfersService.createLocalTransfer(
    userId(req),
    req.body as LocalTransferInput,
  )
  res.status(201).json({ success: true, data: { transfer } })
}

export async function international(req: Request, res: Response) {
  const transfer = await transfersService.createInternationalTransfer(
    userId(req),
    req.body as InternationalTransferInput,
  )
  res.status(201).json({ success: true, data: { transfer } })
}
