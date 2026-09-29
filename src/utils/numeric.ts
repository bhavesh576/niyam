/**
 * Exact-comparison helpers.
 *
 * Mass values arrive from decimal user input, so binary floating point can turn a value that
 * is "10 000" on paper into 9 999.999999999998. Every limit comparison in the validator goes
 * through these helpers instead of using `<`, `<=`, `>` or `>=` directly.
 *
 * The tolerance is relative (1e-9), scaled so that it also behaves sensibly for values below 1 g.
 */

const RELATIVE_TOLERANCE = 1e-9

function toleranceFor(a: number, b: number): number {
  return RELATIVE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b), 1)
}

export function approximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= toleranceFor(a, b)
}

export function approximatelyNotEqual(a: number, b: number): boolean {
  return !approximatelyEqual(a, b)
}

/** a >= b, tolerant. */
export function approximatelyGreaterOrEqual(a: number, b: number): boolean {
  return a > b || approximatelyEqual(a, b)
}

/** a <= b, tolerant. */
export function approximatelyLessOrEqual(a: number, b: number): boolean {
  return a < b || approximatelyEqual(a, b)
}

/** a > b, tolerant (i.e. not a <= b). */
export function approximatelyGreaterThan(a: number, b: number): boolean {
  return !approximatelyLessOrEqual(a, b)
}

/** a < b, tolerant (i.e. not a >= b). */
export function approximatelyLessThan(a: number, b: number): boolean {
  return !approximatelyGreaterOrEqual(a, b)
}

/**
 * True when `value` is inside [lowerBound, upperBound] using tolerant comparisons.
 * An `upperBound` of `null` means "no upper limit" (the "–" entries of R-76 Table 3).
 */
export function withinInclusiveRange(
  value: number,
  lowerBound: number,
  upperBound: number | null,
): boolean {
  if (!approximatelyGreaterOrEqual(value, lowerBound)) return false
  if (upperBound === null) return true
  return approximatelyLessOrEqual(value, upperBound)
}
