import type { AccuracyClass, Grams } from '../models/instrument'
import { findTable6Row } from '../constants/r76Tables'
import { MICROGRAMS_PER_GRAM, ratio, toMicrograms } from '../../utils/mass'
import { RESOLUTION_REFERENCES } from './references'
import type { MpeResolutionResult, RangeResolution } from './types'

/**
 * MPE resolution — maximum permissible error on initial verification (§3.5.1, Table 6).
 *
 * The chain, and nothing else:
 *
 * ```text
 * L  ->  range_L  ->  e_L  ->  m = L / e_L  ->  Table 6 bracket  ->  absolute mpe = coefficient × e_L
 * ```
 *
 * Three things this module must never do, because each of them silently produces a wrong legal
 * limit on a multi-interval instrument:
 *
 * 1. **Never use `I / e` for the load mpe.** Table 6 brackets the *load* expressed in verification
 *    scale intervals; the indication is a separate quantity resolved separately (`resolveRanges`).
 * 2. **Never use a global `e`.** There is no instrument-wide verification scale interval on a
 *    multi-interval instrument — §3.3.3: "e is to be taken according to the load applied".
 * 3. **Never use `e₁` for the whole instrument.** e₁ applies to partial weighing range 1 only. If
 *    the load did not resolve into a partial weighing range (below Min, above Max, not entered),
 *    there is no applicable e and therefore no mpe: that is reported, not substituted.
 *
 * Scope: initial verification only. The mpe in service (§3.5.2, twice these values) is verified but
 * deliberately not implemented — see `src/domain/pendingRules.ts`.
 */

/**
 * Resolves the maximum permissible error on initial verification for a test load.
 *
 * @param loadGrams    L, in grams (`null` when nothing usable was entered).
 * @param loadRange    the result of {@link resolveLoadRange} for the same L — the MPE always uses
 *                     the interval of the partial weighing range that was resolved for the load.
 * @param accuracyClass selects the Table 6 column. Class III is the only class this build accepts;
 *                     the other columns exist as verified reference data.
 */
export function resolveMPE(
  loadGrams: Grams | null,
  loadRange: RangeResolution,
  accuracyClass: AccuracyClass,
): MpeResolutionResult {
  const unresolved = (status: MpeResolutionResult['status'], partial: Partial<MpeResolutionResult> = {}): MpeResolutionResult => ({
    status,
    accuracyClass,
    loadGrams,
    verificationIntervalGrams: null,
    m: null,
    bracket: null,
    coefficient: null,
    absoluteMpeGrams: null,
    sourceReference: RESOLUTION_REFERENCES.table6MultiInterval,
    ...partial,
  })

  if (loadGrams === null || !Number.isFinite(loadGrams) || loadGrams < 0) {
    return unresolved('no-load-value')
  }
  if (loadRange.status !== 'resolved' || loadRange.range === null) {
    // Below Min or above Max: no partial weighing range, hence no e and no Table 6 bracket.
    return unresolved('load-outside-weighing-range')
  }

  const e_L = loadRange.applicableIntervalGrams
  if (e_L === null || !(e_L > 0)) {
    return unresolved('load-outside-weighing-range')
  }

  const m = intervalsOf(loadGrams, e_L)
  if (m === null) return unresolved('outside-table-6', { verificationIntervalGrams: e_L })

  const bracket = findTable6Row(accuracyClass, m)
  if (bracket === null) {
    return unresolved('outside-table-6', { verificationIntervalGrams: e_L, m })
  }

  const absoluteMpe = absoluteMpeGrams(e_L, bracket.coefficient)
  if (absoluteMpe === null) {
    return unresolved('outside-table-6', { verificationIntervalGrams: e_L, m, bracket })
  }

  return {
    status: 'resolved',
    accuracyClass,
    loadGrams,
    verificationIntervalGrams: e_L,
    m,
    bracket,
    coefficient: bracket.coefficient,
    absoluteMpeGrams: absoluteMpe,
    sourceReference: RESOLUTION_REFERENCES.table6MultiInterval,
  }
}

/**
 * m = L / e — the load expressed in verification scale intervals, the quantity Table 6 brackets.
 *
 * Computed on integer micrograms whenever both values are representable there, so that an exact
 * bracket boundary stays exact: `200.1 g / 0.1 g` is 2001 and not 2001.0000000000002. Falls back
 * to a plain quotient when a value is outside the internal resolution.
 */
export function intervalsOf(loadGrams: Grams, eGrams: Grams): number | null {
  const loadMicro = toMicrograms(loadGrams)
  const intervalMicro = toMicrograms(eGrams)

  if (Number.isSafeInteger(loadMicro) && Number.isSafeInteger(intervalMicro) && intervalMicro > 0) {
    return loadMicro / intervalMicro
  }
  return ratio(loadGrams, eGrams)
}

/**
 * The absolute mpe in grams: `coefficient × e` with coefficient ∈ {0.5, 1.0, 1.5}.
 *
 * Per the Table 6 note this is the mpe "without the positive or negative sign"; the limit on the
 * error of indication is ± this value. Multiplied in integer micrograms and rounded once, because
 * binary floating point would otherwise turn 1.5 × 0.1 g into 0.15000000000000002 g.
 */
export function absoluteMpeGrams(eGrams: Grams, coefficient: number): Grams | null {
  if (!Number.isFinite(coefficient) || coefficient <= 0) return null

  const intervalMicro = toMicrograms(eGrams)
  if (!Number.isSafeInteger(intervalMicro) || intervalMicro <= 0) return null

  const productMicro = Math.round(intervalMicro * coefficient)
  if (!Number.isSafeInteger(productMicro)) return null

  return productMicro / MICROGRAMS_PER_GRAM
}
