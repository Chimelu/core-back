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
import { User } from './User'

export type AccountType = 'checking' | 'savings' | 'business'
export type AccountStatus = 'active' | 'frozen' | 'closed'

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index('idx_accounts_number', { unique: true })
  @Column({ name: 'account_number', type: 'varchar', length: 10 })
  accountNumber: string

  @Column({ type: 'varchar', length: 60 })
  name: string

  @Column({ type: 'varchar', length: 20 })
  type: AccountType

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  balance: number

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: AccountStatus

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean

  @Index('idx_accounts_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
