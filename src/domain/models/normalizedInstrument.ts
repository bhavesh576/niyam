import type { AccuracyClass, Grams, InstrumentType } from './instrument'
import type { Table3Row } from '../constants/r76Tables'

/**
 * Normalized range model.
 *
 * This is the shape the later evaluation phases (range resolution, MPE, E / Ec) will consume.
 * It is derived from a validated {@link InstrumentConfig} and makes the range structure of a
 * MULTI-INTERVAL instrument explicit: one continuous weighing range Min -> Max, cut into
 * partial weighing ranges at Max_1, Max_2, ... (§3.3.1).
 *
 * ```text
 * partial range 1:  Min     -> Max_1   with e_1, n_1 = Max_1 / e_1
 * partial range 2:  Max_1   -> Max_2   with e_2, n_2 = Max_2 / e_2
 * partial range 3:  Max_2   -> Max_3   with e_3, n_3 = Max_3 / e_3   (Max_3 = Max)
 * ```
 *
 * A MULTIPLE-RANGE instrument (several independent weighing ranges, each starting at its own
 * zero) is a different model and is deliberately not represented here in Phase 1.
 */

export interface NormalizedPartialRange {
  /** 1-based range number as shown to the user (range 1, range 2, ...). */
  rangeNumber: number
  /** 0-based index into `InstrumentConfig.ranges`; used by validation field paths. */
  index: number
  /** Identifier carried over from the configuration entry. */
  id: string
  /** Min_i — lower bound. §3.3.1: Min_i = Max_(i-1), and Min_1 = Min. */
  lowerBoundGrams: Grams
  /** Max_i — upper bound of this partial weighing range. */
  upperBoundGrams: Grams
  /** e_i — verification scale interval of this partial weighing range. */
  verificationIntervalGrams: Grams
  /** n_i = Max_i / e_i (§3.3.1). May be fractional; see `verificationIntervalsAreExact`. */
  verificationIntervals: number
  /** `true` when Max_i is an exact integer multiple of e_i. */
  verificationIntervalsAreExact: boolean
  /** Table 3 row selected by e_i, or `null` when e_i is outside every band of the class. */
  table3Row: Table3Row | null
  /** Max_i / e_(i+1) — the Table 4 quantity (§3.3.3). `null` for the last partial range. */
  table4Ratio: number | null
  /** `true` for the final partial weighing range (Max_r = Max). */
  isLast: boolean
}

export interface NormalizedInstrument {
  instrumentType: InstrumentType
  accuracyClass: AccuracyClass
  /** Min (= Min_1) — lower limit of the single weighing range. */
  minCapacityGrams: Grams
  /** d — actual scale interval. For a multi-interval instrument without an auxiliary
   *  indicating device, Table 2 requires e = d, hence d = e_1. */
  displayDivisionGrams: Grams
  /** Max (= Max_r) — maximum capacity of the instrument. */
  maxCapacityGrams: Grams
  /** Number of partial weighing ranges. */
  rangeCount: number
  /** Partial weighing ranges in increasing order of e (§3.3.1). */
  ranges: NormalizedPartialRange[]
}
