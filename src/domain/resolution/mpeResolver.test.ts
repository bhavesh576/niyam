import { describe, expect, it } from 'vitest'
import {
  findTable6Row,
  R76_TABLE_6_INITIAL_VERIFICATION,
  table6RowsFor,
} from '../constants/r76Tables'
import { fineIntervalInstrument, officialExampleInstrument, singleRangeBracketInstrument } from '../../testing/fixtures'
import { PENDING_RULES } from '../pendingRules'
import { toGrams } from '../../utils/mass'
import { absoluteMpeGrams, intervalsOf, resolveMPE } from './mpeResolver'
import { resolveLoadRange } from './rangeResolver'
import type { NormalizedInstrument } from '../models/normalizedInstrument'
import type { AccuracyClass } from '../models/instrument'

/**
 * MPE resolution — §3.5.1 Table 6 applied to a MULTI-INTERVAL instrument.
 *
 * The reference for every expectation is the Recommendation itself: the Table 6 class III column
 * and the mpe walk-through printed in the §3.3.3 example. Nothing here is inferred.
 */

const EXAMPLE = officialExampleInstrument()
const SINGLE_RANGE = singleRangeBracketInstrument()
const FINE_INTERVAL = fineIntervalInstrument()

/** resolveMPE the way the application calls it: through the load's own range resolution. */
function mpeAt(instrument: NormalizedInstrument, loadGrams: number | null) {
  return resolveMPE(loadGrams, resolveLoadRange(instrument, loadGrams), instrument.accuracyClass)
}

