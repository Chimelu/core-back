import { ILike, In } from 'typeorm'
import { AppDataSource } from '../../config/data-source'
import { Account } from '../../entities/Account'
import { Card } from '../../entities/Card'
import { Transaction } from '../../entities/Transaction'
import { Transfer } from '../../entities/Transfer'
import { User } from '../../entities/User'
import { AppError } from '../../utils/AppError'
import { generateAccountNumber } from '../../utils/generators'
import { fromCents, toCents } from '../../utils/money'
import type {
  AdminCreateAccountInput,
  AdminCreateTransactionInput,
  AdminListAccountsQuery,
  AdminListTransactionsQuery,
  AdminTopUpInput,
  AdminUpdateAccountInput,
  AdminUpdateTransactionInput,
  ListUsersQuery,
  UpdateUserInput,
} from './admin.schema'

const userRepository = () => AppDataSource.getRepository(User)
const accountRepository = () => AppDataSource.getRepository(Account)
const transactionRepository = () => AppDataSource.getRepository(Transaction)

export type AdminUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  role: User['role']
  status: User['status']
  emailVerified: boolean
  accountCount: number
  totalBalance: number
  primaryAccountId: string | null
  createdAt: Date
}

type AccountSummary = { count: number; total: number; primaryAccountId: string | null }

function toAdminUser(user: User, summary: AccountSummary | undefined): AdminUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    accountCount: summary?.count ?? 0,
    totalBalance: summary?.total ?? 0,
    primaryAccountId: summary?.primaryAccountId ?? null,
    createdAt: user.createdAt,
  }
}

/**
 * Account count, total balance, and the primary (wallet) account id per user.
 * Accounts are ordered primary-first so the first one seen is the wallet.
 */
async function accountSummaryByUser(userIds: string[]) {
  const map = new Map<string, AccountSummary>()
  if (userIds.length === 0) return map

  const accounts = await accountRepository().find({
    where: { userId: In(userIds) },
    order: { isPrimary: 'DESC', createdAt: 'ASC' },
  })

  for (const account of accounts) {
    const entry = map.get(account.userId) ?? { count: 0, total: 0, primaryAccountId: null }
    entry.count += 1
    entry.total = fromCents(toCents(entry.total) + toCents(account.balance))
    if (entry.primaryAccountId === null) entry.primaryAccountId = account.id
    map.set(account.userId, entry)
  }
  return map
}

export async function listUsers(query: ListUsersQuery) {
  const qb = userRepository().createQueryBuilder('u').orderBy('u.created_at', 'DESC')

  if (query.status) qb.andWhere('u.status = :status', { status: query.status })
  if (query.role) qb.andWhere('u.role = :role', { role: query.role })
  if (query.q) {
    qb.andWhere(
      '(u.first_name ILIKE :q OR u.last_name ILIKE :q OR u.email ILIKE :q)',
      { q: `%${query.q}%` },
    )
  }

  qb.skip((query.page - 1) * query.limit).take(query.limit)

  const [users, total] = await qb.getManyAndCount()
  const summaries = await accountSummaryByUser(users.map((user) => user.id))

  return {
    users: users.map((user) => toAdminUser(user, summaries.get(user.id))),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit) || 1,
    },
  }
}

export async function updateUser(userId: string, changes: UpdateUserInput) {
  const user = await userRepository().findOne({ where: { id: userId } })
  if (!user) throw AppError.notFound('User not found')

  if (changes.role !== undefined) user.role = changes.role
  if (changes.status !== undefined) user.status = changes.status

  await userRepository().save(user)

  const summaries = await accountSummaryByUser([user.id])
  return toAdminUser(user, summaries.get(user.id))
}

/**
 * Removes a customer and everything owned by them.
 *
 * `transfers.source_account_id` is ON DELETE RESTRICT, so the rows have to be
 * cleared in dependency order rather than relying on the cascade from `users`.
 */
export async function deleteUser(actorId: string, userId: string) {
  const user = await userRepository().findOne({ where: { id: userId } })
  if (!user) throw AppError.notFound('User not found')

  if (userId === actorId) {
    throw AppError.badRequest('You cannot delete your own account')
  }

  if (user.role === 'admin') {
    const admins = await userRepository().countBy({ role: 'admin' })
    if (admins <= 1) {
      throw AppError.badRequest('The last remaining administrator cannot be deleted')
    }
  }

  return AppDataSource.transaction(async (manager) => {
    const accounts = await manager.find(Account, { where: { userId }, select: { id: true } })
    const accountIds = accounts.map((account) => account.id)

    // Transfers sent *to* this user by others keep their record but must stop
    // pointing at accounts that are about to disappear.
    if (accountIds.length > 0) {
      await manager.update(
        Transfer,
        { destinationAccountId: In(accountIds) },
        { destinationAccountId: null },
      )
    }

    await manager.delete(Transaction, { userId })
    await manager.delete(Transfer, { userId })
    await manager.delete(Card, { userId })
    await manager.delete(Account, { userId })
    await manager.delete(User, { id: userId })

    return { id: userId }
  })
}

