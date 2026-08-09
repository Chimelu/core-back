import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { numericTransformer } from '../utils/money'
import { Account } from './Account'
import { User } from './User'

export type CardBrand = 'VISA' | 'Mastercard'
export type CardType = 'virtual' | 'physical'
export type CardStatus = 'active' | 'frozen' | 'cancelled'

@Entity('cards')
export class Card {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 60 })
  label: string

  @Column({ type: 'varchar', length: 20, default: 'VISA' })
  brand: CardBrand

  @Column({ type: 'varchar', length: 20 })
  type: CardType

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: CardStatus

  /** AES-256-GCM ciphertext — the PAN is never stored or logged in the clear. */
  @Column({ name: 'number_encrypted', type: 'text' })
  numberEncrypted: string

  @Column({ name: 'cvv_encrypted', type: 'text' })
  cvvEncrypted: string

  @Column({ type: 'varchar', length: 4 })
  last4: string

  @Column({ name: 'expiry_month', type: 'smallint' })
  expiryMonth: number

  @Column({ name: 'expiry_year', type: 'smallint' })
  expiryYear: number

  @Column({ name: 'holder_name', type: 'varchar', length: 120 })
  holderName: string

  @Column({
    name: 'spending_limit',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  spendingLimit: number

  @Column({ name: 'online_payments_enabled', type: 'boolean', default: true })
  onlinePaymentsEnabled: boolean

  @Column({ name: 'international_enabled', type: 'boolean', default: false })
  internationalEnabled: boolean

  @Index('idx_cards_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: Account

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
