import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import * as accountsService from './accounts.service'
import {
  allTransactionsQuerySchema,
  transactionQuerySchema,
  type DepositInput,
  type OpenAccountInput,
  type UpdateAccountInput,
} from './accounts.schema'

function userId(req: Request): string {
  if (!req.auth) throw AppError.unauthorized()
  return req.auth.sub
}

export async function list(req: Request, res: Response) {
  const data = await accountsService.listAccounts(userId(req))
  res.json({ success: true, data })
}

export async function detail(req: Request, res: Response) {
  const account = await accountsService.getAccount(userId(req), req.params.id)
  res.json({ success: true, data: { account } })
}

export async function open(req: Request, res: Response) {
  const account = await accountsService.openAccount(userId(req), req.body as OpenAccountInput)
  res.status(201).json({ success: true, data: { account } })
}

export async function rename(req: Request, res: Response) {
  const { name } = req.body as UpdateAccountInput
  const account = await accountsService.renameAccount(userId(req), req.params.id, name)
  res.json({ success: true, data: { account } })
}

export async function transactions(req: Request, res: Response) {
  const { page, limit } = transactionQuerySchema.parse(req.query)
  const data = await accountsService.listTransactions(userId(req), req.params.id, page, limit)
  res.json({ success: true, data })
}

export async function allTransactions(req: Request, res: Response) {
  const filters = allTransactionsQuerySchema.parse(req.query)
  const data = await accountsService.listUserTransactions(userId(req), filters)
  res.json({ success: true, data })
}

export async function deposit(req: Request, res: Response) {
  const account = await accountsService.deposit(req.params.id, req.body as DepositInput)
  res.status(201).json({ success: true, data: { account } })
}
