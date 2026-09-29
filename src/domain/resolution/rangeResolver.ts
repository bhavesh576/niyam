import type { Grams } from '../models/instrument'
import type { NormalizedInstrument } from '../models/normalizedInstrument'
import { isExactMultipleOf } from '../../utils/mass'
import {
  approximatelyEqual,
  approximatelyLessOrEqual,
  approximatelyLessThan,
} from '../../utils/numeric'
import { RESOLUTION_REFERENCES } from './references'
import type {
  RangeResolution,
  RangeResolutionResult,
  ResolvedQuantity,
  ResolvedRange,
  TestConditionInput,
} from './types'

/**
 * `true` for the two displayed quantities (I and I_next), `false` for the applied test load L.
 *
 * The distinction matters: an indication is a value the instrument DISPLAYS, so it must be a
 * multiple of the scale interval of the partial weighing range it appears in (T.3.2.2, T.3.2.6,
 * §4.2.2.2 "Allowed indications"). A test load is mass put on the load receptor and need not be a
 * displayable value — a load of 2 001 g on an instrument whose second range has e₂ = 2 g is
 * perfectly ordinary, an INDICATION of 2 001 g in that range is not.
 */
export function isIndicationQuantity(quantity: ResolvedQuantity): boolean {
  return quantity === 'indication' || quantity === 'next-indication'
}

/**
 * Range resolution — "which partial weighing range does this value fall into, and which e applies?".
 *
 * This is the step that makes a multi-interval instrument behave like one. R-76 §3.3.3 states it
 * directly: *"e is to be taken according to the load applied"*. So the applicable verification
 * scale interval is always read from the resolved partial weighing range:
 *
 * ```text
 * L      --resolveLoadRange------------> range_L      --> e_L
 * I      --resolveIndicationRange------> range_I      --> e_I
 * I_next --resolveNextIndicationRange--> range_I_next --> e*
 * ```
 *
 * There is no `instrument.e` and no `ranges[0].e` fallback anywhere in this module: when a value
 * does not fall into a partial weighing range the applicable interval is `null`, and the caller
 * (the MPE resolver, later the error calculation) must report that instead of substituting e₁.
 *
 * Membership of partial weighing range i is `(Minᵢ, Maxᵢ]` = `(Maxᵢ₋₁, Maxᵢ]`, with range 1 closed
 * at Min. The §3.3.3 example fixes this: the load 2 000 g is still in range 1 (`± 1 e₁`), and
 * 2 001 g is already in range 2 (`± 1 e₂`).
 */

const SYMBOLS: Record<ResolvedQuantity, RangeResolution['symbol']> = {
  load: 'L',
  indication: 'I',
  'next-indication': 'I_next',
}

/** Resolves the partial weighing range that contains the test load L. */
export function resolveLoadRange(instrument: NormalizedInstrument, loadGrams: Grams | null): RangeResolution {
  return resolveRange(instrument, loadGrams, 'load')
}

/** Resolves the partial weighing range that contains the indication I. */
export function resolveIndicationRange(
  instrument: NormalizedInstrument,
  indicationGrams: Grams | null,
): RangeResolution {
  return resolveRange(instrument, indicationGrams, 'indication')
}

/**
 * Resolves the partial weighing range that contains the next indication I_next.
 *
 * I_next is the indication on the far side of a range changeover, which is why its interval is
 * reported separately as `e*` rather than being assumed equal to `e_L`.
 */
export function resolveNextIndicationRange(
  instrument: NormalizedInstrument,
  nextIndicationGrams: Grams | null,
): RangeResolution {
  return resolveRange(instrument, nextIndicationGrams, 'next-indication')
}

/**
 * Resolves all three quantities of a test condition at once.
 *
 * The three resolutions are independent: the same instrument, three separate lookups, three
 * possibly different intervals. `e_star` is taken from `range_I_next` and is never copied from
 * `e_L`, even when the two happen to be numerically equal (that happens whenever I_next stays
 * inside the partial weighing range of L, which is the ordinary case away from a changeover).
 *
 * `e_star` is also withheld (`null`) when I_next is not a displayable indication of the range it
 * falls in — see {@link isIndicationQuantity} and `indicationConsistency.ts`. The range membership
 * itself is still reported, because "2 001 g would fall in partial weighing range 2" is a true
 * statement; what is not true is that the instrument can indicate 2 001 g there.
 */
