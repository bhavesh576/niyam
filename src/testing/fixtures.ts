import type { AccuracyClass, InstrumentConfig, InstrumentType, PartialRange } from '../domain/models/instrument'
import type { NormalizedInstrument } from '../domain/models/normalizedInstrument'
import { normalizeConfiguration } from '../domain/normalizeConfiguration'
import { validateConfiguration } from '../domain/validation/validateConfiguration'

/**
 * Fixtures for the unit tests.
 *
 * Masses are given in GRAMS, exactly as the domain model stores them, so a fixture reads like the
 * line of an R-76 test report: `{ max: 2000, e: 1 }` is Max₁ = 2 kg with e₁ = 1 g.
 * Not imported by any application code.
 */

export interface RangeFixture {
  /** Max_i in grams. */
  max: number | null
  /** e_i in grams. */
  e: number | null
  id?: string
}

export interface ConfigFixture {
  /** Min in grams (default 20 g). */
  min?: number | null
  /** d in grams (default 1 g). */
  d?: number | null
  ranges: RangeFixture[]
  accuracyClass?: AccuracyClass
  instrumentType?: InstrumentType
}

/** Builds an {@link InstrumentConfig}; defaults follow the official §3.3.3 example (Min = 20 g, d = 1 g). */
export function fixture(options: ConfigFixture): InstrumentConfig {
  return {
    instrumentType: options.instrumentType ?? 'multi-interval',
    accuracyClass: options.accuracyClass ?? 'III',
    minCapacityGrams: options.min === undefined ? 20 : options.min,
    displayDivisionGrams: options.d === undefined ? 1 : options.d,
    ranges: options.ranges.map<PartialRange>((range, index) => ({
      id: range.id ?? `fixture-range-${index + 1}`,
      maxCapacityGrams: range.max,
      verificationIntervalGrams: range.e,
    })),
  }
}

/** The OIML R 76-1:2006 §3.3.3 example: Max = 2 / 5 / 15 kg, e = 1 / 2 / 10 g, class III, Min = 20 g. */
export function officialExampleFixture(): InstrumentConfig {
  return fixture({
    min: 20,
    d: 1,
    ranges: [
      { max: 2_000, e: 1 },
      { max: 5_000, e: 2 },
      { max: 15_000, e: 10 },
    ],
  })
}

// ---------------------------------------------------------------------------------------------
// Normalized instruments for the Phase 2 resolution tests
// ---------------------------------------------------------------------------------------------

/**
 * Validates and normalizes a fixture, failing loudly when it is not a valid configuration.
 *
 * The resolution tests must never run against an instrument that the validator would reject: an
 * invalid range structure would make an mpe assertion meaningless.
 */
export function instrumentOf(config: InstrumentConfig): NormalizedInstrument {
  const validation = validateConfiguration(config)
  if (!validation.valid) {
    const reasons = validation.errors.map((issue) => `${issue.ruleId}: ${issue.message}`).join(' | ')
    throw new Error(`test fixture is not a valid configuration — ${reasons}`)
  }

  const instrument = normalizeConfiguration(config)
  if (instrument === null) throw new Error('test fixture could not be normalized')
  return instrument
}

/** The §3.3.3 example as a normalized instrument: Min = 20 g, Max = 2 / 5 / 15 kg, e = 1 / 2 / 10 g. */
export function officialExampleInstrument(): NormalizedInstrument {
  return instrumentOf(officialExampleFixture())
}

/**
 * One partial weighing range, e₁ = d = 1 g, Min = 20 g, Max₁ = 10 kg (n₁ = 10 000).
 *
 * Isolated on purpose for the Table 6 tests: with a single range and e₁ = 1 g every class III
 * bracket boundary is reachable as an exact load (m = 500 → 500 g, m = 2 000 → 2 000 g,
 * m = 10 000 → 10 000 g), so a bracket edge can be tested without a range changeover interfering.
 * Valid, with the expected `structure.single-partial-range` warning.
 */
export function singleRangeBracketInstrument(): NormalizedInstrument {
  return instrumentOf(fixture({ min: 20, d: 1, ranges: [{ max: 10_000, e: 1 }] }))
}

/**
 * One partial weighing range with a fractional interval: e₁ = d = 0.1 g, Min = 2 g, Max₁ = 1 kg
 * (n₁ = 10 000). Reaches the ±1.5 e bracket, where a naive `1.5 * 0.1` would not be exact.
 */
export function fineIntervalInstrument(): NormalizedInstrument {
  return instrumentOf(fixture({ min: 2, d: 0.1, ranges: [{ max: 1_000, e: 0.1 }] }))
}
