import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../middleware/authenticate'
import { validateBody } from '../../middleware/validate'
import { asyncHandler } from '../../utils/asyncHandler'
import * as authController from './auth.controller'
import { loginSchema, refreshSchema, registerSchema, updateProfileSchema } from './auth.schema'

const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many attempts. Please try again in a few minutes.',
    },
  },
})

export const authRouter = Router()

authRouter.post(
  '/register',
  credentialsLimiter,
  validateBody(registerSchema),
  asyncHandler(authController.register),
)

authRouter.post(
  '/login',
  credentialsLimiter,
  validateBody(loginSchema),
  asyncHandler(authController.login),
)

authRouter.post('/refresh', validateBody(refreshSchema), asyncHandler(authController.refresh))
authRouter.post('/logout', validateBody(refreshSchema), asyncHandler(authController.logout))
authRouter.get('/me', authenticate, asyncHandler(authController.me))
authRouter.get('/users', asyncHandler(authController.getUsers))
authRouter.patch(
  '/me',
  authenticate,
  validateBody(updateProfileSchema),
  asyncHandler(authController.updateMe),
)

authRouter.patch(
  '/me',
  authenticate,
  validateBody(updateProfileSchema),
  asyncHandler(authController.updateMe),
)
