import type { Grams } from '../models/instrument'
import type { NormalizedInstrument } from '../models/normalizedInstrument'
import { MICROGRAMS_PER_GRAM, addGrams, formatMass, subtractGrams, toMicrograms } from '../../utils/mass'
import type { MpeResolutionResult, RangeResolutionResult } from '../resolution/types'
import type { RuleReference } from '../validation/types'
import { EVALUATION_REFERENCES, EVALUATION_REFERENCE_ORDER } from './references'
import { validateObservation } from './validateObservation'
import type { EvaluationResult, ObservationIssue, TestObservationInput } from './types'

/**
 * The digital weighing-performance calculation of OIML R 76-1:2006, A.4.4.3 — range-aware.
 *
 * ```text
 * L      → range_L      → e_L  → m = L / e_L → Table 6 bracket → mpe        (Phase 2, reused)
 * I      → range_I                                                     ┐ reported, and I is
 * I_next → range_I_next → e*  (interval of the range where (I + e) appears) ┘ checked for displayability
 *
 * P  = I + ½ e* − ΔL        indication prior to rounding
 * E  = P − L                error prior to rounding
 * Ec = E − E₀               corrected error prior to rounding
 * |Ec| ≤ mpe  →  PASS       otherwise FAIL
 * ```
 *
 * **Why `½ e*` and not `½ e_L`.** A.4.4.3 prints `P = I + ½ e – ΔL`, and its multi-interval note
 * states that where L and I are in different partial weighing ranges "the term ½ e is to be ½ eᵢ or
 * ½ eᵢ₊₁ according to the partial weighing range in which the indication (I + e) appears". The
 * indication (I + e) *is* I_next, so the interval that term takes is exactly the `e*` Phase 2
 * resolves from I_next. The mpe, on the other hand, belongs to the load: it is resolved from
 * `range_L` and `e_L` by the Phase 2 mpe resolver. Two different intervals in one calculation is
 * the normal case at a range transition, and the whole point of this module.
 *
 * **What is deliberately not here.** No second range-resolution system, no second Table 6, no
 * `E = I − L` shortcut, no invented ΔL or E₀, no rounding of a value the tester entered, and no
 * verdict when an input is missing or inadmissible (see `validateObservation`). E, E₀ and Ec keep
 * their signs; only the comparison uses |Ec|.
 *
 * Pure and UI-free: it takes a normalized instrument and an observation in grams, and returns data.
 *
 * @param instrument  the validated, normalized instrument (range model **and** accuracy class — the
 *                    two things the specification's `(observation, rangeModel, accuracyClass)`
 *                    signature asks for, carried together since Phase 1).
 * @param observation L, I, ΔL, I_next and E₀ in grams; `null` where nothing usable was entered.
 */
export function evaluateDigitalWeighingObservation(
  instrument: NormalizedInstrument,
  observation: TestObservationInput,
): EvaluationResult {
  const validation = validateObservation(instrument, observation)
  const { resolution, issues } = validation
  const { ranges, mpe } = resolution

  const shared = {
    observation,
    resolution,
    range_L: ranges.range_L,
    range_I: ranges.range_I,
    range_I_next: ranges.range_I_next,
    e_L: ranges.e_L,
    e_star: ranges.e_star,
    m: mpe.m,
    mpeCoefficient: mpe.coefficient,
    mpeBracket: mpe.bracket,
    mpeGrams: mpe.absoluteMpeGrams,
    // E₀ is an input, so it is echoed even when nothing was calculated; P, E and Ec are results and
    // stay null unless the observation was admissible.
    E0: observation.zeroErrorGrams,
    references: [...EVALUATION_REFERENCE_ORDER] as RuleReference[],
  }

  const blocked = (extraIssues: readonly ObservationIssue[] = []): EvaluationResult => ({
    ...shared,
    status: 'blocked',
    halfEStarGrams: null,
    P: null,
    E: null,
    Ec: null,
    absoluteEcGrams: null,
    marginGrams: null,
    passed: null,
    issues: [...issues, ...extraIssues],
  })

  if (!validation.canEvaluate) return blocked()

  const inputs = collectInputs(observation, ranges, mpe)
  if (inputs === null) {
    // Unreachable when validation accepted the observation; refused rather than guessed at.
    return blocked([
      {
        ruleId: 'r76.a4.4.3.inputs-incomplete',
        severity: 'error',
        field: null,
        message: 'Cannot evaluate: a quantity the calculation needs could not be resolved from this observation.',
        detail: 'No value is substituted. This is reported instead of producing a number that cannot be traced to the entered observation.',
        reference: EVALUATION_REFERENCES.changeoverFormulae,
      },
    ])
  }

  const halfEStar = halfIntervalGrams(inputs.eStar)
  if (halfEStar === null) {
    return blocked([
      {
        ruleId: 'r76.a4.4.3.half-interval-not-representable',
        severity: 'error',
        field: 'nextIndication',
        message: `Cannot evaluate: ½ e* cannot be represented exactly at the internal resolution of 1 µg for e* = ${formatMass(inputs.eStar, 'g')}.`,
        detail: 'The ½ e term of A.4.4.3 is refused rather than rounded, because rounding it would change the error prior to rounding. Not reachable for a class III interval (Table 3 bands start at e = 0.1 g).',
        reference: EVALUATION_REFERENCES.changeoverFormulae,
        context: { e_star: inputs.eStar },
      },
    ])
  }

  // ── the calculation, in the order A.4.4.3 prints it ────────────────────────────────────────
  const P = subtractGrams(addGrams(inputs.I, halfEStar), inputs.deltaL)
  const E = subtractGrams(P, inputs.L)
  const Ec = subtractGrams(E, inputs.E0)
  const absoluteEc = absoluteGrams(Ec)
  const margin = subtractGrams(inputs.mpeGrams, absoluteEc)
  const passed = isWithinLimit(absoluteEc, inputs.mpeGrams)

  return {
    ...shared,
    status: 'evaluated',
    halfEStarGrams: halfEStar,
    P,
    E,
    Ec,
    absoluteEcGrams: absoluteEc,
    marginGrams: margin,
    passed,
    issues: [],
  }
}

