import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../middleware/authenticate'
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
transfersRouter.get('/resolve-account', asyncHandler(transfersController.resolve))
transfersRouter.get('/:id', asyncHandler(transfersController.detail))

transfersRouter.post(
  '/coretrust',
  transferLimiter,
  validateBody(coreTrustTransferSchema),
  asyncHandler(transfersController.coretrust),
)
transfersRouter.post(
  '/local',
  transferLimiter,
  validateBody(localTransferSchema),
  asyncHandler(transfersController.local),
)
transfersRouter.post(
  '/international',
  transferLimiter,
  validateBody(internationalTransferSchema),
  asyncHandler(transfersController.international),
)
