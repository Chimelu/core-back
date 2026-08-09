import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate'
import { validateBody } from '../../middleware/validate'
import { asyncHandler } from '../../utils/asyncHandler'
import * as cardsController from './cards.controller'
import { createCardSchema, updateCardSchema } from './cards.schema'

export const cardsRouter = Router()

cardsRouter.use(authenticate)

cardsRouter.get('/', asyncHandler(cardsController.list))
cardsRouter.post('/', validateBody(createCardSchema), asyncHandler(cardsController.create))
cardsRouter.get('/:id', asyncHandler(cardsController.detail))
cardsRouter.get('/:id/reveal', asyncHandler(cardsController.reveal))
cardsRouter.patch('/:id', validateBody(updateCardSchema), asyncHandler(cardsController.update))
cardsRouter.post('/:id/freeze', asyncHandler(cardsController.freeze))
cardsRouter.post('/:id/unfreeze', asyncHandler(cardsController.unfreeze))
cardsRouter.delete('/:id', asyncHandler(cardsController.cancel))
