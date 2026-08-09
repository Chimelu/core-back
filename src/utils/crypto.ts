import crypto from 'node:crypto'
import { env } from '../config/env'

const ALGORITHM = 'aes-256-gcm'

function key() {
  return Buffer.from(env.CARD_ENCRYPTION_KEY, 'hex')
}

/** Returns `iv.authTag.ciphertext`, all base64url encoded. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv, authTag, ciphertext].map((part) => part.toString('base64url')).join('.')
}

export function decrypt(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split('.')

  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Malformed encrypted payload')
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivPart, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
