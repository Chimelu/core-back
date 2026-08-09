import 'reflect-metadata'
import { AppDataSource } from '../config/data-source'
import { Account } from '../entities/Account'
import { User } from '../entities/User'
import { generateAccountNumber } from '../utils/generators'
import { hashPassword } from '../utils/password'

/**
 * Ensures the super-admin account exists. Safe to run repeatedly — it upgrades
 * an existing user to admin/active or creates the account from scratch.
 *
 * Run with: npm run seed:admin
 */
const SUPER_ADMIN = {
  email: 'admin@coretrust.com',
  password: 'Iambank@1',
  firstName: 'Super',
  lastName: 'Admin',
}

async function seedAdmin() {
  await AppDataSource.initialize()

  const users = AppDataSource.getRepository(User)
  const accounts = AppDataSource.getRepository(Account)

  let user = await users.findOne({ where: { email: SUPER_ADMIN.email } })

  if (user) {
    user.role = 'admin'
    user.status = 'active'
    user.emailVerified = true
    user.passwordHash = await hashPassword(SUPER_ADMIN.password)
    await users.save(user)
    console.log(`[seed] updated existing super admin: ${user.email}`)
  } else {
    user = users.create({
      firstName: SUPER_ADMIN.firstName,
      lastName: SUPER_ADMIN.lastName,
      email: SUPER_ADMIN.email,
      passwordHash: await hashPassword(SUPER_ADMIN.password),
      role: 'admin',
      status: 'active',
      emailVerified: true,
    })
    await users.save(user)
    console.log(`[seed] created super admin: ${user.email}`)
  }

  const hasAccount = await accounts.exists({ where: { userId: user.id } })
  if (!hasAccount) {
    const account = accounts.create({
      userId: user.id,
      accountNumber: generateAccountNumber(),
      name: 'Admin Operations',
      type: 'checking',
      currency: 'USD',
      balance: 0,
      isPrimary: true,
    })
    await accounts.save(account)
    console.log(`[seed] created admin operations account ${account.accountNumber}`)
  }

  console.log('[seed] done. Login with:')
  console.log(`       email:    ${SUPER_ADMIN.email}`)
  console.log(`       password: ${SUPER_ADMIN.password}`)

  await AppDataSource.destroy()
}

seedAdmin().catch(async (error) => {
  console.error('[seed] failed:', error)
  if (AppDataSource.isInitialized) await AppDataSource.destroy()
  process.exit(1)
})
