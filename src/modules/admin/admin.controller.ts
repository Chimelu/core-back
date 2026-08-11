import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import { setTransactionPinForUser } from '../auth/auth.service'
import type { AdminSetTransactionPinInput } from '../auth/auth.schema'
import * as adminService from './admin.service'
import {
  adminListAccountsQuerySchema,
  adminListTransactionsQuerySchema,
  listUsersQuerySchema,
  type AdminCreateAccountInput,
  type AdminCreateTransactionInput,
  type AdminTopUpInput,
  type AdminUpdateAccountInput,
  type AdminUpdateTransactionInput,
  type UpdateUserInput,
} from './admin.schema'

export async function listUsers(req: Request, res: Response) {
  const query = listUsersQuerySchema.parse(req.query)
  const data = await adminService.listUsers(query)
  res.json({ success: true, data })
}

export async function updateUser(req: Request, res: Response) {
  const user = await adminService.updateUser(req.params.id, req.body as UpdateUserInput)
  res.json({ success: true, data: { user } })
}

export async function deleteUser(req: Request, res: Response) {
  if (!req.auth) throw AppError.unauthorized()
  const data = await adminService.deleteUser(req.auth.sub, req.params.id)
  res.json({ success: true, data })
}

export async function createAccount(req: Request, res: Response) {
  const account = await adminService.createAccount(req.body as AdminCreateAccountInput)
  res.status(201).json({ success: true, data: { account } })
}

export async function updateAccount(req: Request, res: Response) {
  const account = await adminService.updateAccount(
    req.params.id,
    req.body as AdminUpdateAccountInput,
  )
  res.json({ success: true, data: { account } })
}

export async function topUp(req: Request, res: Response) {
  const account = await adminService.topUpAccount(req.params.id, req.body as AdminTopUpInput)
  res.status(201).json({ success: true, data: { account } })
}

export async function listAccounts(req: Request, res: Response) {
  const query = adminListAccountsQuerySchema.parse(req.query)
  const data = await adminService.listAccounts(query)
  res.json({ success: true, data })
}

export async function listTransactions(req: Request, res: Response) {
  const query = adminListTransactionsQuerySchema.parse(req.query)
  const data = await adminService.listTransactions(query)
  res.json({ success: true, data })
}

export async function createTransaction(req: Request, res: Response) {
  const transaction = await adminService.createTransaction(
    req.body as AdminCreateTransactionInput,
  )
  res.status(201).json({ success: true, data: { transaction } })
}

export async function updateUserPin(req: Request, res: Response) {
  const { pin } = req.body as AdminSetTransactionPinInput
  const user = await setTransactionPinForUser(req.params.id, pin)
  res.json({ success: true, data: { user } })
}

export async function updateTransaction(req: Request, res: Response) {
  const transaction = await adminService.updateTransaction(
    req.params.id,
    req.body as AdminUpdateTransactionInput,
  )
  res.json({ success: true, data: { transaction } })
}

export async function deleteTransaction(req: Request, res: Response) {
  const result = await adminService.deleteTransaction(req.params.id)
  res.json({ success: true, data: result })
}
