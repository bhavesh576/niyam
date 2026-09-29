import type { AccuracyClass, Grams } from '../models/instrument'
import type { Table6Row } from '../constants/r76Tables'
import type { RuleReference } from '../validation/types'

/**
 * Result model of Phase 2: range resolution and MPE resolution.
 *
 * Everything here is pure data, in grams, produced by functions that know nothing about React.
 * The three quantities a test observation carries are resolved INDEPENDENTLY, because a
 * multi-interval instrument takes `e` "according to the load applied" (§3.3.3):
 *
 * ```text
 * L       -> partial weighing range of the load        -> e_L
 * I       -> partial weighing range of the indication  -> e_I
 * I_next  -> partial weighing range of the next indication -> e*   (e* is NOT e_L by construction)
 * ```
 *
 * There is deliberately no instrument-wide `e` anywhere in this model. `e_L`, `e_I` and `e*` each
 * come from the partial weighing range that was resolved for that one quantity, and `null` means
 * "no partial weighing range contains this value" — never "fall back to e₁".
 *
 * Phase 2 resolves ranges and limits only. Errors of indication (E, E₀, Ec), ΔL, PASS/FAIL and
 * report generation are NOT part of this model.
 */

/** What a resolution was performed on. Used for labels and for the calculation trace. */
export type ResolvedQuantity = 'load' | 'indication' | 'next-indication'

/**
 * Outcome of asking "which partial weighing range contains this value?".
 *
 * `resolved`            — the value lies inside the weighing range Min → Max.
 * `below-weighing-range` — the value is below Min (T.3.1.2: below Min the weighing results may be
 *                         subject to an excessive relative error). No partial range applies.
 * `above-weighing-range` — the value is above Max = Max_r. No partial range applies.
 * `not-a-value`         — nothing usable was entered (empty, unparsable, negative or not finite).
 */
export type RangeResolutionStatus =
  | 'resolved'
  | 'below-weighing-range'
  | 'above-weighing-range'
  | 'not-a-value'

/**
 * The partial weighing range a value was resolved into (§3.3.1).
 *
 * Membership follows the §3.3.3 example, which is `(Minᵢ, Maxᵢ]` for i ≥ 2 and `[Min, Max₁]` for
 * i = 1: a value exactly equal to Maxᵢ still belongs to range i (2 000 g → range 1, ±1 e₁), and the
 * next value above it belongs to range i + 1 (2 001 g → range 2, ±1 e₂).
 */
export interface ResolvedRange {
  /** 0-based index into `NormalizedInstrument.ranges`. */
  index: number
  /** 1-based range number as shown to the user. */
  rangeNumber: number
  /** Minᵢ — lower bound of this partial weighing range (= Maxᵢ₋₁, and Min₁ = Min). */
  lowerBoundGrams: Grams
  /** Maxᵢ — upper bound of this partial weighing range. */
  upperBoundGrams: Grams
  /** eᵢ — the verification scale interval that applies to this range. */
  verificationIntervalGrams: Grams
  /** nᵢ = Maxᵢ / eᵢ (§3.3.1). */
  verificationIntervals: number
  /** `true` for the final partial weighing range (Max_r = Max). */
  isLast: boolean
  /** `true` when the resolved value sits exactly on Maxᵢ — a partial-range boundary. */
  atUpperBound: boolean
  /** `true` when the resolved value sits exactly on Minᵢ (for range 1: exactly on Min). */
  atLowerBound: boolean
}

/** The resolution of one quantity (L, I or I_next). */
export interface RangeResolution {
  /** Which quantity this resolution describes. */
  quantity: ResolvedQuantity
  /** Symbol used in R-76 and on screen: `L`, `I`, `I_next`. */
  symbol: 'L' | 'I' | 'I_next'
  /** The value in grams, or `null` when nothing usable was entered. */
  valueGrams: Grams | null
  status: RangeResolutionStatus
  /** The resolved partial weighing range, or `null` when the status is not `resolved`. */
  range: ResolvedRange | null
  /**
   * The verification scale interval that applies to this value — always `eᵢ` of the resolved
   * partial weighing range, and `null` when no partial weighing range contains the value.
   */
  applicableIntervalGrams: Grams | null
  /** Clause provenance, carried so the calculation can be traced back to the Recommendation. */
  sourceReference: RuleReference
  /**
   * For an INDICATION only: whether the value can actually be displayed in the resolved partial
   * weighing range, i.e. whether it is an exact multiple of that range's scale interval (= eᵢ).
   *
   * A digital indication shows values one scale interval apart (T.3.2.2), each partial weighing
   * range of a multi-interval instrument has its own scale interval (T.3.2.6), and for this
   * instrument type e = d (Table 2 with §3.4.1) — so the allowed indications of partial weighing
   * range i are the multiples of eᵢ (§4.2.2.2 prints them as "Allowed indications").
   *
   * `null` for the test load: a load is applied mass, not a displayed value, and need not be a
   * multiple of e. Keeping the two apart is the point of this field.
   */
  displayable: boolean | null
}

/**
 * The three range resolutions of one test condition, plus the two intervals Phase 3 will need.
 *
 * Field names match the Phase 2 specification (`range_L`, `range_I`, `range_I_next`, `e_L`, `e_star`)
 * so a reviewer can read the spec and the code side by side.
 */
