import { describe, expect, it } from 'vitest'
import { officialExampleInstrument } from '../../testing/fixtures'
import { evaluateDigitalWeighingObservation } from '../evaluation/evaluateObservation'
import type { PerformedEvaluation, TestObservationInput } from '../evaluation/types'
import { buildWeighingReport } from './buildReport'
import type { WeighingReport } from './types'

/**
 * Phase 5 §14 — the boundary matrix.
 *
 * The official example of §3.3.3 (Min = 20 g; Max₁ = 2 kg / e₁ = 1 g; Max₂ = 5 kg / e₂ = 2 g;
 * Max = Max₃ = 15 kg / e₃ = 10 g) is probed at six positions: just below, exactly at and just above
 * each of the two range changeovers. At every position a *valid* changeover observation is entered
 * — I a displayable indication of the range of L's neighbourhood, I_next exactly one interval e*
 * higher — and the five resolution values are checked:
 *
 *   range_L · range_I · range_I_next · e_L · e*
 *
 * together with the limit they produce (m = L / e_L → Table 6 bracket → mpe) and the arithmetic of
 * A.4.4.3 (P = I + ½ e* − ΔL, E = P − L, Ec = E − E₀).
 *
 * Two things this matrix is there to catch:
 *
 * 1. **Silent rounding at a boundary.** `m` is fractional at three of the six positions (1 000.5,
 *    2 499.5, 500.1) and the entered grams are compared by identity against what the result carries,
 *    so any value quietly rounded, snapped to a boundary or replaced by a "convenient" one fails.
 * 2. **A report that disagrees with the calculation.** Each position is also run through the report
 *    builder and the same five values, the same m, bracket and mpe are read back out of the document
 *    model — the table cells, the two transparency chains and the verdict.
 */

const instrument = officialExampleInstrument()
const GENERATED_AT = new Date(2026, 8, 29, 19, 41)

interface BoundaryPosition {
  /** What this row is, printed in the test name. */
  label: string
  /** L, I, ΔL, I_next in grams; E₀ is 0 at every position so that Ec = E. */
  load: number
  indication: number
  additionalLoad: number
  nextIndication: number
  /** The five resolution values. */
  range_L: number
  range_I: number
  range_I_next: number
  e_L: number
  e_star: number
  /** The limit: m = L / e_L, its Table 6 bracket, the coefficient of e and the absolute mpe. */
  m: number
  bracket: string
  coefficient: string
  mpe: number
  /** The arithmetic: P, E, Ec — and the verdict that follows from |Ec| ≤ mpe. */
  P: number
  E: number
  Ec: number
  passed: boolean
  /** How the document prints the resolved ranges and intervals. */
  loadRangeText: string
  loadIntervalText: string
  nextIndicationRangeText: string
  changeoverIntervalText: string
}

