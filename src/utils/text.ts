/**
 * Small text helpers shared by the validator messages and the UI.
 * Kept separate so that R-76 wording stays readable ("e₂", "Max₁", "n₃").
 */

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']

/** 1 -> "₁", 12 -> "₁₂" */
export function subscript(value: number): string {
  return String(Math.trunc(Math.abs(value)))
    .split('')
    .map((digit) => SUBSCRIPT_DIGITS[Number(digit)] ?? digit)
    .join('')
}

/** 1 -> "1st", 2 -> "2nd", ... used for range numbering in messages. */
export function ordinal(value: number): string {
  const remainder10 = value % 10
  const remainder100 = value % 100
  if (remainder10 === 1 && remainder100 !== 11) return `${value}st`
  if (remainder10 === 2 && remainder100 !== 12) return `${value}nd`
  if (remainder10 === 3 && remainder100 !== 13) return `${value}rd`
  return `${value}th`
}

/**
 * Formats a dimensionless count the way R-76 does, e.g. 10000 -> "10,000".
 * Fractional results (a quotient such as Maxᵢ / eᵢ₊₁ that is not an integer) keep at most two
 * decimals: more precision than that is noise next to a limit like "≥ 500".
 */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** Formats a ratio such as `Max_1 / e_2`, keeping a fractional result readable. */
export function formatRatio(value: number | null): string {
  return value === null ? 'undefined' : formatCount(value)
}

/** Joins non-empty strings with a separator, skipping nullish/empty parts. */
export function joinNonEmpty(parts: Array<string | null | undefined>, separator = ' '): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(separator)
}
