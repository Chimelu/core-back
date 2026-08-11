import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { authorize } from '../../middleware/authorize'
import { validateBody } from '../../middleware/validate'
import { asyncHandler } from '../../utils/asyncHandler'
import { adminSetTransactionPinSchema } from '../auth/auth.schema'
import * as adminController from './admin.controller'
import {
  adminCreateAccountSchema,
  adminCreateTransactionSchema,
  adminTopUpSchema,
  adminUpdateAccountSchema,
  adminUpdateTransactionSchema,
  updateUserSchema,
} from './admin.schema'

export const adminRouter = Router()

// Every admin route requires a valid session with the admin role.
adminRouter.use(authenticate, authorize('admin'))

adminRouter.get('/users', asyncHandler(adminController.listUsers))
adminRouter.patch(
  '/users/:id',
  validateBody(updateUserSchema),
  asyncHandler(adminController.updateUser),
)
adminRouter.patch(
  '/users/:id/pin',
  validateBody(adminSetTransactionPinSchema),
  asyncHandler(adminController.updateUserPin),
)
adminRouter.delete('/users/:id', asyncHandler(adminController.deleteUser))

adminRouter.post(
  '/accounts',
  validateBody(adminCreateAccountSchema),
  asyncHandler(adminController.createAccount),
)
adminRouter.patch(
  '/accounts/:id',
  validateBody(adminUpdateAccountSchema),
  asyncHandler(adminController.updateAccount),
)
adminRouter.get('/accounts', asyncHandler(adminController.listAccounts))
adminRouter.post(
  '/accounts/:id/topup',
  validateBody(adminTopUpSchema),
  asyncHandler(adminController.topUp),
)

adminRouter.get('/transactions', asyncHandler(adminController.listTransactions))
adminRouter.post(
  '/transactions',
  validateBody(adminCreateTransactionSchema),
  asyncHandler(adminController.createTransaction),
)
adminRouter.patch(
  '/transactions/:id',
  validateBody(adminUpdateTransactionSchema),
  asyncHandler(adminController.updateTransaction),
)
adminRouter.delete('/transactions/:id', asyncHandler(adminController.deleteTransaction))