const POSITIONS: readonly BoundaryPosition[] = [
  {
    label: 'just below Max₁ — L = 1 999 g',
    load: 1_999,
    indication: 1_999,
    additionalLoad: 0.1,
    nextIndication: 2_000,
    range_L: 1,
    range_I: 1,
    range_I_next: 1,
    e_L: 1,
    e_star: 1,
    m: 1_999,
    bracket: '500 < m ≤ 2 000',
    coefficient: '1.0 e₁',
    mpe: 1,
    P: 1_999.4,
    E: 0.4,
    Ec: 0.4,
    passed: true,
    loadRangeText: 'Range 1 (20 g → 2 kg)',
    loadIntervalText: 'e_L = e₁ = 1 g',
    nextIndicationRangeText: 'Range 1 (20 g → 2 kg)',
    changeoverIntervalText: 'e* = e₁ = 1 g',
  },
  {
    label: 'exactly at Max₁ — L = 2 kg, the changeover into range 2',
    load: 2_000,
    indication: 2_000,
    additionalLoad: 0.2,
    nextIndication: 2_002,
    range_L: 1,
    range_I: 1,
    range_I_next: 2,
    e_L: 1,
    e_star: 2,
    m: 2_000,
    bracket: '500 < m ≤ 2 000',
    coefficient: '1.0 e₁',
    mpe: 1,
    P: 2_000.8,
    E: 0.8,
    Ec: 0.8,
    passed: true,
    loadRangeText: 'Range 1 (20 g → 2 kg)',
    loadIntervalText: 'e_L = e₁ = 1 g',
    nextIndicationRangeText: 'Range 2 (2 kg → 5 kg)',
    changeoverIntervalText: 'e* = e₂ = 2 g',
  },
  {
    label: 'just above Max₁ — L = 2 001 g',
    load: 2_001,
    indication: 2_002,
    additionalLoad: 0.2,
    nextIndication: 2_004,
    range_L: 2,
    range_I: 2,
    range_I_next: 2,
    e_L: 2,
    e_star: 2,
    m: 1_000.5,
    bracket: '500 < m ≤ 2 000',
    coefficient: '1.0 e₂',
    mpe: 2,
    P: 2_002.8,
    E: 1.8,
    Ec: 1.8,
    passed: true,
    loadRangeText: 'Range 2 (2 kg → 5 kg)',
    loadIntervalText: 'e_L = e₂ = 2 g',
    nextIndicationRangeText: 'Range 2 (2 kg → 5 kg)',
    changeoverIntervalText: 'e* = e₂ = 2 g',
  },
  {
    label: 'just below Max₂ — L = 4 999 g',
    load: 4_999,
    indication: 4_998,
    additionalLoad: 0.2,
    nextIndication: 5_000,
    range_L: 2,
    range_I: 2,
    range_I_next: 2,
    e_L: 2,
    e_star: 2,
    m: 2_499.5,
    bracket: '2 000 < m ≤ 10 000',
    coefficient: '1.5 e₂',
    mpe: 3,
    P: 4_998.8,
    E: -0.2,
    Ec: -0.2,
    passed: true,
    loadRangeText: 'Range 2 (2 kg → 5 kg)',
    loadIntervalText: 'e_L = e₂ = 2 g',
    nextIndicationRangeText: 'Range 2 (2 kg → 5 kg)',
    changeoverIntervalText: 'e* = e₂ = 2 g',
  },
  {
    label: 'exactly at Max₂ — L = 5 kg, the changeover into range 3',
    load: 5_000,
    indication: 5_000,
    additionalLoad: 3,
    nextIndication: 5_010,
    range_L: 2,
    range_I: 2,
    range_I_next: 3,
    e_L: 2,
    e_star: 10,
    m: 2_500,
    bracket: '2 000 < m ≤ 10 000',
    coefficient: '1.5 e₂',
    mpe: 3,
    P: 5_002,
    E: 2,
    Ec: 2,
    passed: true,
    loadRangeText: 'Range 2 (2 kg → 5 kg)',
    loadIntervalText: 'e_L = e₂ = 2 g',
    nextIndicationRangeText: 'Range 3 (5 kg → 15 kg)',
    changeoverIntervalText: 'e* = e₃ = 10 g',
  },
  {
    label: 'just above Max₂ — L = 5 001 g',
    load: 5_001,
    indication: 5_010,
    additionalLoad: 5,
    nextIndication: 5_020,
    range_L: 3,
    range_I: 3,
    range_I_next: 3,
    e_L: 10,
    e_star: 10,
    m: 500.1,
    bracket: '500 < m ≤ 2 000',
    coefficient: '1.0 e₃',
    mpe: 10,
    P: 5_010,
    E: 9,
    Ec: 9,
    passed: true,
    loadRangeText: 'Range 3 (5 kg → 15 kg)',
    loadIntervalText: 'e_L = e₃ = 10 g',
    nextIndicationRangeText: 'Range 3 (5 kg → 15 kg)',
    changeoverIntervalText: 'e* = e₃ = 10 g',
  },
]

function observationOf(position: BoundaryPosition): TestObservationInput {
  return {
    loadGrams: position.load,
    indicationGrams: position.indication,
    additionalLoadGrams: position.additionalLoad,
    nextIndicationGrams: position.nextIndication,
    zeroErrorGrams: 0,
  }
}

