import { AppDataSource } from '../../config/data-source'
import { Account } from '../../entities/Account'
import { Card, type CardBrand } from '../../entities/Card'
import { Transaction } from '../../entities/Transaction'
import { User } from '../../entities/User'
import { AppError } from '../../utils/AppError'
import { decrypt, encrypt } from '../../utils/crypto'
import { generateCardNumber, generateCvv } from '../../utils/generators'
import type { CreateCardInput, UpdateCardInput } from './cards.schema'

const BRAND_PREFIX: Record<CardBrand, string> = { VISA: '4', Mastercard: '5' }
const MAX_ACTIVE_CARDS = 5

const cardRepository = () => AppDataSource.getRepository(Card)

export type PublicCard = Omit<Card, 'numberEncrypted' | 'cvvEncrypted' | 'user' | 'account'> & {
  maskedNumber: string
  expiry: string
  spentThisMonth: number
}

function startOfMonth() {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

function toPublicCard(card: Card, spentThisMonth: number): PublicCard {
  const { numberEncrypted: _n, cvvEncrypted: _c, user: _u, account: _a, ...rest } = card

  return {
    ...rest,
    maskedNumber: `•••• •••• •••• ${card.last4}`,
    expiry: `${String(card.expiryMonth).padStart(2, '0')}/${String(card.expiryYear).slice(-2)}`,
    spentThisMonth,
  }
}

/** Card spend is derived from the ledger rather than kept in a counter that can drift. */
async function spendByCard(userId: string): Promise<Map<string, number>> {
  const rows = await AppDataSource.getRepository(Transaction)
    .createQueryBuilder('t')
    .select('t.card_id', 'cardId')
    .addSelect('COALESCE(SUM(t.amount), 0)', 'total')
    .where('t.user_id = :userId', { userId })
    .andWhere('t.direction = :direction', { direction: 'debit' })
    .andWhere('t.card_id IS NOT NULL')
    .andWhere('t.created_at >= :start', { start: startOfMonth() })
    .groupBy('t.card_id')
    .getRawMany<{ cardId: string; total: string }>()

  return new Map(rows.map((row) => [row.cardId, Number(row.total)]))
}

export async function listCards(userId: string) {
  const cards = await cardRepository().find({
    where: { userId },
    order: { createdAt: 'DESC' },
  })

  const spend = await spendByCard(userId)
  const publicCards = cards.map((card) => toPublicCard(card, spend.get(card.id) ?? 0))

  return {
    cards: publicCards,
    summary: {
      totalCards: publicCards.length,
      activeCards: publicCards.filter((card) => card.status === 'active').length,
      spentThisMonth: publicCards.reduce((sum, card) => sum + card.spentThisMonth, 0),
    },
  }
}

async function findOwnedCard(userId: string, cardId: string) {
  const card = await cardRepository().findOne({ where: { id: cardId, userId } })
  if (!card) throw AppError.notFound('Card not found')
  return card
}

export async function getCard(userId: string, cardId: string) {
  const card = await findOwnedCard(userId, cardId)
  const spend = await spendByCard(userId)
  return toPublicCard(card, spend.get(card.id) ?? 0)
}

export async function createCard(userId: string, input: CreateCardInput) {
  const account = await AppDataSource.getRepository(Account).findOne({
    where: { id: input.accountId, userId },
  })

  if (!account) throw AppError.notFound('Linked account not found')
  if (account.status !== 'active') {
    throw AppError.badRequest(`Cannot issue a card on a ${account.status} account`)
  }

  const activeCards = await cardRepository().countBy({ userId, status: 'active' })
  if (activeCards >= MAX_ACTIVE_CARDS) {
    throw AppError.badRequest(`You can hold at most ${MAX_ACTIVE_CARDS} active cards`)
  }

  const user = await AppDataSource.getRepository(User).findOneOrFail({ where: { id: userId } })
  const number = generateCardNumber(BRAND_PREFIX[input.brand])
  const cvv = generateCvv()
  const expiry = new Date()
  expiry.setFullYear(expiry.getFullYear() + 4)

  const card = await cardRepository().save(
    cardRepository().create({
      userId,
      accountId: account.id,
      label: input.label?.trim() || (input.type === 'virtual' ? 'Virtual Card' : 'Physical Card'),
      brand: input.brand,
      type: input.type,
      status: 'active',
      numberEncrypted: encrypt(number),
      cvvEncrypted: encrypt(cvv),
      last4: number.slice(-4),
      expiryMonth: expiry.getMonth() + 1,
      expiryYear: expiry.getFullYear(),
      holderName: `${user.firstName} ${user.lastName}`.toUpperCase(),
      spendingLimit: input.spendingLimit,
      onlinePaymentsEnabled: input.onlinePaymentsEnabled,
      internationalEnabled: input.internationalEnabled,
    }),
  )

  return toPublicCard(card, 0)
}

/** Returns the decrypted PAN and CVV. Never log or cache this response. */
export async function revealCard(userId: string, cardId: string) {
  const card = await findOwnedCard(userId, cardId)

  if (card.status === 'cancelled') {
    throw AppError.badRequest('This card has been cancelled')
  }

  const number = decrypt(card.numberEncrypted)

  return {
    number: number.replace(/(.{4})/g, '$1 ').trim(),
    cvv: decrypt(card.cvvEncrypted),
    expiry: `${String(card.expiryMonth).padStart(2, '0')}/${String(card.expiryYear).slice(-2)}`,
    holderName: card.holderName,
  }
}

export async function updateCard(userId: string, cardId: string, input: UpdateCardInput) {
  const card = await findOwnedCard(userId, cardId)

  if (card.status === 'cancelled') {
    throw AppError.badRequest('This card has been cancelled')
  }

  Object.assign(card, input)
  await cardRepository().save(card)

  return getCard(userId, cardId)
}

export async function setFrozen(userId: string, cardId: string, frozen: boolean) {
  const card = await findOwnedCard(userId, cardId)

  if (card.status === 'cancelled') {
    throw AppError.badRequest('This card has been cancelled')
  }

  card.status = frozen ? 'frozen' : 'active'
  await cardRepository().save(card)

  return getCard(userId, cardId)
}

export async function cancelCard(userId: string, cardId: string) {
  const card = await findOwnedCard(userId, cardId)

  card.status = 'cancelled'
  await cardRepository().save(card)

  return getCard(userId, cardId)
}
