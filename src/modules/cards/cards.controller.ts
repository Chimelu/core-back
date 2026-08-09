import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import * as cardsService from './cards.service'
import type { CreateCardInput, UpdateCardInput } from './cards.schema'

function userId(req: Request): string {
  if (!req.auth) throw AppError.unauthorized()
  return req.auth.sub
}

export async function list(req: Request, res: Response) {
  const data = await cardsService.listCards(userId(req))
  res.json({ success: true, data })
}

export async function detail(req: Request, res: Response) {
  const card = await cardsService.getCard(userId(req), req.params.id)
  res.json({ success: true, data: { card } })
}

export async function create(req: Request, res: Response) {
  const card = await cardsService.createCard(userId(req), req.body as CreateCardInput)
  res.status(201).json({ success: true, data: { card } })
}

export async function reveal(req: Request, res: Response) {
  const details = await cardsService.revealCard(userId(req), req.params.id)
  res.set('Cache-Control', 'no-store')
  res.json({ success: true, data: { details } })
}

export async function update(req: Request, res: Response) {
  const card = await cardsService.updateCard(
    userId(req),
    req.params.id,
    req.body as UpdateCardInput,
  )
  res.json({ success: true, data: { card } })
}

export async function freeze(req: Request, res: Response) {
  const card = await cardsService.setFrozen(userId(req), req.params.id, true)
  res.json({ success: true, data: { card } })
}

export async function unfreeze(req: Request, res: Response) {
  const card = await cardsService.setFrozen(userId(req), req.params.id, false)
  res.json({ success: true, data: { card } })
}

export async function cancel(req: Request, res: Response) {
  const card = await cardsService.cancelCard(userId(req), req.params.id)
  res.json({ success: true, data: { card } })
}
