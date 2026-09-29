import type { NormalizedInstrument } from '../models/normalizedInstrument'
import { toTestConditionInputOf } from '../models/observation'
import { addGrams, formatMass, subtractGrams } from '../../utils/mass'
import { approximatelyEqual, approximatelyGreaterThan } from '../../utils/numeric'
import { formatCount, subscript } from '../../utils/text'
import { RESOLUTION_REFERENCES } from '../resolution/references'
import { resolveTestCondition } from '../resolution/resolveTestCondition'
import { INDICATION_SCALE_INTERVAL_RULE_ID } from '../resolution/indicationConsistency'
import { unresolvedRangeLabel } from '../resolution/describe'
import { EVALUATION_REFERENCES } from './references'
import type { ObservationIssue, TestObservationInput } from './types'
import type { TestConditionResolution } from '../resolution/types'

/**
 * Pre-calculation validation of one digital weighing observation.
 *
 * The rule this module enforces is simple and strict: **if anything the calculation needs is
 * missing or inadmissible, nothing is calculated.** No default is substituted, no value is rounded,
 * completed or reordered, and no verdict is produced — the reason is reported against the field it
 * belongs to instead.
 *
 * It reuses Phase 2 rather than repeating it:
 *
 * - {@link resolveTestCondition} resolves `range_L`, `range_I`, `range_I_next`, `e_L`, `e*` and the
 *   mpe (there is no second range-resolution or mpe system in Phase 3);
 * - the indication-consistency checks of Phase 2 (`check_I`, `check_I_next`) decide whether I and
 *   I_next are indications their resolved partial weighing ranges can actually display, and their
 *   messages and rule identifier are passed through unchanged.
 *
 * What Phase 3 adds on top is the observation-specific part: ΔL and E₀ must be present, ΔL cannot be
 * negative, and the pair I → I_next must be the changeover A.4.4.3 describes — the indication
 * "increased unambiguously by one scale interval (I + e)", with the interval of the partial weighing
 * range in which (I + e) appears. That relationship is verified, not assumed, and no next indication
 * is ever invented to make an observation fit.
 */

export interface ObservationValidation {
  /** The Phase 2 resolution of L, I and I_next, plus its mpe and indication checks. */
  resolution: TestConditionResolution
  /** Every reason the observation cannot be evaluated, in field order. Empty when it can. */
  issues: readonly ObservationIssue[]
  canEvaluate: boolean
}

