import type { Grams, InstrumentConfig } from './models/instrument'
import type { NormalizedInstrument, NormalizedPartialRange } from './models/normalizedInstrument'
import { findTable3Row } from './constants/r76Tables'
import { isExactMultipleOf, ratio } from '../utils/mass'

/**
 * normalizeConfiguration(config) — raw form model -> normalized range model.
 *
 * Called after {@link validateConfiguration} has accepted a configuration. It resolves the range
 * structure that the later evaluation phases (range resolution, transition-aware MPE, E / Ec)
 * will consume:
 *
 * ```text
 * partial range 1:  Min    -> Max_1   e_1   n_1 = Max_1 / e_1
 * partial range 2:  Max_1  -> Max_2   e_2   n_2 = Max_2 / e_2
 * partial range 3:  Max_2  -> Max_3   e_3   n_3 = Max_3 / e_3     (Max_3 = Max)
 * ```
 *
 * The bounds follow §3.3.1: `Min_i = Max_(i-1)` and `Min_1 = Min`.
 * Returns `null` when the configuration is incomplete (any mass missing), because a normalized
 * model with holes would be worse than no model at all.
 */
export function normalizeConfiguration(config: InstrumentConfig): NormalizedInstrument | null {
  const min = config.minCapacityGrams
  const displayDivision = config.displayDivisionGrams
  if (min === null || displayDivision === null) return null
  if (config.ranges.length === 0) return null

  const entries = config.ranges.map((range) => ({
    id: range.id,
    max: range.maxCapacityGrams,
    e: range.verificationIntervalGrams,
  }))

  const complete = entries.filter((entry): entry is { id: string; max: Grams; e: Grams } => entry.max !== null && entry.e !== null)
  if (complete.length !== entries.length) return null

  const ranges: NormalizedPartialRange[] = complete.map((entry, index) => {
    const lowerBoundGrams = index === 0 ? min : complete[index - 1].max
    const nextIntervalGrams = index < complete.length - 1 ? complete[index + 1].e : null

    return {
      rangeNumber: index + 1,
      index,
      id: entry.id,
      lowerBoundGrams,
      upperBoundGrams: entry.max,
      verificationIntervalGrams: entry.e,
      verificationIntervals: ratio(entry.max, entry.e) ?? Number.NaN,
      verificationIntervalsAreExact: isExactMultipleOf(entry.max, entry.e),
      table3Row: findTable3Row(config.accuracyClass, entry.e),
      table4Ratio: nextIntervalGrams === null ? null : ratio(entry.max, nextIntervalGrams),
      isLast: index === complete.length - 1,
    }
  })

  return {
    instrumentType: config.instrumentType,
    accuracyClass: config.accuracyClass,
    minCapacityGrams: min,
    displayDivisionGrams: displayDivision,
    maxCapacityGrams: complete[complete.length - 1].max,
    rangeCount: ranges.length,
    ranges,
  }
}
