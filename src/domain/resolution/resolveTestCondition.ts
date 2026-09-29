import type { NormalizedInstrument } from '../models/normalizedInstrument'
import { checkIndications } from './indicationConsistency'
import { resolveMPE } from './mpeResolver'
import { resolveRanges } from './rangeResolver'
import type { TestConditionInput, TestConditionResolution } from './types'

/**
 * resolveTestCondition(instrument, { L, I, I_next }) — the single entry point Phase 3 will call.
 *
 * Composition only, no logic of its own:
 *
 * ```text
 * resolveRanges(instrument, input)                 -> range_L, range_I, range_I_next, e_L, e*
 * resolveMPE(input.loadGrams, range_L, class)      -> m = L / e_L, Table 6 bracket, absolute mpe
 * checkIndications(ranges)                         -> check_I, check_I_next, indicationsAccepted, issues
 * ```
 *
 * The MPE is resolved from `range_L` (not re-derived), so the interval used for `m` and the
 * interval multiplied by the Table 6 coefficient are guaranteed to be the same `e_L`.
 *
 * The indications are checked against the scale interval of the partial weighing range each of them
 * was resolved into (see `indicationConsistency.ts`). This check applies to I and I_next only —
 * never to the test load L, which is applied mass rather than a displayed value — and it never
 * alters an entered value: a rejected indication stays rejected, and `e*` is withheld.
 *
 * Nothing here evaluates an error of indication, a changeover point or a PASS/FAIL verdict: a test
 * observation (ΔL, I, I_next → E, E₀, Ec) is Phase 3.
 */
export function resolveTestCondition(
  instrument: NormalizedInstrument,
  input: TestConditionInput,
): TestConditionResolution {
  const ranges = resolveRanges(instrument, input)
  const mpe = resolveMPE(input.loadGrams, ranges.range_L, instrument.accuracyClass)
  return { ranges, mpe, ...checkIndications(ranges) }
}
