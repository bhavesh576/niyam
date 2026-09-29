import type { Grams } from '../domain/models/instrument'
import { approximatelyEqual } from './numeric'

/**
 * Mass handling: the single place where user-facing units (g, kg) meet the internal unit (g).
 *
 * The domain layer only ever sees grams. All conversions, decimal parsing, formatting and
 * exact-divisibility checks live here so that kg/g arithmetic cannot leak into the R-76 logic.
 */

export const GRAMS_PER_KILOGRAM = 1000

/** Units offered on the configuration form. Internally everything is grams. */
export type MassUnit = 'g' | 'kg'

export const MASS_UNITS: readonly MassUnit[] = ['g', 'kg']

/**
 * Internal resolution used for exact arithmetic: micrograms.
 * Values are stored as grams (float) but every divisibility / ratio test is done on integer
 * micrograms, which makes `Max / e` and `Min / d` exact instead of floating-point approximate.
 * Safe for any realistic NAWI capacity (integer-exact up to ~9 000 t).
 */
export const MICROGRAMS_PER_GRAM = 1_000_000

export function unitFactor(unit: MassUnit): number {
  return unit === 'kg' ? GRAMS_PER_KILOGRAM : 1
}

/** Converts a value entered in `unit` to grams. */
export function toGrams(value: number, unit: MassUnit): Grams {
  return value * unitFactor(unit)
}

/** Converts grams to `unit`. */
export function fromGrams(grams: Grams, unit: MassUnit): number {
  return grams / unitFactor(unit)
}

/** Grams -> integer micrograms (rounded to the internal resolution). */
export function toMicrograms(grams: Grams): number {
  return Math.round(grams * MICROGRAMS_PER_GRAM)
}

/** True when `grams` can be represented exactly at the internal microgram resolution. */
export function hasMicrogramResolution(grams: Grams): boolean {
  const micro = toMicrograms(grams)
  return Number.isSafeInteger(micro) && approximatelyEqual(micro / MICROGRAMS_PER_GRAM, grams)
}

/** A plain decimal number, e.g. `1500`, `1.5`, `.5`, `-2`. */
const PLAIN_DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

/** A decimal number using unambiguous thousands grouping, e.g. `1,500` or `12,345,678`. */
const THOUSANDS_GROUPED = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/

/**
 * Parses a decimal string typed by the user.
 *
 * Accepts `1500`, `1.5`, `0.1`, `1 500` (spaces as thousands separators, the OIML convention) and
 * `1,500` (strictly grouped thousands). Returns `null` when the text is empty or is not a plain
 * decimal number — the validator reports that as a distinct problem from "number entered but
 * outside the R-76 limits".
 *
 * A comma is NEVER interpreted as a decimal separator: `1,5` and `1,50` are rejected instead of
 * being guessed. In a mass entry, reading a decimal comma as a thousands separator (or the reverse)
 * would silently change the value by a factor of 100 to 1000, which is worse than asking the user
 * to retype it.
 */
