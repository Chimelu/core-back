import type { EntityManager, FindOptionsWhere } from 'typeorm'
import { AppDataSource } from '../../config/data-source'
import { Account, type AccountType } from '../../entities/Account'
import { Transaction } from '../../entities/Transaction'
import { AppError } from '../../utils/AppError'
import { generateAccountNumber } from '../../utils/generators'
import { fromCents, toCents } from '../../utils/money'
import type { DepositInput, OpenAccountInput } from './accounts.schema'

const DEFAULT_NAMES: Record<AccountType, string> = {
  checking: 'Everyday Spending',
  savings: 'Savings Account',
  business: 'Business Account',
}

export async function reserveAccountNumber(manager: EntityManager): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateAccountNumber()
    const taken = await manager.exists(Account, { where: { accountNumber: candidate } })
    if (!taken) return candidate
  }

  throw new AppError(503, 'ACCOUNT_NUMBER_UNAVAILABLE', 'Could not allocate an account number')
}

/** Called during registration so every user starts with a usable account. */
export async function createAccountFor(
  manager: EntityManager,
  userId: string,
  input: { type: AccountType; name?: string; currency?: string; isPrimary?: boolean },
): Promise<Account> {
  const account = manager.create(Account, {
    userId,
    accountNumber: await reserveAccountNumber(manager),
    name: input.name?.trim() || DEFAULT_NAMES[input.type],
    type: input.type,
    currency: input.currency ?? 'USD',
    balance: 0,
    isPrimary: input.isPrimary ?? false,
  })

  return manager.save(account)
}

export async function listAccounts(userId: string) {
  const accounts = await AppDataSource.getRepository(Account).find({
    where: { userId },
    order: { isPrimary: 'DESC', createdAt: 'ASC' },
  })

  const totalBalance = fromCents(
    accounts.reduce((sum, account) => sum + toCents(account.balance), 0),
  )

  return { accounts, summary: { totalBalance, accountCount: accounts.length } }
}

export async function getAccount(userId: string, accountId: string) {
  const account = await AppDataSource.getRepository(Account).findOne({
    where: { id: accountId, userId },
  })

  if (!account) throw AppError.notFound('Account not found')

  return account
}

export async function openAccount(userId: string, input: OpenAccountInput) {
  return AppDataSource.transaction(async (manager) => {
    const isFirstAccount = !(await manager.exists(Account, { where: { userId } }))

    const account = await createAccountFor(manager, userId, {
      type: input.type,
      name: input.name,
      currency: input.currency,
      isPrimary: isFirstAccount,
    })

    if (input.openingDeposit > 0) {
      await applyCredit(manager, account, {
        amount: input.openingDeposit,
        category: 'deposit',
        description: 'Opening deposit',
      })
    }

    return manager.findOneOrFail(Account, { where: { id: account.id } })
  })
}

export async function renameAccount(userId: string, accountId: string, name: string) {
  const account = await getAccount(userId, accountId)
  account.name = name
  return AppDataSource.getRepository(Account).save(account)
}

export async function listTransactions(
  userId: string,
  accountId: string,
  page: number,
  limit: number,
) {
  await getAccount(userId, accountId)

  const [transactions, total] = await AppDataSource.getRepository(Transaction).findAndCount({
    where: { accountId, userId },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  })

  return { transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
}

/** Ledger across every account the user owns, newest first. */
export async function listUserTransactions(
  userId: string,
  filters: { page: number; limit: number; accountId?: string; direction?: 'credit' | 'debit' },
) {
  const where: FindOptionsWhere<Transaction> = { userId }
  if (filters.accountId) where.accountId = filters.accountId
  if (filters.direction) where.direction = filters.direction

  const [transactions, total] = await AppDataSource.getRepository(Transaction).findAndCount({
    where,
    order: { createdAt: 'DESC' },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
  })

  return {
    transactions,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit),
    },
  }
}

/** Credits an account and writes the matching ledger row. Caller owns the transaction. */
export async function applyCredit(
  manager: EntityManager,
  account: Account,
  entry: {
    amount: number
    category: string
    description: string
    reference?: string
    transferId?: string
  },
) {
  const balance = fromCents(toCents(account.balance) + toCents(entry.amount))

  account.balance = balance
  await manager.save(account)

  return manager.save(
    manager.create(Transaction, {
      accountId: account.id,
      userId: account.userId,
      direction: 'credit',
      amount: entry.amount,
      balanceAfter: balance,
      category: entry.category,
      description: entry.description,
      reference: entry.reference ?? null,
      transferId: entry.transferId ?? null,
    }),
  )
}

/** Debits an account and writes the matching ledger row. Caller owns the transaction. */
export async function applyDebit(
  manager: EntityManager,
  account: Account,
  entry: {
    amount: number
    category: string
    description: string
    reference?: string
    transferId?: string
    cardId?: string
  },
) {
  const balance = fromCents(toCents(account.balance) - toCents(entry.amount))

  if (balance < 0) {
    throw AppError.badRequest('Insufficient funds')
  }

  account.balance = balance
  await manager.save(account)

  return manager.save(
    manager.create(Transaction, {
      accountId: account.id,
      userId: account.userId,
      direction: 'debit',
      amount: entry.amount,
      balanceAfter: balance,
      category: entry.category,
      description: entry.description,
      reference: entry.reference ?? null,
      transferId: entry.transferId ?? null,
      cardId: entry.cardId ?? null,
    }),
  )
}

/** Admin-only funding, e.g. a branch deposit recorded by staff. */
export async function deposit(accountId: string, input: DepositInput) {
  return AppDataSource.transaction(async (manager) => {
    const account = await manager.findOne(Account, {
      where: { id: accountId },
      lock: { mode: 'pessimistic_write' },
    })

    if (!account) throw AppError.notFound('Account not found')
    if (account.status !== 'active') {
      throw AppError.badRequest(`Account is ${account.status}`)
    }

    await applyCredit(manager, account, {
      amount: input.amount,
      category: 'deposit',
      description: input.description ?? 'Deposit',
    })

    return manager.findOneOrFail(Account, { where: { id: accountId } })
  })
}
