import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { numericTransformer } from '../utils/money'
import { Account } from './Account'
import { Card } from './Card'
import { User } from './User'

export type TransactionDirection = 'credit' | 'debit'

/** Immutable ledger entry. One row per movement of money on a single account. */
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index('idx_transactions_account')
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: Account

  @Index('idx_transactions_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({ type: 'varchar', length: 10 })
  direction: TransactionDirection

  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: numericTransformer })
  amount: number

  @Column({
    name: 'balance_after',
    type: 'numeric',
    precision: 18,
    scale: 2,
    transformer: numericTransformer,
  })
  balanceAfter: number

  @Column({ type: 'varchar', length: 40, default: 'transfer' })
  category: string

  @Column({ type: 'varchar', length: 180 })
  description: string

  @Column({ type: 'varchar', length: 40, nullable: true })
  reference: string | null

  @Column({ name: 'transfer_id', type: 'uuid', nullable: true })
  transferId: string | null

  @Column({ name: 'card_id', type: 'uuid', nullable: true })
  cardId: string | null

  @ManyToOne(() => Card, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'card_id' })
  card: Card | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
