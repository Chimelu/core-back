import { Brackets, type EntityManager } from 'typeorm'
import { AppDataSource } from '../../config/data-source'
import { env } from '../../config/env'
import { Account } from '../../entities/Account'
import { Transaction } from '../../entities/Transaction'
import { Transfer, type TransferKind } from '../../entities/Transfer'
import { User } from '../../entities/User'
import { AppError } from '../../utils/AppError'
import { generateReference } from '../../utils/generators'
import { fromCents, toCents } from '../../utils/money'
import { applyCredit, applyDebit } from '../accounts/accounts.service'
import type {
  CoreTrustTransferInput,
  InternationalTransferInput,
  LocalTransferInput,
} from './transfers.schema'

type ListFilters = {
  kind?: TransferKind
  status?: 'pending' | 'completed' | 'failed'
  q?: string
  page: number
  limit: number
}

async function lockSourceAccount(manager: EntityManager, userId: string, accountId: string) {
  const account = await manager.findOne(Account, {
    where: { id: accountId, userId },
    lock: { mode: 'pessimistic_write' },
  })

  if (!account) throw AppError.notFound('Source account not found')
  if (account.status !== 'active') {
    throw AppError.badRequest(`Source account is ${account.status}`)
  }

  return account
}

function assertSufficientFunds(account: Account, total: number) {
  if (toCents(account.balance) < toCents(total)) {
    throw AppError.badRequest('Insufficient funds for this transfer')
  }
}

/** Looks up the holder of a CoreTrust account number so the UI can confirm the recipient. */
export async function resolveRecipient(accountNumber: string) {
  const account = await AppDataSource.getRepository(Account).findOne({
    where: { accountNumber },
    relations: { user: true },
  })

  if (!account || account.status !== 'active') {
    throw AppError.notFound('No active CoreTrust account matches that number')
  }

  return {
    accountNumber: account.accountNumber,
    accountName: account.name,
    recipientName: `${account.user.firstName} ${account.user.lastName}`,
  }
}

export async function createCoreTrustTransfer(userId: string, input: CoreTrustTransferInput) {
  return AppDataSource.transaction(async (manager) => {
    const source = await lockSourceAccount(manager, userId, input.sourceAccountId)

    if (source.accountNumber === input.recipientAccountNumber) {
      throw AppError.badRequest('You cannot transfer to the same account')
    }

    const destination = await manager.findOne(Account, {
      where: { accountNumber: input.recipientAccountNumber },
      lock: { mode: 'pessimistic_write' },
    })

    if (!destination || destination.status !== 'active') {
      throw AppError.notFound('Recipient CoreTrust account not found')
    }

    if (destination.currency !== source.currency) {
      throw AppError.badRequest('Cross-currency transfers are not supported yet')
    }

    assertSufficientFunds(source, input.amount)

    const recipient = await manager.findOneOrFail(User, { where: { id: destination.userId } })
    const recipientName = `${recipient.firstName} ${recipient.lastName}`
    const reference = generateReference('CTB')

    const transfer = await manager.save(
      manager.create(Transfer, {
        reference,
        userId,
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        kind: 'coretrust',
        status: 'completed',
        amount: input.amount,
        fee: 0,
        currency: source.currency,
        recipientName,
        recipientAccountNumber: destination.accountNumber,
        description: input.description ?? null,
        completedAt: new Date(),
      }),
    )

    await applyDebit(manager, source, {
      amount: input.amount,
      category: 'transfer',
      description: `Transfer to ${recipientName}`,
      reference,
      transferId: transfer.id,
    })

    await applyCredit(manager, destination, {
      amount: input.amount,
      category: 'transfer',
      description: `Transfer from ${source.name}`,
      reference,
      transferId: transfer.id,
    })

    return transfer
  })
}

export async function createLocalTransfer(userId: string, input: LocalTransferInput) {
  return createExternalTransfer(userId, 'local', {
    ...input,
    swiftCode: null,
    fee: 0,
  })
}

/** Fee the international form previews before the transfer is submitted. */
export function quoteInternationalFee(amount: number) {
  return fromCents(Math.round((toCents(amount) * env.INTERNATIONAL_TRANSFER_FEE_PERCENT) / 100))
}