export function parseDecimalString(raw: string): number | null {
  const compact = raw.trim().replace(/[\s\u00a0\u2009\u202f]/g, '')
  if (compact.length === 0) return null

  let normalized = compact
  if (compact.includes(',')) {
    if (!THOUSANDS_GROUPED.test(compact)) return null
    normalized = compact.replace(/,/g, '')
  }

  if (!PLAIN_DECIMAL.test(normalized)) return null

  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** Parses a mass entered in `unit` and returns grams, or `null` when unparsable. */
export function parseMassToGrams(raw: string, unit: MassUnit): Grams | null {
  const value = parseDecimalString(raw)
  if (value === null) return null
  return toGrams(value, unit)
}

/**
 * Mantissa of a scale interval written as `mantissa x 10^k` grams.
 * Returns the mantissa with all trailing decimal zeros removed, or `null` when the value
 * cannot be represented at the internal resolution.
 */
export function scaleIntervalMantissa(grams: Grams): number | null {
  if (!Number.isFinite(grams) || grams <= 0) return null
  if (!hasMicrogramResolution(grams)) return null

  let mantissa = toMicrograms(grams)
  if (!Number.isSafeInteger(mantissa) || mantissa <= 0) return null
  while (mantissa % 10 === 0) mantissa /= 10
  return mantissa
}

/**
 * `true` when the value has the form 1 x 10^k, 2 x 10^k or 5 x 10^k —
 * the only permitted form for a scale interval of weighing results
 * (OIML R 76-1:2006, §4.2.2.1).
 */
export function isLegalScaleIntervalForm(grams: Grams): boolean {
  const mantissa = scaleIntervalMantissa(grams)
  return mantissa === 1 || mantissa === 2 || mantissa === 5
}

/**
 * The permitted scale-interval values (1, 2, 5 x 10^k grams) spanning any realistic NAWI,
 * from 1 ng to 100 t. Used to suggest corrections when an entered value has the wrong form.
 */
export function legalScaleIntervalForms(minExponent = -9, maxExponent = 12): Grams[] {
  const forms: Grams[] = []
  for (let k = minExponent; k <= maxExponent; k += 1) {
    for (const mantissa of [1, 2, 5]) {
      forms.push(mantissa * Math.pow(10, k))
    }
  }
  return forms.sort((a, b) => a - b)
}

/** Nearest permitted scale-interval values below and above `grams` (for "did you mean" hints). */
export function neighbouringScaleIntervalForms(grams: Grams): { below: Grams | null; above: Grams | null } {
  const forms = legalScaleIntervalForms()
  let below: Grams | null = null
  let above: Grams | null = null
  for (const form of forms) {
    if (form < grams) below = form
    else if (form > grams && above === null) above = form
  }
  return { below, above }
}

/**
 * Exact quotient of two masses, or `null` when the quotient is not an integer.
 * Used for `n = Max / e` integrality checks and `Min / d`.
 */
export function exactIntegerQuotient(numeratorGrams: Grams, denominatorGrams: Grams): number | null {
  const numerator = toMicrograms(numeratorGrams)
  const denominator = toMicrograms(denominatorGrams)
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) return null
  if (denominator === 0) return null

  const quotient = numerator / denominator
  return Number.isSafeInteger(quotient) ? quotient : null
}

/** `true` when `a` is an exact integer multiple of `b`. */
export function isExactMultipleOf(a: Grams, b: Grams): boolean {
  return exactIntegerQuotient(a, b) !== null
}

/**
 * Exact mass addition at the internal microgram resolution.
 *
 * Used wherever a probe load is placed a verification scale interval away from a boundary:
 * `5 000 g + 10 g` must be `5 010 g` and `0.3 g + 0.1 g` must not become `0.4000000000000001 g`.
 */
export function addGrams(a: Grams, b: Grams): Grams {
  return (toMicrograms(a) + toMicrograms(b)) / MICROGRAMS_PER_GRAM
}

/** Exact mass subtraction at the internal microgram resolution. See {@link addGrams}. */
export function subtractGrams(a: Grams, b: Grams): Grams {
  return (toMicrograms(a) - toMicrograms(b)) / MICROGRAMS_PER_GRAM
}

/** Exact product of a mass and an integer/dimensionless factor (e.g. `500 x e`). */
export function scaleGrams(grams: Grams, factor: number): Grams | null {
  if (!Number.isFinite(factor)) return null
  const micro = toMicrograms(grams)
  if (!Number.isSafeInteger(micro)) return null
  const product = Math.round(micro * factor)
  if (!Number.isSafeInteger(product)) return null
  return product / MICROGRAMS_PER_GRAM
}

/** Plain ratio (may be fractional). Guarded against division by zero. */
export function ratio(numeratorGrams: Grams, denominatorGrams: Grams): number | null {
  if (!Number.isFinite(denominatorGrams) || denominatorGrams === 0) return null
  return numeratorGrams / denominatorGrams
}

/** Picks the display unit for a mass: kilograms from 1 kg upwards, grams below. */
export function autoUnitFor(grams: Grams): MassUnit {
  return Math.abs(grams) >= GRAMS_PER_KILOGRAM ? 'kg' : 'g'
}

/** Formats a number without trailing decimal zeros. */
export function trimNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (value !== 0 && Math.abs(value) < 1e-9) return value.toExponential(2)
  return String(Number(value.toFixed(9)))
}

/** Formats a mass with an explicit or automatically chosen unit, e.g. `2 kg`, `0.5 g`. */
export function formatMass(grams: Grams, unit: MassUnit = autoUnitFor(grams)): string {
  return `${trimNumber(fromGrams(grams, unit))} ${unit}`
}

/** Formats a mass entered in a specific unit without the unit suffix. */
export function formatValueInUnit(grams: Grams, unit: MassUnit): string {
  return trimNumber(fromGrams(grams, unit))
}