function evaluatedAt(position: BoundaryPosition): PerformedEvaluation {
  const input = observationOf(position)
  return { instrument, input, result: evaluateDigitalWeighingObservation(instrument, input) }
}

/** The document for one position, or the readiness reasons when the gate refused it. */
function reportAt(position: BoundaryPosition): WeighingReport {
  const outcome = buildWeighingReport({
    instrument,
    evaluation: evaluatedAt(position),
    generatedAt: GENERATED_AT,
  })
  if (outcome.status !== 'ready') {
    throw new Error(`no report at ${position.label}: ${outcome.reasons.join(' | ')}`)
  }
  return outcome.report
}

describe('boundary matrix — resolution and limit below, at and above each range changeover', () => {
  it.each(POSITIONS)('resolves $label', (position) => {
    const { result } = evaluatedAt(position)

    // Nothing was rejected, rounded or completed on the way: the observation is the one entered.
    expect(result.status).toBe('evaluated')
    expect(result.issues).toHaveLength(0)
    expect(result.observation.loadGrams).toBe(position.load)
    expect(result.observation.indicationGrams).toBe(position.indication)
    expect(result.observation.additionalLoadGrams).toBe(position.additionalLoad)
    expect(result.observation.nextIndicationGrams).toBe(position.nextIndication)

    // The five resolution values.
    expect(result.range_L.range?.rangeNumber).toBe(position.range_L)
    expect(result.range_I.range?.rangeNumber).toBe(position.range_I)
    expect(result.range_I_next.range?.rangeNumber).toBe(position.range_I_next)
    expect(result.e_L).toBe(position.e_L)
    expect(result.e_star).toBe(position.e_star)

    // The limit that follows from range_L and e_L alone: m, its Table 6 bracket, the mpe.
    expect(result.m).toBeCloseTo(position.m, 9)
    expect(result.mpeBracket?.mCellText).toBe(position.bracket)
    expect(result.mpeGrams).toBe(position.mpe)
    expect(result.halfEStarGrams).toBe(position.e_star / 2)

    // The arithmetic of A.4.4.3, with the ½ e term taken from e* and never from e_L.
    expect(result.P).toBeCloseTo(position.P, 9)
    expect(result.E).toBeCloseTo(position.E, 9)
    expect(result.Ec).toBeCloseTo(position.Ec, 9)
    expect(result.passed).toBe(position.passed)
  })

  it.each(POSITIONS)('reports $label with the same values', (position) => {
    const { result } = evaluatedAt(position)
    const report = reportAt(position)
    const point = report.testPoints[0]

    // Identity, not a second expectation of the arithmetic: the grams the document carries are the
    // grams the evaluation produced.
    expect(point.observation.load.grams).toBe(result.observation.loadGrams)
    expect(point.context.loadInterval.grams).toBe(result.e_L)
    expect(point.context.changeoverInterval.grams).toBe(result.e_star)
    expect(point.calculation.p.grams).toBe(result.P)
    expect(point.calculation.e.grams).toBe(result.E)
    expect(point.calculation.ec.grams).toBe(result.Ec)
    expect(point.compliance.mpe.grams).toBe(result.mpeGrams)
    expect(point.compliance.intervalCount).toBe(result.m)

    // And the same values as printed: the table cells, the range and interval labels, the bracket.
    expect(point.context.loadRange.rangeNumber).toBe(position.range_L)
    expect(point.context.indicationRange.rangeNumber).toBe(position.range_I)
    expect(point.context.nextIndicationRange.rangeNumber).toBe(position.range_I_next)
    expect(point.context.loadRange.text).toBe(position.loadRangeText)
    expect(point.context.loadInterval.text).toBe(position.loadIntervalText)
    expect(point.context.nextIndicationRange.text).toBe(position.nextIndicationRangeText)
    expect(point.context.changeoverInterval.text).toBe(position.changeoverIntervalText)
    expect(point.compliance.bracketText).toBe(position.bracket)
    expect(point.compliance.coefficientText).toContain(position.coefficient)
    expect(point.compliance.mpe.tableText).toBe(`± ${position.mpe}`)
    expect(point.compliance.verdict).toBe(position.passed ? 'PASS' : 'FAIL')
    expect(report.result.verdict).toBe(position.passed ? 'PASS' : 'FAIL')

    // The two transparency chains of the document name the same ranges, intervals and bracket.
    expect(point.context.limitChain).toContain(position.loadRangeText)
    expect(point.context.limitChain).toContain(position.loadIntervalText)
    expect(point.context.limitChain).toContain(position.bracket)
    expect(point.context.changeoverChain).toContain(position.nextIndicationRangeText)
    expect(point.context.changeoverChain).toContain(position.changeoverIntervalText)
  })
})

