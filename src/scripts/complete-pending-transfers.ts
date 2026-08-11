import 'reflect-metadata'
import { AppDataSource } from '../config/data-source'
import { Transfer } from '../entities/Transfer'

/**
 * Backfill for transfers created before external transfers settled instantly.
 * Marks every pending transfer completed and stamps `completed_at` with the
 * time it was created, since the funds already left the source account.
 *
 * Safe to run repeatedly — a second run finds nothing pending.
 *
 * Run with: npm run backfill:transfers
 */
async function completePendingTransfers() {
  await AppDataSource.initialize()

  const transfers = AppDataSource.getRepository(Transfer)
  const pending = await transfers.count({ where: { status: 'pending' } })

  if (pending === 0) {
    console.log('[backfill] no pending transfers — nothing to do')
    await AppDataSource.destroy()
    return
  }

  console.log(`[backfill] updating ${pending} pending transfer(s)…`)

  const result = await transfers
    .createQueryBuilder()
    .update(Transfer)
    .set({
      status: 'completed',
      completedAt: () => 'COALESCE("completed_at", "created_at")',
    })
    .where('status = :status', { status: 'pending' })
    .execute()

  console.log(`[backfill] done — ${result.affected ?? 0} transfer(s) marked completed`)

  await AppDataSource.destroy()
}

completePendingTransfers().catch(async (error) => {
  console.error('[backfill] failed:', error)
  if (AppDataSource.isInitialized) await AppDataSource.destroy()
  process.exit(1)
})