/**
 * ½ e, exactly — or `null` when the interval cannot be halved at the internal resolution.
 *
 * Every class III interval (Table 3: 0.1 g ≤ e ≤ 2 g, or 5 g ≤ e, in the 1/2/5 × 10ᵏ form of
 * §4.2.2.1) has an even number of micrograms, so this is exact in practice; the guard exists so the
 * engine refuses instead of silently rounding a term that shifts the error by half a microgram.
 */
export function halfIntervalGrams(eGrams: Grams): Grams | null {
  const micro = toMicrograms(eGrams)
  if (!Number.isSafeInteger(micro) || micro <= 0) return null
  if (micro % 2 !== 0) return null
  return micro / 2 / MICROGRAMS_PER_GRAM
}

/** |x| in grams, taken on integer micrograms so a signed value never loses precision. */
export function absoluteGrams(grams: Grams): Grams {
  const micro = toMicrograms(grams)
  return Number.isSafeInteger(micro) ? Math.abs(micro) / MICROGRAMS_PER_GRAM : Math.abs(grams)
}

/**
 * |Ec| ≤ mpe — the verdict comparison.
 *
 * Both sides are exact at the internal microgram resolution (Ec is built from additions and
 * subtractions of parsed values, the mpe from `coefficient × e_L` in integer micrograms), so the
 * comparison is made on those integers. A relative tolerance — which the validator uses for limits
 * against decimal input — could only make a legal limit looser than Table 6 prints it, and a verdict
 * must not depend on one. Equality is **inside** the limit: Table 6 gives ± values and A.4.4.3
 * writes "Ec = E – E₀ ≤ mpe".
 */
export function isWithinLimit(absoluteErrorGrams: Grams, limitGrams: Grams): boolean {
  const error = toMicrograms(absoluteErrorGrams)
  const limit = toMicrograms(limitGrams)
  if (!Number.isSafeInteger(error) || !Number.isSafeInteger(limit)) {
    return absoluteErrorGrams <= limitGrams
  }
  return error <= limit
}

// ---------------------------------------------------------------------------------------------

interface CalculationInputs {
  L: Grams
  I: Grams
  deltaL: Grams
  eStar: Grams
  E0: Grams
  mpeGrams: Grams
}

/** Every quantity the formulae need, or `null` if one of them is absent. */
function collectInputs(
  observation: TestObservationInput,
  ranges: RangeResolutionResult,
  mpe: MpeResolutionResult,
): CalculationInputs | null {
  const { loadGrams, indicationGrams, additionalLoadGrams, zeroErrorGrams } = observation
  if (loadGrams === null || indicationGrams === null || additionalLoadGrams === null || zeroErrorGrams === null) {
    return null
  }
  if (ranges.e_star === null || mpe.absoluteMpeGrams === null) return null

  return {
    L: loadGrams,
    I: indicationGrams,
    deltaL: additionalLoadGrams,
    eStar: ranges.e_star,
    E0: zeroErrorGrams,
    mpeGrams: mpe.absoluteMpeGrams,
  }
}
