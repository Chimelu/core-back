import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { env } from './env'
import { Account } from '../entities/Account'
import { Card } from '../entities/Card'
import { RefreshToken } from '../entities/RefreshToken'
import { Transaction } from '../entities/Transaction'
import { Transfer } from '../entities/Transfer'
import { User } from '../entities/User'

const connection = env.DATABASE_URL
  ? { url: env.DATABASE_URL }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    }

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...connection,
  ssl: env.useSsl ? { rejectUnauthorized: false } : false,
  // Serverless Postgres suspends idle compute, so the first connect can take
  // tens of seconds while it wakes up.
  connectTimeoutMS: 30_000,
  synchronize: env.DB_SYNCHRONIZE,
  logging: env.DB_LOGGING,
  entities: [User, RefreshToken, Account, Card, Transfer, Transaction],
  migrations: [`${__dirname}/../migrations/*.{ts,js}`],
})
