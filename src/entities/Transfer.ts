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
import { User } from './User'

export type TransferKind = 'coretrust' | 'local' | 'international'
export type TransferStatus = 'pending' | 'completed' | 'failed'

@Entity('transfers')
export class Transfer {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index('idx_transfers_reference', { unique: true })
  @Column({ type: 'varchar', length: 40 })
  reference: string

  @Index('idx_transfers_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({ name: 'source_account_id', type: 'uuid' })
  sourceAccountId: string

  @ManyToOne(() => Account, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_account_id' })
  sourceAccount: Account

  /** Only set for CoreTrust-to-CoreTrust transfers. */
  @Column({ name: 'destination_account_id', type: 'uuid', nullable: true })
  destinationAccountId: string | null

  @Column({ type: 'varchar', length: 20 })
  kind: TransferKind

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: TransferStatus

  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: numericTransformer })
  amount: number

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  fee: number

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string

  @Column({ name: 'recipient_name', type: 'varchar', length: 120 })
  recipientName: string

  @Column({ name: 'recipient_account_number', type: 'varchar', length: 40 })
  recipientAccountNumber: string

  @Column({ name: 'recipient_bank_name', type: 'varchar', length: 120, nullable: true })
  recipientBankName: string | null

  @Column({ name: 'swift_code', type: 'varchar', length: 20, nullable: true })
  swiftCode: string | null

  /** International only: where the receiving bank is located. */
  @Column({ name: 'bank_country', type: 'varchar', length: 90, nullable: true })
  bankCountry: string | null

  @Column({ name: 'bank_address', type: 'varchar', length: 255, nullable: true })
  bankAddress: string | null

  @Column({ name: 'recipient_address', type: 'varchar', length: 255, nullable: true })
  recipientAddress: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null

  @Column({ name: 'failure_reason', type: 'varchar', length: 255, nullable: true })
  failureReason: string | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
