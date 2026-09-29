import type { AccuracyClass, Grams } from '../models/instrument'
import { formatMass } from '../../utils/mass'
import {
  approximatelyGreaterThan,
  approximatelyLessOrEqual,
  approximatelyLessThan,
  withinInclusiveRange,
} from '../../utils/numeric'

/**
 * Verified reference data from OIML R 76-1:2006 (E).
 *
 * Every number in this file is transcribed from the Recommendation itself — see
 * `docs/r76-verified-extracts.md` for the quoted text, clause numbers and printed page numbers.
 * Nothing here is estimated, and no value has been "rounded to something sensible".
 *
 * The tables record all four accuracy classes because that is what the source document states.
 * Phase 1 *evaluates* class III only; `SUPPORTED_ACCURACY_CLASSES` (in ../models/instrument)
 * is what restricts the scope, not this data.
 */

export const R76_DOCUMENT_TITLE = 'OIML R 76-1:2006 (E)'

/**
 * One row of Table 3 (§3.2) — "Values of e, n and Min according to accuracy class".
 *
 * `n = Max / e` must lie in [nMin, nMax]; `nMax === null` reproduces the "–" of Table 3
 * (class I has no stated maximum).
 *
 * `minCapacityFactor` is the multiplier in the "Minimum capacity, Min (Lower limit)" column,
 * expressed against e. Per §3.4.3 the actual scale interval d replaces e in that column, so the
 * operative requirement is `Min >= minCapacityFactor * d`.
 */
export interface Table3Row {
  accuracyClass: AccuracyClass
  /** Inclusive lower bound of the verification scale interval band, in grams. */
  eLowerBoundGrams: Grams
  /** Inclusive upper bound of the band in grams, or `null` when the table states no upper bound. */
  eUpperBoundGrams: Grams | null
  /** Minimum number of verification scale intervals for this band. */
  nMin: number
  /** Maximum number of verification scale intervals, or `null` for the "–" of Table 3. */
  nMax: number | null
  /** Min (lower limit) = factor x e, with e replaced by d according to §3.4.3. */
  minCapacityFactor: number
}

/** OIML R 76-1:2006, §3.2, Table 3. */
export const R76_TABLE_3: readonly Table3Row[] = [
  // Special accuracy (I): 0.001 g <= e, 50 000 <= n, no maximum, Min = 100 e
  { accuracyClass: 'I', eLowerBoundGrams: 0.001, eUpperBoundGrams: null, nMin: 50_000, nMax: null, minCapacityFactor: 100 },
  // High accuracy (II): 0.001 g <= e <= 0.05 g, 100 <= n <= 100 000, Min = 20 e
  { accuracyClass: 'II', eLowerBoundGrams: 0.001, eUpperBoundGrams: 0.05, nMin: 100, nMax: 100_000, minCapacityFactor: 20 },
  // High accuracy (II): 0.1 g <= e, 5 000 <= n <= 100 000, Min = 50 e
  { accuracyClass: 'II', eLowerBoundGrams: 0.1, eUpperBoundGrams: null, nMin: 5_000, nMax: 100_000, minCapacityFactor: 50 },
  // Medium accuracy (III): 0.1 g <= e <= 2 g, 100 <= n <= 10 000, Min = 20 e
  { accuracyClass: 'III', eLowerBoundGrams: 0.1, eUpperBoundGrams: 2, nMin: 100, nMax: 10_000, minCapacityFactor: 20 },
  // Medium accuracy (III): 5 g <= e, 500 <= n <= 10 000, Min = 20 e
  { accuracyClass: 'III', eLowerBoundGrams: 5, eUpperBoundGrams: null, nMin: 500, nMax: 10_000, minCapacityFactor: 20 },
  // Ordinary accuracy (IIII): 5 g <= e, 100 <= n <= 1 000, Min = 10 e
  { accuracyClass: 'IIII', eLowerBoundGrams: 5, eUpperBoundGrams: null, nMin: 100, nMax: 1_000, minCapacityFactor: 10 },
]

