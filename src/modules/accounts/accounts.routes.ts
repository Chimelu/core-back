import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { authorize } from '../../middleware/authorize'
import { validateBody } from '../../middleware/validate'
import { asyncHandler } from '../../utils/asyncHandler'
import * as accountsController from './accounts.controller'
import { depositSchema, openAccountSchema, updateAccountSchema } from './accounts.schema'

export const accountsRouter = Router()

accountsRouter.use(authenticate)

accountsRouter.get('/', asyncHandler(accountsController.list))
accountsRouter.post('/', validateBody(openAccountSchema), asyncHandler(accountsController.open))
accountsRouter.get('/:id', asyncHandler(accountsController.detail))
accountsRouter.patch(
  '/:id',
  validateBody(updateAccountSchema),
  asyncHandler(accountsController.rename),
)
accountsRouter.get('/:id/transactions', asyncHandler(accountsController.transactions))
accountsRouter.post(
  '/:id/deposits',
  authorize('admin'),
  validateBody(depositSchema),
  asyncHandler(accountsController.deposit),
)