export function validateObservation(
  instrument: NormalizedInstrument,
  observation: TestObservationInput,
): ObservationValidation {
  // Phase 2, reused unchanged: ranges, intervals, mpe and the two indication-consistency checks.
  const resolution = resolveTestCondition(instrument, toTestConditionInputOf(observation))
  const { ranges, mpe, check_I, check_I_next } = resolution
  const issues: ObservationIssue[] = []

  // ── L — the load the error is determined at, and the load the mpe belongs to ────────────────
  if (observation.loadGrams === null) {
    issues.push({
      ruleId: 'r76.a4.4.3.load-required',
      severity: 'error',
      field: 'load',
      message: 'L is required: the error of indication is determined at a certain load, L, and the maximum permissible error follows from the partial weighing range that contains it.',
      detail: 'Nothing is calculated and no default load is assumed. Enter the load applied to the load receptor.',
      reference: EVALUATION_REFERENCES.changeoverProcedure,
    })
  } else if (ranges.range_L.status !== 'resolved') {
    issues.push({
      ruleId: 'r76.t3.1.4.load-outside-weighing-range',
      severity: 'error',
      field: 'load',
      message: `L is ${unresolvedRangeLabel(ranges.range_L)} — no partial weighing range contains it, so no verification scale interval applies and Table 6 gives no maximum permissible error for it.`,
      detail: 'The weighing range is Min → Max (T.3.1.4). §3.3.3: "e is to be taken according to the load applied" — where no partial weighing range applies, there is no e to take. The entered value is not clamped to Min or Max.',
      reference: RESOLUTION_REFERENCES.weighingRangeLimit,
      context: { loadGrams: observation.loadGrams, status: ranges.range_L.status },
    })
  } else if (mpe.status !== 'resolved') {
    issues.push({
      ruleId: 'r76.3.5.1.mpe-not-resolved',
      severity: 'error',
      field: 'load',
      message: `No maximum permissible error could be resolved for L = ${formatMass(observation.loadGrams)}: m = L / e_L = ${mpe.m === null ? 'undefined' : formatCount(mpe.m)} falls outside every bracket Table 6 states for accuracy class ${mpe.accuracyClass}.`,
      detail: 'Reported rather than extrapolated: Table 6 is not extended beyond the brackets it prints.',
      reference: EVALUATION_REFERENCES.mpeFromLoadRange,
      context: { m: mpe.m, status: mpe.status },
    })
  }

  // ── I — the indication noted at that load ───────────────────────────────────────────────────
  if (observation.indicationGrams === null) {
    issues.push({
      ruleId: 'r76.a4.4.3.indication-required',
      severity: 'error',
      field: 'indication',
      message: 'I is required: A.4.4.3 notes "the indicated value, I" at the load L, and P = I + ½ e − ΔL is computed from it.',
      detail: 'No indication is inferred from the load. Enter the value the instrument indicated before the additional weights were applied.',
      reference: EVALUATION_REFERENCES.changeoverProcedure,
    })
  } else if (check_I.status === 'not-resolved') {
    issues.push({
      ruleId: 'r76.a4.4.3.indication-outside-weighing-range',
      severity: 'error',
      field: 'indication',
      message: `I is ${unresolvedRangeLabel(ranges.range_I)}, so no partial weighing range applies to it and its scale interval cannot be checked.`,
      detail: 'An indication is a displayed value of the instrument: it has to belong to a partial weighing range whose scale interval it can be checked against (§4.2.2.2). The entered value is not modified.',
      reference: RESOLUTION_REFERENCES.weighingRangeLimit,
      context: { indicationGrams: observation.indicationGrams, status: ranges.range_I.status },
    })
  } else if (!check_I.accepted) {
    issues.push(fromIndicationCheck(check_I))
  }

  // ── ΔL — the additional load at which the indication changed over ───────────────────────────
  if (observation.additionalLoadGrams === null) {
    issues.push({
      ruleId: 'r76.a4.4.3.additional-load-required',
      severity: 'error',
      field: 'additionalLoad',
      message: 'ΔL is required to determine the changeover point.',
      detail: 'A.4.4.3: "Additional weights of say 1/10 e are successively added until the indication of the instrument is increased unambiguously by one scale interval (I + e)." The additional load ΔL at which that happened enters the formula P = I + ½ e − ΔL. It is an observation, so nothing is assumed for it — not 0, not ½ e.',
      reference: EVALUATION_REFERENCES.changeoverProcedure,
    })
  } else if (observation.additionalLoadGrams < 0) {
    issues.push({
      ruleId: 'r76.a4.4.3.additional-load-negative',
      severity: 'error',
      field: 'additionalLoad',
      message: `ΔL = ${formatMass(observation.additionalLoadGrams)} is negative: weights are added to the load receptor, so the additional load cannot be below zero.`,
      detail: 'The entered value is not negated, rounded or replaced. No upper bound for ΔL is stated in A.4.4.3 ("say 1/10 e" describes the weights used), so none is enforced here.',
      reference: EVALUATION_REFERENCES.additionalLoadInput,
      context: { additionalLoadGrams: observation.additionalLoadGrams },
    })
  }

  // ── I_next — the indication on the other side of the changeover, which fixes e* ─────────────
  if (observation.nextIndicationGrams === null) {
    issues.push({
      ruleId: 'r76.a4.4.3.next-indication-required',
      severity: 'error',
      field: 'nextIndication',
      message: 'I_next is required for the digital changeover calculation.',
      detail: 'A.4.4.3 determines the indication prior to rounding from the changeover point: the indication "increased unambiguously by one scale interval (I + e)". I_next also fixes the partial weighing range whose scale interval the ½ e term takes — "½ ei or ½ ei+1 according to the partial weighing range in which the indication (I + e) appears" — so it can be neither omitted nor inferred.',
      reference: EVALUATION_REFERENCES.multiIntervalHalfInterval,
    })
  } else if (check_I_next.status === 'not-resolved') {
    issues.push({
      ruleId: 'r76.a4.4.3.next-indication-outside-weighing-range',
      severity: 'error',
      field: 'nextIndication',
      message: `I_next is ${unresolvedRangeLabel(ranges.range_I_next)}, so no partial weighing range applies to it and e* cannot be resolved.`,
      detail: 'e* is the scale interval of the partial weighing range in which the next indication appears; without such a range the ½ e term of A.4.4.3 has no interval to take. The entered value is not modified.',
      reference: RESOLUTION_REFERENCES.weighingRangeLimit,
      context: { nextIndicationGrams: observation.nextIndicationGrams, status: ranges.range_I_next.status },
    })
  } else if (!check_I_next.accepted) {
    issues.push(fromIndicationCheck(check_I_next))
  } else {
    // Both indications are displayable: verify that the pair really is the observed changeover.
    const changeoverIssues = checkChangeoverRelationship(resolution, observation)
    issues.push(...changeoverIssues)
  }

  // ── E₀ — the zero error, an input determined elsewhere ──────────────────────────────────────
  if (observation.zeroErrorGrams === null) {
    issues.push({
      ruleId: 'r76.a4.4.3.zero-error-required',
      severity: 'error',
      field: 'zeroError',
      message: 'Cannot evaluate: E0 is required for corrected error Ec.',
      detail: 'A.4.4.3: "The corrected error prior to rounding is: Ec = E – E0 ≤ mpe, where E0 is the error calculated at zero or at a load close to zero (e.g. 10 e)." E₀ is determined by the same changeover procedure at zero (A.4.2.3.1: "The error at zero is calculated according to the description in A.4.4.3") and must be entered: this build neither measures it, nor assumes zero, nor derives it from the observation. An entered 0 g is a valid value; an empty field is not.',
      reference: EVALUATION_REFERENCES.zeroError,
    })
  }

  return { resolution, issues, canEvaluate: issues.length === 0 }
}