/**
 * OIML R 76-1:2006, §3.3.3, Table 4 — "Maximum capacity of partial weighing ranges".
 *
 * For a multi-interval instrument, every partial weighing range except the last must satisfy
 * `Max_i / e_(i+1) >= TABLE_4[accuracy class]`.
 */
export const R76_TABLE_4: Readonly<Record<AccuracyClass, number>> = {
  I: 50_000,
  II: 5_000,
  III: 500,
  IIII: 50,
}

/**
 * One row of Table 6 (§3.5.1) — "Maximum permissible errors on initial verification".
 *
 * Table 6 is stated **"For loads, m, expressed in verification scale intervals, e"**, so a row
 * brackets the dimensionless quantity `m`, not a mass. For a MULTI-INTERVAL instrument the second
 * note of Table 6 ("For multi-interval instruments, refer to 3.3 (including the example)") makes
 * `e` the verification scale interval **of the partial weighing range that contains the load**:
 * `m = L / eᵢ` and the limit is `coefficient × eᵢ`.
 *
 * `mCellText` is the m-column cell exactly as printed, so a message can quote the bracket without
 * re-deriving it from the numbers.
 */
export interface Table6Row {
  accuracyClass: AccuracyClass
  /** Coefficient of e in the mpe column: 0.5, 1.0 or 1.5. */
  coefficient: number
  /** Exclusive lower bound of m, or `null` for the row printed as `0 ≤ m`. */
  mLowerBoundExclusive: number | null
  /** Inclusive upper bound of m, or `null` for the open-ended class I row `200 000 < m`. */
  mUpperBoundInclusive: number | null
  /** The m-column cell as printed, e.g. `500 < m ≤ 2 000`. */
  mCellText: string
}

/** OIML R 76-1:2006, §3.5.1, Table 6 — maximum permissible errors on initial verification. */
export const R76_TABLE_6_INITIAL_VERIFICATION: readonly Table6Row[] = [
  // Special accuracy (I)
  { accuracyClass: 'I', coefficient: 0.5, mLowerBoundExclusive: null, mUpperBoundInclusive: 50_000, mCellText: '0 ≤ m ≤ 50 000' },
  { accuracyClass: 'I', coefficient: 1.0, mLowerBoundExclusive: 50_000, mUpperBoundInclusive: 200_000, mCellText: '50 000 < m ≤ 200 000' },
  { accuracyClass: 'I', coefficient: 1.5, mLowerBoundExclusive: 200_000, mUpperBoundInclusive: null, mCellText: '200 000 < m' },
  // High accuracy (II)
  { accuracyClass: 'II', coefficient: 0.5, mLowerBoundExclusive: null, mUpperBoundInclusive: 5_000, mCellText: '0 ≤ m ≤ 5 000' },
  { accuracyClass: 'II', coefficient: 1.0, mLowerBoundExclusive: 5_000, mUpperBoundInclusive: 20_000, mCellText: '5 000 < m ≤ 20 000' },
  { accuracyClass: 'II', coefficient: 1.5, mLowerBoundExclusive: 20_000, mUpperBoundInclusive: 100_000, mCellText: '20 000 < m ≤ 100 000' },
  // Medium accuracy (III) — the only class this build evaluates
  { accuracyClass: 'III', coefficient: 0.5, mLowerBoundExclusive: null, mUpperBoundInclusive: 500, mCellText: '0 ≤ m ≤ 500' },
  { accuracyClass: 'III', coefficient: 1.0, mLowerBoundExclusive: 500, mUpperBoundInclusive: 2_000, mCellText: '500 < m ≤ 2 000' },
  { accuracyClass: 'III', coefficient: 1.5, mLowerBoundExclusive: 2_000, mUpperBoundInclusive: 10_000, mCellText: '2 000 < m ≤ 10 000' },
  // Ordinary accuracy (IIII)
  { accuracyClass: 'IIII', coefficient: 0.5, mLowerBoundExclusive: null, mUpperBoundInclusive: 50, mCellText: '0 ≤ m ≤ 50' },
  { accuracyClass: 'IIII', coefficient: 1.0, mLowerBoundExclusive: 50, mUpperBoundInclusive: 200, mCellText: '50 < m ≤ 200' },
  { accuracyClass: 'IIII', coefficient: 1.5, mLowerBoundExclusive: 200, mUpperBoundInclusive: 1_000, mCellText: '200 < m ≤ 1 000' },
]