describe('resolveMPE — the mpe printed in the §3.3.3 example', () => {
  // "for m = 0 g to 500 g       mpe = ± 0.5 e1 = ± 0.5 g"
  // "for m > 500 g to 2 000 g   mpe = ± 1 e1   = ± 1 g"
  // "for m > 2 000 g to 4 000 g mpe = ± 1 e2   = ± 2 g"
  // "for m > 4 000 g to 5 000 g mpe = ± 1.5 e2 = ± 3 g"
  // "for m > 5 000 g to 15 000 g mpe = ± 1 e3  = ± 10 g"
  const anchors: Array<{ L: number; range: number; e: number; m: number; coefficient: number; mpe: number; bracket: string }> = [
    { L: 500, range: 1, e: 1, m: 500, coefficient: 0.5, mpe: 0.5, bracket: '0 ≤ m ≤ 500' },
    { L: 2_000, range: 1, e: 1, m: 2_000, coefficient: 1.0, mpe: 1, bracket: '500 < m ≤ 2 000' },
    { L: 2_001, range: 2, e: 2, m: 1_000.5, coefficient: 1.0, mpe: 2, bracket: '500 < m ≤ 2 000' },
    { L: 4_000, range: 2, e: 2, m: 2_000, coefficient: 1.0, mpe: 2, bracket: '500 < m ≤ 2 000' },
    { L: 4_001, range: 2, e: 2, m: 2_000.5, coefficient: 1.5, mpe: 3, bracket: '2 000 < m ≤ 10 000' },
    { L: 5_000, range: 2, e: 2, m: 2_500, coefficient: 1.5, mpe: 3, bracket: '2 000 < m ≤ 10 000' },
    { L: 5_001, range: 3, e: 10, m: 500.1, coefficient: 1.0, mpe: 10, bracket: '500 < m ≤ 2 000' },
    { L: 15_000, range: 3, e: 10, m: 1_500, coefficient: 1.0, mpe: 10, bracket: '500 < m ≤ 2 000' },
  ]

  it.each(anchors)('L = $L g -> range $range, e = $e g, m = $m, mpe = ± $mpe g', ({ L, e, m, coefficient, mpe, bracket }) => {
    const result = mpeAt(EXAMPLE, L)

    expect(result.status).toBe('resolved')
    expect(result.verificationIntervalGrams).toBe(e)
    expect(result.m).toBeCloseTo(m, 9)
    expect(result.coefficient).toBe(coefficient)
    expect(result.absoluteMpeGrams).toBe(mpe)
    expect(result.bracket?.mCellText).toBe(bracket)
    expect(result.bracket?.accuracyClass).toBe('III')
    expect(result.loadGrams).toBe(L)
    expect(result.accuracyClass).toBe('III')
  })

  it('reproduces every line of the example, including the first bracket', () => {
    expect(mpeAt(EXAMPLE, 20).absoluteMpeGrams).toBe(0.5) // Min, m = 20 -> ± 0.5 e₁
    expect(mpeAt(EXAMPLE, 100).absoluteMpeGrams).toBe(0.5) // m = 100 -> ± 0.5 e₁
    expect(mpeAt(EXAMPLE, 501).absoluteMpeGrams).toBe(1) // m = 501 -> ± 1 e₁
    expect(mpeAt(EXAMPLE, 1_999).absoluteMpeGrams).toBe(1)
    expect(mpeAt(EXAMPLE, 2_500).absoluteMpeGrams).toBe(2) // range 2, m = 1 250 -> ± 1 e₂
    expect(mpeAt(EXAMPLE, 4_500).absoluteMpeGrams).toBe(3) // range 2, m = 2 250 -> ± 1.5 e₂
    expect(mpeAt(EXAMPLE, 10_000).absoluteMpeGrams).toBe(10) // range 3, m = 1 000 -> ± 1 e₃
  })

  it('applies the coefficient to the interval of the load range, never to e₁', () => {
    const e1 = EXAMPLE.ranges[0].verificationIntervalGrams
    expect(e1).toBe(1)

    // 4 000 g: the example prints ± 1 e₂ = ± 2 g. Using e₁ would give ± 1 g.
    expect(mpeAt(EXAMPLE, 4_000).absoluteMpeGrams).toBe(2)
    expect(mpeAt(EXAMPLE, 4_000).absoluteMpeGrams).not.toBe(1 * e1)

    // 5 000 g: ± 1.5 e₂ = ± 3 g. Using e₁ would give ± 1.5 g.
    expect(mpeAt(EXAMPLE, 5_000).absoluteMpeGrams).toBe(3)

    // 15 000 g: ± 1 e₃ = ± 10 g. Using e₁ would give ± 1 g.
    expect(mpeAt(EXAMPLE, 15_000).absoluteMpeGrams).toBe(10)
  })

  it('brackets the LOAD, not the indication: I / e is never used for the load mpe', () => {
    // Same instrument, same load, but an indication that would place m in another bracket if it
    // were used: I = 5 001 g with L = 4 000 g.
    const load = resolveLoadRange(EXAMPLE, 4_000)
    const result = resolveMPE(4_000, load, EXAMPLE.accuracyClass)

    expect(result.m).toBe(2_000) // 4 000 / e₂ — not 5 001 / e₂ = 2 500.5
    expect(result.coefficient).toBe(1.0)
    expect(result.absoluteMpeGrams).toBe(2)

    // And the indication-based quantity would indeed be different:
    expect(intervalsOf(5_001, 2)).toBe(2_500.5)
    expect(findTable6Row('III', 2_500.5)?.coefficient).toBe(1.5)
  })
})

