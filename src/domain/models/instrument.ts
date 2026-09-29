/**
 * Core instrument model — Phase 1 scope: multi-interval NAWI, accuracy class III.
 *
 * UNIT CONVENTION (important)
 * ---------------------------
 * Every mass in the domain layer is expressed in GRAMS and typed as {@link Grams}.
 * Grams is the unit in which OIML R 76-1:2006 states the limits of Table 3
 * (0.1 g <= e <= 2 g, 5 g <= e, Min = 20 e, ...), so the evaluation logic never
 * performs kg/g arithmetic. Conversion happens once, at the form boundary
 * (see `InstrumentDraft` in ./draft.ts).
 *
 * A field that the user has not filled in (or filled in with something that cannot be
 * parsed as a mass) is represented as `null` — never as 0 or NaN — so that the validator
 * can report "not entered" separately from "entered but out of limits".
 */

/** Mass expressed in grams — the canonical internal unit of this application. */
export type Grams = number;

/**
 * Accuracy classes of Table 1 (§3.1.1).
 * Phase 1 evaluates class III only; the other members exist because Table 3 / Table 4
 * are recorded as verified reference data and because an out-of-scope class must be
 * reportable as a validation error rather than being unrepresentable.
 */
export type AccuracyClass = 'I' | 'II' | 'III' | 'IIII';

export const ACCURACY_CLASS_LABELS: Record<AccuracyClass, string> = {
  I: 'Class I — Special accuracy',
  II: 'Class II — High accuracy',
  III: 'Class III — Medium accuracy',
  IIII: 'Class IIII — Ordinary accuracy',
}

/** Accuracy classes the evaluator supports in this phase. */
export const SUPPORTED_ACCURACY_CLASSES: readonly AccuracyClass[] = ['III']

/**
 * Instrument types distinguished by OIML R 76-1:2006.
 *
 * `multi-interval` — ONE weighing range divided into partial weighing ranges, each with a
 * different verification scale interval (§3.3, T.3.2.6). Implemented in Phase 1.
 * `multiple-range` — several weighing ranges, each treated as an instrument with one range
 * (§3.2 note). NOT implemented in Phase 1.
 * `single-interval` — one weighing range, one verification scale interval. NOT implemented
 * in Phase 1 (the configuration screen is dedicated to multi-interval instruments).
 */
export type InstrumentType = 'single-interval' | 'multi-interval' | 'multiple-range'

export const INSTRUMENT_TYPE_LABELS: Record<InstrumentType, string> = {
  'single-interval': 'Single-interval instrument',
  'multi-interval': 'Multi-interval instrument',
  'multiple-range': 'Multiple-range instrument',
}

/** Instrument types the evaluator supports in this phase. */
export const SUPPORTED_INSTRUMENT_TYPES: readonly InstrumentType[] = ['multi-interval']

/**
 * One partial weighing range as entered by the user.
 *
 * `e` belongs to the partial range, NOT to the instrument: a multi-interval instrument has
 * e_1 < e_2 < ... < e_r (§3.3.1). There is deliberately no instrument-wide `e` field.
 */
export interface PartialRange {
  /** Stable identifier, used for list keys. Not part of the R-76 data model. */
  id: string
  /** Max_i — maximum capacity of this partial weighing range, in grams. */
  maxCapacityGrams: Grams | null
  /** e_i — verification scale interval of this partial weighing range, in grams. */
  verificationIntervalGrams: Grams | null
}

/**
 * Instrument configuration under evaluation.
 *
 * ```text
 * InstrumentConfig
 *  ├── instrumentType        multi-interval (Phase 1)
 *  ├── accuracyClass         III (Phase 1)
 *  ├── minCapacityGrams      Min  (= Min_1, §3.3.1)
 *  ├── displayDivisionGrams  d    (actual scale interval, T.3.2.2)
 *  └── ranges[]              partial weighing ranges, ordered by increasing e (§3.3.1)
 * ```
 */
export interface InstrumentConfig {
  instrumentType: InstrumentType
  accuracyClass: AccuracyClass
  /** Min — minimum capacity of the instrument, in grams (§3.4.3, T.3.1.2). */
  minCapacityGrams: Grams | null
  /** d — actual scale interval, in grams (T.3.2.2). */
  displayDivisionGrams: Grams | null
  /** Partial weighing ranges, in range order (range 1 first). */
  ranges: PartialRange[]
}

/** Creates a partial range with a stable identifier. */
export function createPartialRange(
  maxCapacityGrams: Grams | null = null,
  verificationIntervalGrams: Grams | null = null,
  id: string = createRangeId(),
): PartialRange {
  return { id, maxCapacityGrams, verificationIntervalGrams }
}

let rangeIdSequence = 0

/**
 * Identifier factory for partial ranges.
 * Deliberately dependency-free and deterministic (no `crypto.randomUUID`) so that the same
 * code runs unchanged in the browser and in the unit tests.
 */
export function createRangeId(): string {
  rangeIdSequence += 1
  return `range-${rangeIdSequence}`
}

/** Test/reset helper for the identifier sequence. */
export function resetRangeIdSequence(): void {
  rangeIdSequence = 0
}
