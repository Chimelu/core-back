import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { asyncHandler } from '../../utils/asyncHandler'
import * as accountsController from './accounts.controller'

/** Ledger across all of the user's accounts, separate from a single account's view. */
export const transactionsRouter = Router()

transactionsRouter.use(authenticate)

transactionsRouter.get('/', asyncHandler(accountsController.allTransactions))
