/**
 * Postgres numeric columns come back as strings to preserve precision, so every
 * money column runs through this transformer to surface a plain number in JS.
 */
export const numericTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
}

/** Arithmetic is done in minor units so repeated float addition cannot drift. */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2))
}