/**
 * The Phase 2 indication-consistency rejection, passed through unchanged — same rule identifier,
 * same message, same clauses — so a rejected indication reads identically in both phases.
 */
function fromIndicationCheck(check: TestConditionResolution['check_I']): ObservationIssue {
  return {
    ruleId: check.ruleId ?? INDICATION_SCALE_INTERVAL_RULE_ID,
    severity: 'error',
    field: check.field,
    message: check.message ?? 'Invalid indication: the value does not follow the resolved verification scale interval.',
    detail: check.detail ?? undefined,
    reference: check.reference,
    context: {
      valueGrams: check.valueGrams,
      indicationIntervalGrams: check.indicationIntervalGrams,
      resolvedRangeNumber: check.resolvedRangeNumber,
      intervalsOfIndication: check.intervalsOfIndication,
    },
  }
}

/**
 * Is the entered pair I → I_next the changeover A.4.4.3 describes?
 *
 * Two verified facts are checked, and nothing beyond them:
 *
 * 1. the indication **increased** — "until the indication of the instrument is increased
 *    unambiguously by one scale interval (I + e)", so I_next > I;
 * 2. it increased by **one scale interval of the partial weighing range in which (I + e) appears** —
 *    i.e. I_next − I = e*, the interval Phase 2 resolved from I_next.
 *
 * Both are only checked once I and I_next are present and displayable, so a rejected indication
 * never produces a cascade of derived complaints.
 */
function checkChangeoverRelationship(
  resolution: TestConditionResolution,
  observation: TestObservationInput,
): ObservationIssue[] {
  const { ranges, check_I, check_I_next } = resolution
  if (observation.indicationGrams === null || observation.nextIndicationGrams === null) return []
  if (check_I.status !== 'consistent' || check_I_next.status !== 'consistent') return []

  const indication = observation.indicationGrams
  const next = observation.nextIndicationGrams

  if (!approximatelyGreaterThan(next, indication)) {
    return [
      {
        ruleId: 'r76.a4.4.3.changeover-not-increased',
        severity: 'error',
        field: 'nextIndication',
        message: `I_next = ${formatMass(next)} is not greater than I = ${formatMass(indication)}: A.4.4.3 adds weights until the indication is "increased unambiguously by one scale interval (I + e)", so the next indication lies above the indication.`,
        detail: 'No next indication is invented and the two values are not reordered: I_next must be the indication actually observed after the additional load ΔL was applied.',
        reference: EVALUATION_REFERENCES.changeoverProcedure,
        context: { indicationGrams: indication, nextIndicationGrams: next },
      },
    ]
  }

  const eStar = ranges.e_star
  if (eStar === null) return []

  const step = subtractGrams(next, indication)
  if (approximatelyEqual(step, eStar)) return []

  const fromRange = ranges.range_I.range?.rangeNumber ?? null
  const toRange = ranges.range_I_next.range?.rangeNumber ?? null
  const expectedStep = formatMass(addGrams(indication, eStar), 'g')
  const observedChangeover =
    fromRange !== null && toRange !== null
      ? `With I = ${formatMass(indication, 'g')} in partial weighing range ${fromRange} and the next indication appearing in partial weighing range ${toRange}, the observed changeover is I + e${subscript(toRange)} = ${formatMass(indication, 'g')} + ${formatMass(eStar, 'g')} = ${expectedStep}.`
      : `The observed changeover is (I + e), with e the scale interval of the partial weighing range in which that indication appears: I + e* = ${formatMass(indication, 'g')} + ${formatMass(eStar, 'g')} = ${expectedStep}.`

  return [
    {
      ruleId: 'r76.a4.4.3.changeover-not-one-interval',
      severity: 'error',
      field: 'nextIndication',
      message:
        `I_next − I = ${formatMass(step, 'g')} is not one scale interval of the partial weighing range in which the next indication appears (e* = ${formatMass(eStar, 'g')}): ` +
        'A.4.4.3 requires the indication to be "increased unambiguously by one scale interval (I + e)".',
      detail:
        observedChangeover +
        ' The entered values are not adjusted, and no next indication is invented. If the indication had not yet stepped up by one scale interval, the changeover point of A.4.4.3 was not reached and P = I + ½ e − ΔL cannot be determined from this observation.',
      reference: EVALUATION_REFERENCES.multiIntervalHalfInterval,
      context: {
        stepGrams: step,
        e_star: eStar,
        indicationGrams: indication,
        nextIndicationGrams: next,
        range_I: fromRange,
        range_I_next: toRange,
      },
    },
  ]
}