export function resolveRanges(instrument: NormalizedInstrument, input: TestConditionInput): RangeResolutionResult {
  const range_L = resolveLoadRange(instrument, input.loadGrams)
  const range_I = resolveIndicationRange(instrument, input.indicationGrams)
  const range_I_next = resolveNextIndicationRange(instrument, input.nextIndicationGrams)

  return {
    range_L,
    range_I,
    range_I_next,
    e_L: range_L.applicableIntervalGrams,
    // Withheld when I_next cannot be displayed in the range it resolves into.
    e_star: range_I_next.displayable === false ? null : range_I_next.applicableIntervalGrams,
  }
}

/** `true` when the resolved value sits exactly on a partial-range boundary Maxᵢ. */
export function isAtPartialRangeBoundary(resolution: RangeResolution): boolean {
  return resolution.status === 'resolved' && resolution.range !== null && resolution.range.atUpperBound
}

/** The single membership lookup shared by all three quantities. */
function resolveRange(
  instrument: NormalizedInstrument,
  valueGrams: Grams | null,
  quantity: ResolvedQuantity,
): RangeResolution {
  const unresolved = (status: RangeResolution['status']): RangeResolution => ({
    quantity,
    symbol: SYMBOLS[quantity],
    valueGrams,
    status,
    range: null,
    // No partial weighing range applies, therefore no e applies. Deliberately NOT e₁.
    applicableIntervalGrams: null,
    sourceReference: RESOLUTION_REFERENCES.weighingRangeLimit,
    // Nothing to check against: no range, no scale interval.
    displayable: null,
  })

  if (valueGrams === null || !Number.isFinite(valueGrams) || approximatelyLessThan(valueGrams, 0)) {
    return unresolved('not-a-value')
  }
  if (approximatelyLessThan(valueGrams, instrument.minCapacityGrams)) {
    return unresolved('below-weighing-range')
  }
  if (!approximatelyLessOrEqual(valueGrams, instrument.maxCapacityGrams)) {
    return unresolved('above-weighing-range')
  }

  // Ranges are ordered by increasing Maxᵢ, so the first range whose Maxᵢ is not below the value
  // is the one that contains it: Minᵢ < value ≤ Maxᵢ.
  const match = instrument.ranges.find((range) => approximatelyLessOrEqual(valueGrams, range.upperBoundGrams))
  if (!match) return unresolved('above-weighing-range')

  return {
    quantity,
    symbol: SYMBOLS[quantity],
    valueGrams,
    status: 'resolved',
    range: toResolvedRange(match, valueGrams),
    applicableIntervalGrams: match.verificationIntervalGrams,
    sourceReference: RESOLUTION_REFERENCES.partialRangeMembership,
    // Indications are checked against the scale interval of the range they appear in; the load is
    // not (see isIndicationQuantity). Exact integer test on micrograms — no rounding, no tolerance
    // that would let 2 001 g pass as a 2 g indication.
    displayable: isIndicationQuantity(quantity)
      ? isExactMultipleOf(valueGrams, match.verificationIntervalGrams)
      : null,
  }
}

function toResolvedRange(match: NormalizedInstrument['ranges'][number], valueGrams: Grams): ResolvedRange {
  return {
    index: match.index,
    rangeNumber: match.rangeNumber,
    lowerBoundGrams: match.lowerBoundGrams,
    upperBoundGrams: match.upperBoundGrams,
    verificationIntervalGrams: match.verificationIntervalGrams,
    verificationIntervals: match.verificationIntervals,
    isLast: match.isLast,
    atUpperBound: approximatelyEqual(valueGrams, match.upperBoundGrams),
    atLowerBound: approximatelyEqual(valueGrams, match.lowerBoundGrams),
  }
}
