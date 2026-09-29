import { describe, expect, it } from 'vitest'
import {
  GRAMS_PER_KILOGRAM,
  autoUnitFor,
  exactIntegerQuotient,
  formatMass,
  formatValueInUnit,
  fromGrams,
  hasMicrogramResolution,
  isExactMultipleOf,
  isLegalScaleIntervalForm,
  legalScaleIntervalForms,
  neighbouringScaleIntervalForms,
  parseDecimalString,
  parseMassToGrams,
  ratio,
  scaleIntervalMantissa,
  toGrams,
  toMicrograms,
  unitFactor,
} from './mass'

/**
 * Tests for the single module that owns units and exact mass arithmetic.
 * Everything the R-76 logic compares goes through here, so a mistake in this file would be a
 * mistake in every rule.
 */
describe('unit conversion', () => {
  it('converts between the display units and the internal unit (grams)', () => {
    expect(unitFactor('g')).toBe(1)
    expect(unitFactor('kg')).toBe(GRAMS_PER_KILOGRAM)
    expect(toGrams(2, 'kg')).toBe(2_000)
    expect(toGrams(500, 'g')).toBe(500)
    expect(fromGrams(15_000, 'kg')).toBe(15)
    expect(fromGrams(0.5, 'g')).toBe(0.5)
    expect(fromGrams(toGrams(2.5, 'kg'), 'g')).toBe(2_500)
  })

  it('formats a mass with an automatically chosen unit', () => {
    expect(autoUnitFor(2_000)).toBe('kg')
    expect(autoUnitFor(500)).toBe('g')
    expect(formatMass(2_000)).toBe('2 kg')
    expect(formatMass(15_000)).toBe('15 kg')
    expect(formatMass(2_500)).toBe('2.5 kg')
    expect(formatMass(500)).toBe('500 g')
    expect(formatMass(1)).toBe('1 g')
    expect(formatMass(0.5)).toBe('0.5 g')
    expect(formatMass(0.05)).toBe('0.05 g')
    expect(formatMass(20)).toBe('20 g')
    expect(formatMass(2_500, 'g')).toBe('2500 g')
    expect(formatValueInUnit(2_500, 'kg')).toBe('2.5')
  })

  it('parses decimal input in the conventions used on weighing instruments', () => {
    expect(parseDecimalString('1500')).toBe(1_500)
    expect(parseDecimalString('1.5')).toBe(1.5)
    expect(parseDecimalString('  2 000 ')).toBe(2_000)
    expect(parseDecimalString('1,500')).toBe(1_500) // strictly grouped thousands
    expect(parseDecimalString('12,345,678')).toBe(12_345_678)
    // A comma is never read as a decimal separator: ambiguous input is rejected, not guessed.
    expect(parseDecimalString('1,5')).toBeNull()
    expect(parseDecimalString('1,50')).toBeNull()
    expect(parseDecimalString('1,2345')).toBeNull()
    expect(parseDecimalString('.5')).toBe(0.5)
    expect(parseDecimalString('-5')).toBe(-5)
    expect(parseDecimalString('')).toBeNull()
    expect(parseDecimalString('   ')).toBeNull()
    expect(parseDecimalString('12.3.4')).toBeNull()
    expect(parseDecimalString('2O g')).toBeNull() // letter O, not zero
    expect(parseDecimalString('1e3')).toBeNull()
    expect(parseDecimalString('abc')).toBeNull()
  })

  it('parses a mass entered in a unit into grams', () => {
    expect(parseMassToGrams('1.5', 'kg')).toBe(1_500)
    expect(parseMassToGrams('15', 'kg')).toBe(15_000)
    expect(parseMassToGrams('500', 'g')).toBe(500)
    expect(parseMassToGrams('0.1', 'g')).toBeCloseTo(0.1, 12)
    expect(parseMassToGrams('', 'g')).toBeNull()
    expect(parseMassToGrams('abc', 'kg')).toBeNull()
  })
})