async function reserveAccountNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateAccountNumber()
    const taken = await accountRepository().exists({ where: { accountNumber: candidate } })
    if (!taken) return candidate
  }
  throw new AppError(503, 'ACCOUNT_NUMBER_UNAVAILABLE', 'Could not allocate an account number')
}

export async function createAccount(input: AdminCreateAccountInput) {
  const user = await userRepository().findOne({ where: { id: input.userId } })
  if (!user) throw AppError.notFound('User not found')

  const hasAccount = await accountRepository().exists({ where: { userId: input.userId } })

  return AppDataSource.transaction(async (manager) => {
    const account = manager.create(Account, {
      userId: input.userId,
      accountNumber: await reserveAccountNumber(),
      name: input.name?.trim() || 'Admin Created Account',
      type: input.type,
      currency: input.currency,
      balance: input.balance,
      isPrimary: !hasAccount,
    })
    await manager.save(account)

    // Record the opening balance on the ledger so history reflects the funds.
    if (input.balance > 0) {
      await manager.save(
        manager.create(Transaction, {
          accountId: account.id,
          userId: input.userId,
          direction: 'credit',
          amount: input.balance,
          balanceAfter: input.balance,
          category: 'adjustment',
          description: 'Opening balance (admin)',
        }),
      )
    }

    return account
  })
}

export async function updateAccount(accountId: string, changes: AdminUpdateAccountInput) {
  return AppDataSource.transaction(async (manager) => {
    const account = await manager.findOne(Account, {
      where: { id: accountId },
      lock: { mode: 'pessimistic_write' },
    })
    if (!account) throw AppError.notFound('Account not found')

    if (changes.name !== undefined) account.name = changes.name
    if (changes.type !== undefined) account.type = changes.type
    if (changes.status !== undefined) account.status = changes.status

    // A direct balance edit is booked as an adjustment so the ledger stays honest.
    if (changes.balance !== undefined && toCents(changes.balance) !== toCents(account.balance)) {
      const delta = toCents(changes.balance) - toCents(account.balance)
      account.balance = changes.balance
      await manager.save(account)

      await manager.save(
        manager.create(Transaction, {
          accountId: account.id,
          userId: account.userId,
          direction: delta >= 0 ? 'credit' : 'debit',
          amount: fromCents(Math.abs(delta)),
          balanceAfter: changes.balance,
          category: 'adjustment',
          description: 'Balance adjustment (admin)',
        }),
      )
      return account
    }

    return manager.save(account)
  })
}