/** All Table 3 rows of one accuracy class, in table order. */
export function table3RowsFor(accuracyClass: AccuracyClass): readonly Table3Row[] {
  return R76_TABLE_3.filter((row) => row.accuracyClass === accuracyClass)
}

/**
 * The Table 3 row that a verification scale interval belongs to, or `null` when the interval
 * falls outside every band of the class (e.g. e = 3 g or e = 0.05 g for class III, which has
 * no row covering 2 g < e < 5 g or e < 0.1 g).
 */
export function findTable3Row(accuracyClass: AccuracyClass, eGrams: Grams): Table3Row | null {
  return (
    table3RowsFor(accuracyClass).find((row) =>
      withinInclusiveRange(eGrams, row.eLowerBoundGrams, row.eUpperBoundGrams),
    ) ?? null
  )
}

/** Human readable e band of a Table 3 row, e.g. `0.1 g <= e <= 2 g` or `5 g <= e`. */
export function describeTable3Band(row: Table3Row): string {
  const lower = formatMass(row.eLowerBoundGrams)
  if (row.eUpperBoundGrams === null) return `${lower} ≤ e`
  return `${lower} ≤ e ≤ ${formatMass(row.eUpperBoundGrams)}`
}

/** Human readable union of all e bands of one class, used when no band matches. */
export function describeTable3Bands(accuracyClass: AccuracyClass): string {
  return table3RowsFor(accuracyClass)
    .map((row) => describeTable3Band(row))
    .join('  or  ')
}

/** Human readable n limits of a Table 3 row, e.g. `100 <= n <= 10 000`. */
export function describeTable3NLimits(row: Table3Row): string {
  const max = row.nMax === null ? 'no maximum' : `n ≤ ${row.nMax.toLocaleString('en-US')}`
  return `n ≥ ${row.nMin.toLocaleString('en-US')}` + (row.nMax === null ? '' : ` and ${max}`)
}

/** All Table 6 rows of one accuracy class, in table order (lowest bracket first). */
export function table6RowsFor(accuracyClass: AccuracyClass): readonly Table6Row[] {
  return R76_TABLE_6_INITIAL_VERIFICATION.filter((row) => row.accuracyClass === accuracyClass)
}

/**
 * The Table 6 bracket that `m` falls into, or `null` when no bracket of the class contains it
 * (m not finite, m < 0, or m beyond the last bracket the table states for that class).
 *
 * Brackets are contiguous and half-open — `lower < m ≤ upper` — so an m exactly on a bracket
 * boundary belongs to the LOWER bracket. That is the reading the §3.3.3 example confirms:
 * 500 g → ±0.5 e₁, 2 000 g → ±1 e₁, 4 000 g → ±1 e₂, 5 000 g → ±1.5 e₂.
 */
export function findTable6Row(accuracyClass: AccuracyClass, m: number): Table6Row | null {
  if (!Number.isFinite(m) || approximatelyLessThan(m, 0)) return null

  const row = table6RowsFor(accuracyClass).find((candidate) => {
    const aboveLowerBound =
      candidate.mLowerBoundExclusive === null || approximatelyGreaterThan(m, candidate.mLowerBoundExclusive)
    const belowUpperBound =
      candidate.mUpperBoundInclusive === null || approximatelyLessOrEqual(m, candidate.mUpperBoundInclusive)
    return aboveLowerBound && belowUpperBound
  })

  return row ?? null
}

/** The mpe column of Table 6 as printed, e.g. `± 1.0 e`. */
export function describeMpeCoefficient(coefficient: number): string {
  return `± ${coefficient.toFixed(1)} e`
}

/** A whole Table 6 bracket, e.g. `500 < m ≤ 2 000 → ± 1.0 e`. */
export function describeTable6Row(row: Table6Row): string {
  return `${row.mCellText} → ${describeMpeCoefficient(row.coefficient)}`
}
