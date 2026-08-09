import { Router } from 'express'
import { accountsRouter } from '../modules/accounts/accounts.routes'
import { transactionsRouter } from '../modules/accounts/transactions.routes'
import { adminRouter } from '../modules/admin/admin.routes'
import { authRouter } from '../modules/auth/auth.routes'
import { cardsRouter } from '../modules/cards/cards.routes'
import { transfersRouter } from '../modules/transfers/transfers.routes'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } })
})

apiRouter.use('/auth', authRouter)
apiRouter.use('/accounts', accountsRouter)
apiRouter.use('/transactions', transactionsRouter)
apiRouter.use('/transfers', transfersRouter)
apiRouter.use('/cards', cardsRouter)
apiRouter.use('/admin', adminRouter)
