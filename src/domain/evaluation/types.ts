import type { NormalizedInstrument } from '../models/normalizedInstrument'
import type { Grams } from '../models/instrument'
import type { TestObservationField } from '../models/observation'
import type { Table6Row } from '../constants/r76Tables'
import type { RangeResolution, TestConditionInput, TestConditionResolution } from '../resolution/types'
import type { RuleReference } from '../validation/types'

/**
 * Types of the Phase 3 evaluation layer.
 *
 * One observation in, one deterministic result out. Everything is expressed in grams (`Grams`),
 * signed where R-76 signs it (E, E₀, Ec), and every number on screen can be traced back to a clause
 * through the references carried here.
 */

/**
 * The five quantities of one digital weighing observation, in grams.
 *
 * `null` means "nothing usable was entered" (empty field or text that is not a decimal number).
 * Extends the Phase 2 test condition, so the same object can be handed to the range resolver
 * without a second conversion.
 */
export interface TestObservationInput extends TestConditionInput {
  /** L — test load applied to the load receptor. */
  loadGrams: Grams | null
  /** I — indication noted at the load L, before additional weights are applied. */
  indicationGrams: Grams | null
  /** ΔL — additional load at which the indication changed over to I_next (A.4.4.3). */
  additionalLoadGrams: Grams | null
  /** I_next — the next indication, (I + e), in the scale interval of the range it appears in. */
  nextIndicationGrams: Grams | null
  /** E₀ — error at zero or at a load close to zero, determined separately and entered. Signed. */
  zeroErrorGrams: Grams | null
}

/**
 * `evaluated` — every required input was present and admissible, so P, E, Ec and the verdict were
 * computed. `blocked` — at least one required input is missing or inadmissible: **no** intermediate
 * value and **no** verdict is produced, and the reason is reported instead.
 */
export type EvaluationStatus = 'evaluated' | 'blocked'

/** One reason why an observation cannot be evaluated, addressed to the field it belongs to. */
export interface ObservationIssue {
  ruleId: string
  severity: 'error'
  /** The observation field the message belongs to, or `null` for a statement about the whole set. */
  field: TestObservationField | null
  message: string
  detail?: string
  reference: RuleReference
  context?: Record<string, string | number | boolean | null>
}

/** One line of the deterministic calculation trace (ten steps, always the same order). */
export interface TraceStep {
  /** 1-based step number, as printed. */
  step: number
  /** What the step does, e.g. `Load range resolved`. */
  label: string
  /** What it produced, e.g. `Range 1 (20 g → 2 kg)`, or why it could not be completed. */
  value: string
  /** Clause the step rests on, when it rests on one. */
  clause: string | null
  /** `false` when a blocked input stopped the calculation at or before this step. */
  completed: boolean
}

/** The structured result of one evaluation. Field names follow the Phase 3 specification. */
export interface EvaluationResult {
  status: EvaluationStatus
  /** The observation exactly as entered, in grams. Never rounded, corrected or completed. */
  observation: TestObservationInput

  /**
   * The Phase 2 resolution, reused unchanged: range_L, range_I, range_I_next, e_L, e*, the mpe and
   * the two indication-consistency checks. Phase 3 adds no second range-resolution system.
   */
  resolution: TestConditionResolution

  /** Partial weighing range of the test load L. */
  range_L: RangeResolution
  /** Partial weighing range of the indication I. */
  range_I: RangeResolution
  /** Partial weighing range of the next indication I_next — the post-changeover range. */
  range_I_next: RangeResolution

  /** e of the partial weighing range containing L. The mpe belongs to this interval. */
  e_L: Grams | null
  /**
   * e* — e of the partial weighing range containing I_next, i.e. the range in which the indication
   * (I + e) appears. This is the interval the `½ e` term of A.4.4.3 takes, per its multi-interval
   * note. Never assumed equal to `e_L`.
   */
  e_star: Grams | null

  /** m = L / e_L — the load expressed in verification scale intervals (what Table 6 brackets). */
  m: number | null
  /** Table 6 coefficient of e for that bracket: 0.5, 1.0 or 1.5. */
  mpeCoefficient: number | null
  /** The Table 6 bracket itself, kept for the trace. */
  mpeBracket: Table6Row | null
  /** The absolute maximum permissible error on initial verification, in grams (± this value). */
  mpeGrams: Grams | null

  /** ½ e* — the rounding-error term of A.4.4.3, exposed because it is range-dependent. */
  halfEStarGrams: Grams | null
  /** P = I + ½ e* − ΔL — the indication prior to rounding. */
  P: Grams | null
  /** E = P − L — the error prior to rounding. Signed. */
  E: Grams | null
  /** E₀ — the zero error as entered. Signed. */
  E0: Grams | null
  /** Ec = E − E₀ — the corrected error prior to rounding. Signed. */
  Ec: Grams | null
  /** |Ec| — what the limit is compared with. */
  absoluteEcGrams: Grams | null
  /** mpe − |Ec|: positive means margin inside the limit, negative means excess, 0 means at the limit. */
  marginGrams: Grams | null

  /** `true` when |Ec| ≤ mpe, `false` when it exceeds it, `null` when nothing was calculated. */
  passed: boolean | null

  /** Why the evaluation was blocked. Empty when the status is `evaluated`. */
  issues: readonly ObservationIssue[]
  /** Every clause this result rests on, in calculation order. */
  references: readonly RuleReference[]
}

/**
 * One evaluation that was actually performed, kept together with everything it was produced from.
 *
 * A verdict is only meaningful for the instrument and the observation it was calculated from, so
 * both travel with the result: when the instrument under test changes, the stored evaluation is
 * recognised as belonging to a different instrument and is not shown again.
 */
export interface PerformedEvaluation {
  /** The normalized instrument the observation was evaluated against. */
  instrument: NormalizedInstrument
  /** The observation, in grams, exactly as it was evaluated. */
  input: TestObservationInput
  result: EvaluationResult
}

/** One line of the calculation as shown on screen: the formula, its substitution and its result. */
export interface CalculationLine {
  /** The formula, e.g. `P = I + ½e* − ΔL`. */
  formula: string
  /** The same formula with the entered values substituted, e.g. `P = 2000 g + 1 g − 1.4 g`. */
  substitution: string
  /** The result, signed where R-76 signs it, e.g. `= 1999.6 g`. */
  result: string
  clause: string
}