describe('exact mass arithmetic', () => {
  it('divides on integer micrograms, so IEEE-754 residue cannot change a result', () => {
    // 0.3 / 0.1 is 2.9999999999999996 in binary floating point.
    expect(0.3 / 0.1).not.toBe(3)
    expect(exactIntegerQuotient(0.3, 0.1)).toBe(3)

    // 1.005 kg converts to 1004.9999999999999 g; it is still exactly 1 005 intervals of 1 g.
    expect(1.005 * 1_000).not.toBe(1_005)
    expect(isExactMultipleOf(toGrams(1.005, 'kg'), 1)).toBe(true)
    expect(exactIntegerQuotient(toGrams(1.005, 'kg'), 1)).toBe(1_005)
  })

  it('computes the R-76 quotients of the official example exactly', () => {
    expect(exactIntegerQuotient(2_000, 1)).toBe(2_000) // n₁
    expect(exactIntegerQuotient(5_000, 2)).toBe(2_500) // n₂
    expect(exactIntegerQuotient(15_000, 10)).toBe(1_500) // n₃
    expect(exactIntegerQuotient(2_000, 2)).toBe(1_000) // Max₁ / e₂ (Table 4)
    expect(exactIntegerQuotient(5_000, 10)).toBe(500) // Max₂ / e₃ (Table 4)
    expect(exactIntegerQuotient(20, 1)).toBe(20) // Min / d
  })

  it('returns null for a quotient that is not an integer or not defined', () => {
    expect(exactIntegerQuotient(2_000.5, 1)).toBeNull()
    expect(exactIntegerQuotient(2_000, 3)).toBeNull()
    expect(exactIntegerQuotient(2_000, 0)).toBeNull()
    expect(isExactMultipleOf(5_000, 2)).toBe(true)
    expect(isExactMultipleOf(5_001, 2)).toBe(false)
    expect(ratio(2_000.5, 1)).toBeCloseTo(2_000.5, 9)
    expect(ratio(5, 0)).toBeNull()
  })

  it('works at microgram resolution and reports values below it', () => {
    expect(toMicrograms(1)).toBe(1_000_000)
    expect(toMicrograms(0.001)).toBe(1_000)
    expect(hasMicrogramResolution(1_004.9999999999999)).toBe(true)
    expect(hasMicrogramResolution(1.0000004)).toBe(false)
  })
})

describe('permitted scale interval form (§4.2.2.1)', () => {
  it('accepts 1, 2 and 5 multiplied by a power of ten', () => {
    for (const value of [0.001, 0.01, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 10_000, 100_000]) {
      expect(isLegalScaleIntervalForm(value)).toBe(true)
    }
  })

  it('rejects every other mantissa', () => {
    for (const value of [0.03, 0.07, 0.15, 0.25, 0.3, 0.4, 1.5, 2.5, 3, 4, 6, 7, 8, 9, 12, 15, 25, 30, 120, 2_000.5]) {
      expect(isLegalScaleIntervalForm(value)).toBe(false)
    }
  })

  it('rejects zero, negative and non-finite values', () => {
    expect(isLegalScaleIntervalForm(0)).toBe(false)
    expect(isLegalScaleIntervalForm(-1)).toBe(false)
    expect(isLegalScaleIntervalForm(Number.NaN)).toBe(false)
    expect(isLegalScaleIntervalForm(Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('reports the mantissa it recognised', () => {
    expect(scaleIntervalMantissa(1)).toBe(1)
    expect(scaleIntervalMantissa(2_000)).toBe(2)
    expect(scaleIntervalMantissa(10)).toBe(1)
    expect(scaleIntervalMantissa(5)).toBe(5)
    expect(scaleIntervalMantissa(0.05)).toBe(5)
    expect(scaleIntervalMantissa(3)).toBe(3)
    expect(scaleIntervalMantissa(2.5)).toBe(25)
    expect(scaleIntervalMantissa(0)).toBeNull()
  })

  it('suggests the neighbouring permitted values, used by the "did you mean" hint', () => {
    expect(neighbouringScaleIntervalForms(3)).toEqual({ below: 2, above: 5 })
    expect(neighbouringScaleIntervalForms(2.5)).toEqual({ below: 2, above: 5 })
    expect(neighbouringScaleIntervalForms(0.07)).toEqual({ below: 0.05, above: 0.1 })
    expect(neighbouringScaleIntervalForms(15_000)).toEqual({ below: 10_000, above: 20_000 })
    expect(legalScaleIntervalForms(0, 1)).toEqual([1, 2, 5, 10, 20, 50])
  })
})
