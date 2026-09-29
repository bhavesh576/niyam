import { describe, expect, it } from 'vitest'
import { normalizeConfiguration } from './normalizeConfiguration'
import { OFFICIAL_EXAMPLE_CONFIG, OFFICIAL_EXAMPLE_NORMALIZED } from '../data/defaultConfiguration'
import { fixture, officialExampleFixture } from '../testing/fixtures'
import { validateConfiguration } from './validation/validateConfiguration'
import { describeTable3Band } from './constants/r76Tables'

/**
 * Tests for the normalized range model — the structure the later evaluation phases will consume.
 *
 * The expected bounds and n values of the official example are taken verbatim from the printed
 * example in OIML R 76-1:2006 §3.3.3, not recomputed here.
 */
describe('normalizeConfiguration', () => {
  it('reproduces the partial weighing ranges published in §3.3.3', () => {
    const normalized = normalizeConfiguration(officialExampleFixture())

    expect(normalized).not.toBeNull()
    expect(normalized?.minCapacityGrams).toBe(OFFICIAL_EXAMPLE_NORMALIZED.minCapacityGrams)
    expect(normalized?.maxCapacityGrams).toBe(OFFICIAL_EXAMPLE_NORMALIZED.maxCapacityGrams)
    expect(normalized?.rangeCount).toBe(3)

    expect(
      normalized?.ranges.map((range) => ({
        lowerBoundGrams: range.lowerBoundGrams,
        upperBoundGrams: range.upperBoundGrams,
        verificationIntervalGrams: range.verificationIntervalGrams,
        verificationIntervals: range.verificationIntervals,
      })),
    ).toEqual(OFFICIAL_EXAMPLE_NORMALIZED.ranges.map((range) => ({ ...range })))
  })

  it('resolves Minᵢ = Maxᵢ₋₁ with Min₁ = Min (§3.3.1)', () => {
    const normalized = normalizeConfiguration(OFFICIAL_EXAMPLE_CONFIG)

    expect(normalized?.ranges.map((range) => range.lowerBoundGrams)).toEqual([20, 2_000, 5_000])
    expect(normalized?.ranges.map((range) => range.upperBoundGrams)).toEqual([2_000, 5_000, 15_000])
    // The ranges are contiguous: each one starts exactly where the previous one ends.
    normalized?.ranges.slice(1).forEach((range, position) => {
      expect(range.lowerBoundGrams).toBe((normalized?.ranges[position].upperBoundGrams ?? Number.NaN))
    })
  })

  it('exposes rangeNumber (1-based) and index (0-based) side by side', () => {
    const normalized = normalizeConfiguration(officialExampleFixture())

    expect(normalized?.ranges.map((range) => range.rangeNumber)).toEqual([1, 2, 3])
    expect(normalized?.ranges.map((range) => range.index)).toEqual([0, 1, 2])
    expect(normalized?.ranges.map((range) => range.isLast)).toEqual([false, false, true])
  })

  it('computes nᵢ = Maxᵢ / eᵢ and the Table 4 ratio Maxᵢ / eᵢ₊₁, exempting the last range', () => {
    const normalized = normalizeConfiguration(officialExampleFixture())

    expect(normalized?.ranges.map((range) => range.verificationIntervals)).toEqual([2_000, 2_500, 1_500])
    expect(normalized?.ranges.map((range) => range.table4Ratio)).toEqual([1_000, 500, null])
    expect(normalized?.ranges.every((range) => range.verificationIntervalsAreExact)).toBe(true)
  })

  it('selects the Table 3 band of each eᵢ independently', () => {
    const normalized = normalizeConfiguration(officialExampleFixture())

    expect(normalized?.ranges.map((range) => (range.table3Row ? describeTable3Band(range.table3Row) : null))).toEqual([
      '0.1 g ≤ e ≤ 2 g',
      '0.1 g ≤ e ≤ 2 g',
      '5 g ≤ e',
    ])
  })

  it('flags a fractional nᵢ without changing the value', () => {
    const normalized = normalizeConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 2_000.5, e: 1 },
          { max: 5_000, e: 2 },
        ],
      }),
    )

    expect(normalized?.ranges[0].verificationIntervals).toBeCloseTo(2_000.5, 9)
    expect(normalized?.ranges[0].verificationIntervalsAreExact).toBe(false)
    expect(normalized?.ranges[1].verificationIntervalsAreExact).toBe(true)
  })

  it('returns null for an incomplete configuration instead of a model with holes', () => {
    expect(normalizeConfiguration(fixture({ min: null, d: 1, ranges: [{ max: 2_000, e: 1 }] }))).toBeNull()
    expect(normalizeConfiguration(fixture({ min: 20, d: null, ranges: [{ max: 2_000, e: 1 }] }))).toBeNull()
    expect(normalizeConfiguration(fixture({ min: 20, d: 1, ranges: [] }))).toBeNull()
    expect(normalizeConfiguration(fixture({ min: 20, d: 1, ranges: [{ max: null, e: 1 }] }))).toBeNull()
    expect(normalizeConfiguration(fixture({ min: 20, d: 1, ranges: [{ max: 2_000, e: null }] }))).toBeNull()
  })

  it('is a structural projection: it also normalizes a configuration the validator rejects', () => {
    // Validation and normalization are separate steps; the model is built from the numbers as
    // entered so that the UI can show why they were rejected.
    const invalid = fixture({
      min: 5,
      d: 1,
      ranges: [
        { max: 2_000, e: 1 },
        { max: 1_000, e: 2 },
      ],
    })

    expect(validateConfiguration(invalid).valid).toBe(false)
    const normalized = normalizeConfiguration(invalid)
    expect(normalized?.ranges.map((range) => range.upperBoundGrams)).toEqual([2_000, 1_000])
  })

  it('keeps the instrument identity (type, class, d) on the normalized model', () => {
    const normalized = normalizeConfiguration(officialExampleFixture())

    expect(normalized?.instrumentType).toBe('multi-interval')
    expect(normalized?.accuracyClass).toBe('III')
    expect(normalized?.displayDivisionGrams).toBe(1)
  })
})
