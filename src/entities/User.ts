import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { RefreshToken } from './RefreshToken'

export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'suspended' | 'closed'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'first_name', type: 'varchar', length: 60 })
  firstName: string

  @Column({ name: 'last_name', type: 'varchar', length: 60 })
  lastName: string

  @Index('idx_users_email', { unique: true })
  @Column({ type: 'varchar', length: 180 })
  email: string

  @Column({ type: 'varchar', length: 25, nullable: true })
  phone: string | null

  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string

  @Column({ type: 'varchar', length: 180, nullable: true })
  address: string | null

  @Column({ type: 'varchar', length: 90, nullable: true })
  city: string | null

  @Column({ type: 'varchar', length: 90, nullable: true })
  country: string | null

  @Column({ type: 'varchar', length: 20, default: 'user' })
  role: UserRole

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: UserStatus

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[]

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim()
  }
}
