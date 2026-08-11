import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../middleware/authenticate'
import { requireActiveUser } from '../../middleware/requireActiveUser'
import { validateBody } from '../../middleware/validate'
import { asyncHandler } from '../../utils/asyncHandler'
import * as transfersController from './transfers.controller'
import {
  coreTrustTransferSchema,
  internationalTransferSchema,
  localTransferSchema,
} from './transfers.schema'

const transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Slow down and try again shortly.' },
  },
})

export const transfersRouter = Router()

transfersRouter.use(authenticate)

transfersRouter.get('/', asyncHandler(transfersController.list))
transfersRouter.get('/summary', asyncHandler(transfersController.summary))
transfersRouter.get('/config', asyncHandler(transfersController.config))
transfersRouter.get('/resolve-account', asyncHandler(transfersController.resolve))
transfersRouter.get('/:id', asyncHandler(transfersController.detail))

// Suspended and closed users keep read access to their history but cannot move money.
transfersRouter.post(
  '/coretrust',
  transferLimiter,
  asyncHandler(requireActiveUser),
  validateBody(coreTrustTransferSchema),
  asyncHandler(transfersController.coretrust),
)
transfersRouter.post(
  '/local',
  transferLimiter,
  asyncHandler(requireActiveUser),
  validateBody(localTransferSchema),
  asyncHandler(transfersController.local),
)
transfersRouter.post(
  '/international',
  transferLimiter,
  asyncHandler(requireActiveUser),
  validateBody(internationalTransferSchema),
  asyncHandler(transfersController.international),
)