export async function createInternationalTransfer(
  userId: string,
  input: InternationalTransferInput,
) {
  return createExternalTransfer(userId, 'international', {
    ...input,
    fee: quoteInternationalFee(input.amount),
  })
}

async function createExternalTransfer(
  userId: string,
  kind: Extract<TransferKind, 'local' | 'international'>,
  input: {
    sourceAccountId: string
    recipientName: string
    recipientAccountNumber: string
    bankName: string
    swiftCode?: string | null
    bankCountry?: string | null
    bankAddress?: string | null
    recipientAddress?: string | null
    amount: number
    description?: string
    fee: number
  },
) {
  return AppDataSource.transaction(async (manager) => {
    const source = await lockSourceAccount(manager, userId, input.sourceAccountId)
    const total = fromCents(toCents(input.amount) + toCents(input.fee))

    assertSufficientFunds(source, total)

    const reference = generateReference(kind === 'local' ? 'LCL' : 'INT')

    // Funds leave immediately but settlement with the receiving bank is async,
    // so the transfer stays pending until it is marked settled.
    const transfer = await manager.save(
      manager.create(Transfer, {
        reference,
        userId,
        sourceAccountId: source.id,
        destinationAccountId: null,
        kind,
        status: 'pending',
        amount: input.amount,
        fee: input.fee,
        currency: source.currency,
        recipientName: input.recipientName,
        recipientAccountNumber: input.recipientAccountNumber,
        recipientBankName: input.bankName,
        swiftCode: input.swiftCode ?? null,
        bankCountry: input.bankCountry ?? null,
        bankAddress: input.bankAddress ?? null,
        recipientAddress: input.recipientAddress ?? null,
        description: input.description ?? null,
      }),
    )

    await applyDebit(manager, source, {
      amount: input.amount,
      category: 'transfer',
      description: `Transfer to ${input.recipientName} (${input.bankName})`,
      reference,
      transferId: transfer.id,
    })

    if (input.fee > 0) {
      await applyDebit(manager, source, {
        amount: input.fee,
        category: 'fee',
        description: `Transfer fee · ${reference}`,
        reference,
        transferId: transfer.id,
      })
    }

    return transfer
  })
}

export async function listTransfers(userId: string, filters: ListFilters) {
  const query = AppDataSource.getRepository(Transfer)
    .createQueryBuilder('transfer')
    .where('transfer.user_id = :userId', { userId })
    .orderBy('transfer.created_at', 'DESC')
    .skip((filters.page - 1) * filters.limit)
    .take(filters.limit)

  if (filters.kind) query.andWhere('transfer.kind = :kind', { kind: filters.kind })
  if (filters.status) query.andWhere('transfer.status = :status', { status: filters.status })

  if (filters.q) {
    query.andWhere(
      new Brackets((qb) => {
        qb.where('transfer.recipient_name ILIKE :q', { q: `%${filters.q}%` }).orWhere(
          'transfer.reference ILIKE :q',
          { q: `%${filters.q}%` },
        )
      }),
    )
  }

  const [transfers, total] = await query.getManyAndCount()

  return {
    transfers,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit),
    },
  }
}

export async function getTransfer(userId: string, transferId: string) {
  const transfer = await AppDataSource.getRepository(Transfer).findOne({
    where: { id: transferId, userId },
  })

  if (!transfer) throw AppError.notFound('Transfer not found')

  return transfer
}

/** Totals moved in and out across all of the user's accounts this calendar month. */
export async function getMonthlySummary(userId: string) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const rows = await AppDataSource.getRepository(Transaction)
    .createQueryBuilder('t')
    .select('t.direction', 'direction')
    .addSelect('COALESCE(SUM(t.amount), 0)', 'total')
    .where('t.user_id = :userId', { userId })
    .andWhere('t.created_at >= :startOfMonth', { startOfMonth })
    .groupBy('t.direction')
    .getRawMany<{ direction: 'credit' | 'debit'; total: string }>()

  const totalFor = (direction: 'credit' | 'debit') =>
    Number(rows.find((row) => row.direction === direction)?.total ?? 0)

  const transferCount = await AppDataSource.getRepository(Transfer).countBy({ userId })

  return {
    sent: totalFor('debit'),
    received: totalFor('credit'),
    transferCount,
    periodStart: startOfMonth,
  }
}