describe('boundary matrix — what the changeover positions prove', () => {
  it('keeps a load equal to Max₁ or Max₂ in the lower partial weighing range', () => {
    const atMax1 = evaluatedAt(POSITIONS[1]!).result
    const atMax2 = evaluatedAt(POSITIONS[4]!).result

    // §3.3.3 example: 2 000 g → ± 1 e₁, 2 001 g → ± 1 e₂. The bound belongs to the range below it.
    expect(atMax1.range_L.range?.atUpperBound).toBe(true)
    expect(atMax1.e_L).toBe(1)
    expect(atMax1.mpeGrams).toBe(1)
    expect(atMax2.range_L.range?.atUpperBound).toBe(true)
    expect(atMax2.e_L).toBe(2)
    expect(atMax2.mpeGrams).toBe(3)
  })

  it('resolves e* from I_next alone at both changeovers, so that e* ≠ e_L', () => {
    const atMax1 = evaluatedAt(POSITIONS[1]!).result
    const atMax2 = evaluatedAt(POSITIONS[4]!).result

    expect(atMax1.e_star).toBe(2) // e₂, from I_next = 2 002 g — not e_L = e₁ = 1 g
    expect(atMax1.e_star).not.toBe(atMax1.e_L)
    expect(atMax2.e_star).toBe(10) // e₃, from I_next = 5 010 g — not e_L = e₂ = 2 g
    expect(atMax2.e_star).not.toBe(atMax2.e_L)

    // The ½ e term of A.4.4.3 follows e*, which is what makes the two positions differ.
    expect(atMax1.halfEStarGrams).toBe(1)
    expect(atMax2.halfEStarGrams).toBe(5)
  })

  it('takes the limit from the load side while the indication side changes range', () => {
    // At Max₁ the indication crosses into range 2 but the load does not: the mpe stays ± 1 e₁.
    const atMax1 = evaluatedAt(POSITIONS[1]!).result
    expect(atMax1.range_I.range?.rangeNumber).toBe(1)
    expect(atMax1.range_I_next.range?.rangeNumber).toBe(2)
    expect(atMax1.mpeGrams).toBe(1)

    // At Max₂ the same split, one range higher: the mpe stays ± 1.5 e₂ = ± 3 g.
    const atMax2 = evaluatedAt(POSITIONS[4]!).result
    expect(atMax2.range_I.range?.rangeNumber).toBe(2)
    expect(atMax2.range_I_next.range?.rangeNumber).toBe(3)
    expect(atMax2.mpeGrams).toBe(3)
  })

  it('leaves m fractional where the load is not a whole number of intervals', () => {
    // Three of the six positions sit between intervals; none of them is rounded to a bracket edge.
    expect(evaluatedAt(POSITIONS[2]!).result.m).toBeCloseTo(1_000.5, 9)
    expect(evaluatedAt(POSITIONS[3]!).result.m).toBeCloseTo(2_499.5, 9)
    expect(evaluatedAt(POSITIONS[5]!).result.m).toBeCloseTo(500.1, 9)

    // And each still lands in the bracket its exact value belongs to.
    expect(reportAt(POSITIONS[2]!).testPoints[0]!.compliance.bracketText).toBe('500 < m ≤ 2 000')
    expect(reportAt(POSITIONS[3]!).testPoints[0]!.compliance.bracketText).toBe('2 000 < m ≤ 10 000')
    expect(reportAt(POSITIONS[5]!).testPoints[0]!.compliance.bracketText).toBe('500 < m ≤ 2 000')
  })
})