describe('resolveMPE — Table 6 class III bracket boundaries, both sides', () => {
  // Single partial weighing range, e₁ = 1 g, Min = 20 g, Max₁ = 10 kg: m equals the load in grams.
  const cases: Array<{ L: number; m: number; coefficient: number; bracket: string }> = [
    { L: 20, m: 20, coefficient: 0.5, bracket: '0 ≤ m ≤ 500' },
    { L: 499, m: 499, coefficient: 0.5, bracket: '0 ≤ m ≤ 500' },
    { L: 500, m: 500, coefficient: 0.5, bracket: '0 ≤ m ≤ 500' },
    { L: 501, m: 501, coefficient: 1.0, bracket: '500 < m ≤ 2 000' },
    { L: 1_999, m: 1_999, coefficient: 1.0, bracket: '500 < m ≤ 2 000' },
    { L: 2_000, m: 2_000, coefficient: 1.0, bracket: '500 < m ≤ 2 000' },
    { L: 2_001, m: 2_001, coefficient: 1.5, bracket: '2 000 < m ≤ 10 000' },
    { L: 9_999, m: 9_999, coefficient: 1.5, bracket: '2 000 < m ≤ 10 000' },
    { L: 10_000, m: 10_000, coefficient: 1.5, bracket: '2 000 < m ≤ 10 000' },
  ]

  it.each(cases)('L = $L g -> m = $m, bracket $bracket, ± $coefficient e', ({ L, m, coefficient, bracket }) => {
    const result = mpeAt(SINGLE_RANGE, L)

    expect(result.status).toBe('resolved')
    expect(result.m).toBe(m)
    expect(result.coefficient).toBe(coefficient)
    expect(result.bracket?.mCellText).toBe(bracket)
    expect(result.absoluteMpeGrams).toBe(coefficient * 1) // e₁ = 1 g
  })

  it('gives the low, first-boundary, middle, second-boundary and upper brackets in one pass', () => {
    expect(mpeAt(SINGLE_RANGE, 20).coefficient).toBe(0.5) // low bracket
    expect(mpeAt(SINGLE_RANGE, 500).coefficient).toBe(0.5) // first boundary, lower side
    expect(mpeAt(SINGLE_RANGE, 501).coefficient).toBe(1.0) // first boundary, upper side
    expect(mpeAt(SINGLE_RANGE, 1_500).coefficient).toBe(1.0) // middle bracket
    expect(mpeAt(SINGLE_RANGE, 2_000).coefficient).toBe(1.0) // second boundary, lower side
    expect(mpeAt(SINGLE_RANGE, 2_001).coefficient).toBe(1.5) // second boundary, upper side
    expect(mpeAt(SINGLE_RANGE, 10_000).coefficient).toBe(1.5) // upper bracket, at n = 10 000
  })

  it('reports the boundary positions around the 500 g and 2 000 g bracket edges', () => {
    const around500 = [499, 500, 501].map((L) => mpeAt(SINGLE_RANGE, L).absoluteMpeGrams)
    const around2000 = [1_999, 2_000, 2_001].map((L) => mpeAt(SINGLE_RANGE, L).absoluteMpeGrams)

    expect(around500).toEqual([0.5, 0.5, 1])
    expect(around2000).toEqual([1, 1, 1.5])
  })
})