export async function listTransactions(query: AdminListTransactionsQuery) {
  const base: Record<string, unknown> = {}
  if (query.userId) base.userId = query.userId
  if (query.accountId) base.accountId = query.accountId

  // A search matches the note, category, or the account number of the linked
  // account. Each OR branch keeps the base userId/accountId filters.
  const where = query.q
    ? [
        { ...base, description: ILike(`%${query.q}%`) },
        { ...base, category: ILike(`%${query.q}%`) },
        { ...base, account: { accountNumber: ILike(`%${query.q}%`) } },
      ]
    : base

  const [transactions, total] = await transactionRepository().findAndCount({
    where,
    relations: { account: true, user: true },
    order: { createdAt: 'DESC' },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  })

  return {
    transactions: transactions.map((tx) => ({
      id: tx.id,
      accountId: tx.accountId,
      accountNumber: tx.account?.accountNumber ?? null,
      accountName: tx.account?.name ?? null,
      userId: tx.userId,
      userName: tx.user ? `${tx.user.firstName} ${tx.user.lastName}`.trim() : null,
      direction: tx.direction,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      category: tx.category,
      description: tx.description,
      reference: tx.reference,
      createdAt: tx.createdAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit) || 1,
    },
  }
}

export async function updateTransaction(
  transactionId: string,
  changes: AdminUpdateTransactionInput,
) {
  return AppDataSource.transaction(async (manager) => {
    const tx = await manager.findOne(Transaction, { where: { id: transactionId } })
    if (!tx) throw AppError.notFound('Transaction not found')

    const account = await manager.findOne(Account, {
      where: { id: tx.accountId },
      lock: { mode: 'pessimistic_write' },
    })
    if (!account) throw AppError.notFound('Account not found')

    // Net monetary effect of the row before edits (positive = money in).
    const oldEffect = tx.direction === 'credit' ? toCents(tx.amount) : -toCents(tx.amount)

    if (changes.description !== undefined) tx.description = changes.description
    if (changes.category !== undefined) tx.category = changes.category
    if (changes.amount !== undefined) tx.amount = changes.amount
    if (changes.direction !== undefined) tx.direction = changes.direction

    const newEffect = tx.direction === 'credit' ? toCents(tx.amount) : -toCents(tx.amount)
    const delta = newEffect - oldEffect

    // Keep the live account balance consistent with the edited amount/direction.
    if (delta !== 0) {
      account.balance = fromCents(toCents(account.balance) + delta)
      await manager.save(account)
    }

    await manager.save(tx)

    // created_at is a CreateDateColumn, so TypeORM ignores it on save — a custom
    // posting date has to be written with a follow-up update.
    if (changes.date) {
      await manager.update(Transaction, { id: tx.id }, { createdAt: changes.date })
      tx.createdAt = changes.date
    }

    return {
      id: tx.id,
      accountId: tx.accountId,
      userId: tx.userId,
      direction: tx.direction,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      category: tx.category,
      description: tx.description,
      reference: tx.reference,
      createdAt: tx.createdAt,
    }
  })
}

/** Credits (tops up) an account and books a matching ledger entry. */
export async function topUpAccount(accountId: string, input: AdminTopUpInput) {
  return AppDataSource.transaction(async (manager) => {
    const account = await manager.findOne(Account, {
      where: { id: accountId },
      lock: { mode: 'pessimistic_write' },
    })
    if (!account) throw AppError.notFound('Account not found')

    const balance = fromCents(toCents(account.balance) + toCents(input.amount))
    account.balance = balance
    await manager.save(account)

    await manager.save(
      manager.create(Transaction, {
        accountId: account.id,
        userId: account.userId,
        direction: 'credit',
        amount: input.amount,
        balanceAfter: balance,
        category: 'top-up',
        description: input.description ?? 'Wallet top-up (admin)',
      }),
    )

    return account
  })
}

/** Deletes a ledger entry and reverses its effect on the live account balance. */
export async function deleteTransaction(transactionId: string) {
  return AppDataSource.transaction(async (manager) => {
    const tx = await manager.findOne(Transaction, { where: { id: transactionId } })
    if (!tx) throw AppError.notFound('Transaction not found')

    const account = await manager.findOne(Account, {
      where: { id: tx.accountId },
      lock: { mode: 'pessimistic_write' },
    })

    if (account) {
      // Removing a credit reduces the balance; removing a debit restores it.
      const effect = tx.direction === 'credit' ? -toCents(tx.amount) : toCents(tx.amount)
      account.balance = fromCents(toCents(account.balance) + effect)
      await manager.save(account)
    }

    await manager.remove(tx)
    return { id: transactionId }
  })
}

/** Lists accounts, optionally scoped to one user, for admin selection. */
export async function listAccounts(query: AdminListAccountsQuery) {
  const accounts = await accountRepository().find({
    where: query.userId ? { userId: query.userId } : {},
    order: { isPrimary: 'DESC', createdAt: 'ASC' },
  })

  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      userId: account.userId,
      accountNumber: account.accountNumber,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.balance,
      status: account.status,
      isPrimary: account.isPrimary,
    })),
  }
}

/**
 * Creates a transaction on any account, applies its effect to the balance, and
 * honours an optional custom posting date.
 */
export async function createTransaction(input: AdminCreateTransactionInput) {
  return AppDataSource.transaction(async (manager) => {
    const account = await manager.findOne(Account, {
      where: { id: input.accountId },
      lock: { mode: 'pessimistic_write' },
    })
    if (!account) throw AppError.notFound('Account not found')

    const signed = input.direction === 'credit' ? toCents(input.amount) : -toCents(input.amount)
    const newBalanceCents = toCents(account.balance) + signed
    if (newBalanceCents < 0) {
      throw AppError.badRequest('This debit exceeds the account balance')
    }

    const balance = fromCents(newBalanceCents)
    account.balance = balance
    await manager.save(account)

    const tx = manager.create(Transaction, {
      accountId: account.id,
      userId: account.userId,
      direction: input.direction,
      amount: input.amount,
      balanceAfter: balance,
      category: input.category,
      description: input.description,
    })
    await manager.save(tx)

    // created_at is a CreateDateColumn (set on insert), so a custom posting date
    // has to be written with a follow-up update.
    if (input.date) {
      await manager.update(Transaction, { id: tx.id }, { createdAt: input.date })
      tx.createdAt = input.date
    }

    return {
      id: tx.id,
      accountId: tx.accountId,
      userId: tx.userId,
      direction: tx.direction,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      category: tx.category,
      description: tx.description,
      reference: tx.reference,
      createdAt: tx.createdAt,
    }
  })
}
