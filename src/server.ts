import 'reflect-metadata'
import { createApp } from './app'
import { AppDataSource } from './config/data-source'
import { env } from './config/env'

const CONNECT_ATTEMPTS = 5
const RETRY_DELAY_MS = 3_000

/**
 * A suspended serverless database can time out while its compute wakes up, so a
 * cold start should not be treated as a fatal error.
 */
async function connectWithRetry() {
  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
    try {
      await AppDataSource.initialize()
      return
    } catch (error) {
      if (attempt === CONNECT_ATTEMPTS) throw error

      const reason = error instanceof Error ? error.message : String(error)
      console.warn(
        `[db] connection attempt ${attempt}/${CONNECT_ATTEMPTS} failed (${reason}), retrying in ${
          RETRY_DELAY_MS / 1000
        }s`,
      )
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
}

async function bootstrap() {
  await connectWithRetry()
  console.log(`[db] connected to ${env.databaseLabel}`)

  const server = createApp().listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`)
  })

  const shutdown = async (signal: string) => {
    console.log(`\n[api] ${signal} received, shutting down`)
    server.close(async () => {
      await AppDataSource.destroy()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

bootstrap().catch((error) => {
  console.error('[api] failed to start', error)
  process.exit(1)
})