describe('Table 6 — the verified boundaries of every accuracy class', () => {
  it('records exactly twelve rows, three per class, as printed', () => {
    expect(R76_TABLE_6_INITIAL_VERIFICATION).toHaveLength(12)
    for (const accuracyClass of ['I', 'II', 'III', 'IIII'] as const) {
      expect(table6RowsFor(accuracyClass)).toHaveLength(3)
      expect(table6RowsFor(accuracyClass).map((row) => row.coefficient)).toEqual([0.5, 1.0, 1.5])
    }
  })

  const edges: Array<{ accuracyClass: AccuracyClass; m: number; coefficient: number | null }> = [
    // Class I: 0 ≤ m ≤ 50 000 | 50 000 < m ≤ 200 000 | 200 000 < m (open ended)
    { accuracyClass: 'I', m: 0, coefficient: 0.5 },
    { accuracyClass: 'I', m: 50_000, coefficient: 0.5 },
    { accuracyClass: 'I', m: 50_001, coefficient: 1.0 },
    { accuracyClass: 'I', m: 200_000, coefficient: 1.0 },
    { accuracyClass: 'I', m: 200_001, coefficient: 1.5 },
    { accuracyClass: 'I', m: 10_000_000, coefficient: 1.5 },
    // Class II: 0 ≤ m ≤ 5 000 | 5 000 < m ≤ 20 000 | 20 000 < m ≤ 100 000
    { accuracyClass: 'II', m: 5_000, coefficient: 0.5 },
    { accuracyClass: 'II', m: 5_001, coefficient: 1.0 },
    { accuracyClass: 'II', m: 20_000, coefficient: 1.0 },
    { accuracyClass: 'II', m: 20_001, coefficient: 1.5 },
    { accuracyClass: 'II', m: 100_000, coefficient: 1.5 },
    { accuracyClass: 'II', m: 100_001, coefficient: null },
    // Class III: 0 ≤ m ≤ 500 | 500 < m ≤ 2 000 | 2 000 < m ≤ 10 000
    { accuracyClass: 'III', m: 0, coefficient: 0.5 },
    { accuracyClass: 'III', m: 500, coefficient: 0.5 },
    { accuracyClass: 'III', m: 500.5, coefficient: 1.0 },
    { accuracyClass: 'III', m: 2_000, coefficient: 1.0 },
    { accuracyClass: 'III', m: 2_000.5, coefficient: 1.5 },
    { accuracyClass: 'III', m: 10_000, coefficient: 1.5 },
    { accuracyClass: 'III', m: 10_001, coefficient: null },
    // Class IIII: 0 ≤ m ≤ 50 | 50 < m ≤ 200 | 200 < m ≤ 1 000
    { accuracyClass: 'IIII', m: 50, coefficient: 0.5 },
    { accuracyClass: 'IIII', m: 51, coefficient: 1.0 },
    { accuracyClass: 'IIII', m: 200, coefficient: 1.0 },
    { accuracyClass: 'IIII', m: 201, coefficient: 1.5 },
    { accuracyClass: 'IIII', m: 1_000, coefficient: 1.5 },
    { accuracyClass: 'IIII', m: 1_001, coefficient: null },
  ]

  it.each(edges)('class $accuracyClass at m = $m -> coefficient $coefficient', ({ accuracyClass, m, coefficient }) => {
    expect(findTable6Row(accuracyClass, m)?.coefficient ?? null).toBe(coefficient)
  })

  it('finds no bracket for a negative or non-finite m', () => {
    expect(findTable6Row('III', -1)).toBeNull()
    expect(findTable6Row('III', Number.NaN)).toBeNull()
    expect(findTable6Row('III', Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('resolveMPE — loads for which Table 6 gives no limit', () => {
  it('reports a missing test load', () => {
    const result = mpeAt(EXAMPLE, null)

    expect(result.status).toBe('no-load-value')
    expect(result.m).toBeNull()
    expect(result.bracket).toBeNull()
    expect(result.coefficient).toBeNull()
    expect(result.absoluteMpeGrams).toBeNull()
    expect(result.verificationIntervalGrams).toBeNull()
  })

  it('reports a load below Min without falling back to e₁', () => {
    for (const L of [19, 10, 0]) {
      const result = mpeAt(EXAMPLE, L)
      expect(result.status).toBe('load-outside-weighing-range')
      expect(result.absoluteMpeGrams).toBeNull()
      expect(result.verificationIntervalGrams).toBeNull() // NOT e₁ = 1 g
      expect(result.m).toBeNull()
    }
  })

  it('reports a load above Max', () => {
    for (const L of [15_001, 20_000]) {
      const result = mpeAt(EXAMPLE, L)
      expect(result.status).toBe('load-outside-weighing-range')
      expect(result.absoluteMpeGrams).toBeNull()
      expect(result.verificationIntervalGrams).toBeNull()
    }
  })

  it('reports a negative or unparsable load as no-load-value', () => {
    expect(mpeAt(EXAMPLE, -5).status).toBe('no-load-value')
    expect(mpeAt(EXAMPLE, Number.NaN).status).toBe('no-load-value')
  })

  it('reports an m outside every bracket instead of extrapolating', () => {
    // Not reachable through a class III configuration that satisfies Table 3 (n ≤ 10 000), so the
    // resolver is called with a hand-made range resolution to exercise the branch.
    const load = resolveLoadRange(SINGLE_RANGE, 10_000)
    const forced = resolveMPE(10_000, load, 'IIII') // class IIII stops at m = 1 000

    expect(forced.status).toBe('outside-table-6')
    expect(forced.m).toBe(10_000)
    expect(forced.verificationIntervalGrams).toBe(1)
    expect(forced.bracket).toBeNull()
    expect(forced.absoluteMpeGrams).toBeNull()
  })

  it('carries the Table 6 provenance on every result', () => {
    for (const result of [mpeAt(EXAMPLE, 1_000), mpeAt(EXAMPLE, null), mpeAt(EXAMPLE, 19)]) {
      expect(result.sourceReference.document).toBe('OIML R 76-1:2006 (E)')
      expect(result.sourceReference.clauses).toContain('Table 6')
      expect(result.sourceReference.clauses).toContain('3.3.3 example')
      expect(result.sourceReference.status).toBe('verified')
    }
  })
})

describe('mpe arithmetic — exactness and unit safety', () => {
  it('computes 1.5 x 0.1 g as exactly 0.15 g, not as a binary float artefact', () => {
    expect(1.5 * 0.1).not.toBe(0.15) // the trap this code avoids
    expect(absoluteMpeGrams(0.1, 1.5)).toBe(0.15)
    expect(absoluteMpeGrams(0.1, 0.5)).toBe(0.05)
    expect(absoluteMpeGrams(0.1, 1.0)).toBe(0.1)
  })

  it('resolves the ±1.5 e bracket of a 0.1 g instrument exactly', () => {
    const result = mpeAt(FINE_INTERVAL, 200.1) // m = 2 001 -> 2 000 < m ≤ 10 000

    expect(result.status).toBe('resolved')
    expect(result.verificationIntervalGrams).toBe(0.1)
    expect(result.m).toBe(2_001)
    expect(Number.isInteger(result.m)).toBe(true)
    expect(result.coefficient).toBe(1.5)
    expect(result.absoluteMpeGrams).toBe(0.15)
  })

  it('rejects a non-positive interval or coefficient', () => {
    expect(absoluteMpeGrams(0, 1.5)).toBeNull()
    expect(absoluteMpeGrams(-1, 1.5)).toBeNull()
    expect(absoluteMpeGrams(1, 0)).toBeNull()
    expect(absoluteMpeGrams(1, -0.5)).toBeNull()
    expect(absoluteMpeGrams(Number.NaN, 1)).toBeNull()
  })

  it('forms m exactly on integer micrograms', () => {
    expect(intervalsOf(2_000, 1)).toBe(2_000)
    expect(intervalsOf(4_000, 2)).toBe(2_000)
    expect(intervalsOf(5_001, 10)).toBeCloseTo(500.1, 9)
    expect(intervalsOf(200.1, 0.1)).toBe(2_001)
    expect(intervalsOf(1, 0)).toBeNull()
  })

  it('resolves a load entered in kilograms exactly as the same load in grams', () => {
    expect(mpeAt(EXAMPLE, toGrams(2, 'kg'))).toEqual(mpeAt(EXAMPLE, 2_000))
    expect(mpeAt(EXAMPLE, toGrams(5, 'kg'))).toEqual(mpeAt(EXAMPLE, 5_000))
    expect(mpeAt(EXAMPLE, toGrams(0.5, 'kg'))).toEqual(mpeAt(EXAMPLE, 500))
    expect(mpeAt(EXAMPLE, toGrams(15, 'kg')).absoluteMpeGrams).toBe(10)
    expect(mpeAt(EXAMPLE, toGrams(4.001, 'kg')).absoluteMpeGrams).toBe(3)
  })
})

describe('scope bookkeeping — what this resolver does and does not claim', () => {
  it('no longer lists the initial-verification mpe as a pending rule', () => {
    expect(PENDING_RULES.map((rule) => rule.id)).not.toContain('r76.3.5.1.maximum-permissible-errors')
  })

  it('no longer lists the errors of indication as a pending rule', () => {
    // Implemented by the evaluation engine (src/domain/evaluation/) on top of this resolver.
    expect(PENDING_RULES.map((rule) => rule.id)).not.toContain('r76.3.5.3.errors-of-indication')
  })

  it('still lists the requirements that are verified but not implemented', () => {
    const ids = PENDING_RULES.map((rule) => rule.id)

    expect(ids).toContain('r76.3.5.2.mpe-in-service') // §3.5.2 — twice the initial-verification limits
    expect(ids).toContain('r76.3.3.4.tare-device') // net load
    expect(PENDING_RULES.filter((rule) => rule.reason === 'not-verified').length).toBeGreaterThan(0)
  })

  it('reports the initial-verification limit only, never the doubled in-service limit', () => {
    expect(mpeAt(EXAMPLE, 500).absoluteMpeGrams).toBe(0.5) // not 1 g
    expect(mpeAt(EXAMPLE, 4_000).absoluteMpeGrams).toBe(2) // not 4 g
    expect(mpeAt(EXAMPLE, 5_000).absoluteMpeGrams).toBe(3) // not 6 g
  })
})
