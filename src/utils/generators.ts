import crypto from 'node:crypto'

function randomDigits(length: number): string {
  let digits = ''
  while (digits.length < length) {
    digits += crypto.randomInt(0, 10).toString()
  }
  return digits
}

export function generateAccountNumber(): string {
  // Leading digit is never 0 so the number always renders as 10 characters.
  return `${crypto.randomInt(1, 10)}${randomDigits(9)}`
}

/** Builds a 16 digit number with a valid Luhn check digit. */
export function generateCardNumber(prefix: string): string {
  const base = prefix + randomDigits(15 - prefix.length)
  return base + luhnCheckDigit(base)
}

function luhnCheckDigit(base: string): string {
  let sum = 0
  let double = true

  for (let i = base.length - 1; i >= 0; i -= 1) {
    let digit = Number(base[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return String((10 - (sum % 10)) % 10)
}

export function generateCvv(): string {
  return randomDigits(3)
}

export function generateReference(prefix = 'TRF'): string {
  const stamp = Date.now().toString(36).toUpperCase()
  return `${prefix}-${stamp}-${randomDigits(4)}`
}