export interface RangeResolutionResult {
  /** Partial weighing range containing the test load L. */
  range_L: RangeResolution
  /** Partial weighing range containing the indication I. */
  range_I: RangeResolution
  /** Partial weighing range containing the next indication I_next. */
  range_I_next: RangeResolution
  /** e of the partial weighing range containing L. `null` when L did not resolve. */
  e_L: Grams | null
  /**
   * e* — e of the partial weighing range containing **I_next**, i.e. the interval that applies on
   * the other side of a range changeover. Resolved from I_next, never copied from `e_L`
   * (§3.3.3: "e is to be taken according to the load applied").
   *
   * `null` when I_next did not resolve into a partial weighing range, **and also when I_next is not
   * a displayable indication of the range it falls in** (see {@link IndicationCheck}): an interval
   * must not be handed to a later phase on the strength of an indication the instrument cannot
   * show. The entered value is never rounded or replaced to make it fit.
   */
  e_star: Grams | null
}

/**
 * Outcome of resolving the maximum permissible error on initial verification (§3.5.1, Table 6).
 *
 * `resolved`                  — L resolved into a partial range, m = L / e_L fell into a Table 6
 *                               bracket, and the absolute limit was computed.
 * `no-load-value`             — no usable test load was entered.
 * `load-outside-weighing-range` — L is below Min or above Max; Table 6 does not apply because no
 *                               partial weighing range (and therefore no e) applies.
 * `outside-table-6`           — m = L / e_L could not be formed, or lies beyond every bracket
 *                               Table 6 states for the class. Cannot occur for a configuration
 *                               that passed Table 3 validation (n ≤ 10 000 for class III); it is
 *                               reported rather than extrapolated.
 */
export type MpeResolutionStatus =
  | 'resolved'
  | 'no-load-value'
  | 'load-outside-weighing-range'
  | 'outside-table-6'

export interface MpeResolutionResult {
  status: MpeResolutionStatus
  /** The accuracy class the Table 6 column was taken from. */
  accuracyClass: AccuracyClass
  /** The test load in grams, as passed in. */
  loadGrams: Grams | null
  /**
   * e_L — the verification scale interval of the partial weighing range that contains L.
   * `null` when no partial weighing range contains L. Never a global `e`, never `e₁` by default.
   */
  verificationIntervalGrams: Grams | null
  /** m = L / e_L, expressed in verification scale intervals (the quantity Table 6 brackets). */
  m: number | null
  /** The Table 6 row (bracket) that m falls into, kept for the calculation trace. */
  bracket: Table6Row | null
  /** Coefficient of e from the bracket: 0.5, 1.0 or 1.5. `null` when unresolved. */
  coefficient: number | null
  /**
   * The `absoluteMpe` of the specification, in grams: `coefficient × e_L`.
   * Per the Table 6 note this is the value of the mpe **without** the positive or negative sign;
   * the limit on the error is ± this value.
   */
  absoluteMpeGrams: Grams | null
  /** Clause provenance (Table 6 plus, for a multi-interval instrument, the §3.3.3 example). */
  sourceReference: RuleReference
}

/**
 * Outcome of checking one indication against the scale interval of the partial weighing range it
 * was resolved into.
 *
 * `not-entered`    — the field is empty or unparsable; both indications are optional in this phase.
 * `not-resolved`   — a value was entered but it lies outside the weighing range, so no partial
 *                    weighing range (and therefore no scale interval) applies to it. The
 *                    consistency rule has nothing to check; the range resolution reports it.
 * `consistent`     — the value is an exact multiple of the scale interval of its range: it is an
 *                    indication the instrument can actually display.
 * `not-displayable` — the value falls inside a partial weighing range but is NOT a multiple of that
 *                    range's scale interval (e.g. 2 001 g in a range whose e = 2 g). Rejected.
 */
export type IndicationConsistencyStatus =
  | 'not-entered'
  | 'not-resolved'
  | 'consistent'
  | 'not-displayable'

export interface IndicationCheck {
  quantity: ResolvedQuantity
  symbol: 'I' | 'I_next'
  /** Key of the field in `TestConditionDraft`, so the message can be shown beside its input. */
  field: 'indication' | 'nextIndication'
  /** The value exactly as entered (converted to grams). Never rounded, never corrected. */
  valueGrams: Grams | null
  status: IndicationConsistencyStatus
  /** `true` unless the status is `not-displayable`. */
  accepted: boolean
  /** Partial weighing range the value was resolved into, when it resolved. */
  resolvedRangeNumber: number | null
  /** Scale interval of that range (= eᵢ), when it resolved. */
  indicationIntervalGrams: Grams | null
  /** value / eᵢ — an integer for a displayable indication, fractional for a rejected one. */
  intervalsOfIndication: number | null
  /** Rejection message, or `null` when the indication is accepted. */
  message: string | null
  /** The clauses the rejection rests on, with the worked changeover value where applicable. */
  detail: string | null
  /** Stable rule identifier, for the trace and for tests. */
  ruleId: string | null
  reference: RuleReference
}

/** The three masses of one test observation, in grams (`null` = not entered / unparsable). */
export interface TestConditionInput {
  /** L — test load. Required for an MPE resolution. */
  loadGrams: Grams | null
  /** I — indication of the instrument under that load. Optional in this phase. */
  indicationGrams: Grams | null
  /** I_next — next indication (after a range changeover). Optional in this phase. */
  nextIndicationGrams: Grams | null
}

/** Everything Phase 2 resolves for one test condition. */
export interface TestConditionResolution {
  ranges: RangeResolutionResult
  mpe: MpeResolutionResult
  /** Consistency of the indication I with the scale interval of the range it resolves into. */
  check_I: IndicationCheck
  /** Consistency of the next indication I_next — the changeover step — with its own range. */
  check_I_next: IndicationCheck
  /** `true` when neither indication was rejected. */
  indicationsAccepted: boolean
  /** The rejected indication checks, in field order. Empty when both are accepted. */
  issues: readonly IndicationCheck[]
}
