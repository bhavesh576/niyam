import { describe, expect, it } from 'vitest'
import { officialExampleInstrument, singleRangeBracketInstrument } from '../../testing/fixtures'
import { toGrams } from '../../utils/mass'
import {
  isAtPartialRangeBoundary,
  resolveIndicationRange,
  resolveLoadRange,
  resolveNextIndicationRange,
  resolveRanges,
} from './rangeResolver'
import type { TestConditionInput } from './types'

/**
 * Range resolution against the OIML R 76-1:2006 §3.3.3 example
 * (Min = 20 g; Max₁ = 2 kg / e₁ = 1 g; Max₂ = 5 kg / e₂ = 2 g; Max₃ = Max = 15 kg / e₃ = 10 g).
 *
 * Every expectation below is either a value printed in the Recommendation or a direct consequence
 * of the membership rule the §3.3.3 example fixes: a partial weighing range is (Maxᵢ₋₁, Maxᵢ].
 */

const EXAMPLE = officialExampleInstrument()
const SINGLE_RANGE = singleRangeBracketInstrument()

function loadRange(grams: number | null) {
  return resolveLoadRange(EXAMPLE, grams)
}

function input(overrides: Partial<TestConditionInput> = {}): TestConditionInput {
  return { loadGrams: null, indicationGrams: null, nextIndicationGrams: null, ...overrides }
}

describe('resolveLoadRange — a load inside each partial weighing range', () => {
  const cases: Array<{ L: number; rangeNumber: number; e: number; atUpperBound: boolean; isLast: boolean }> = [
    { L: 20, rangeNumber: 1, e: 1, atUpperBound: false, isLast: false },
    { L: 21, rangeNumber: 1, e: 1, atUpperBound: false, isLast: false },
    { L: 500, rangeNumber: 1, e: 1, atUpperBound: false, isLast: false },
    { L: 1_999, rangeNumber: 1, e: 1, atUpperBound: false, isLast: false },
    { L: 2_000, rangeNumber: 1, e: 1, atUpperBound: true, isLast: false },
    { L: 2_001, rangeNumber: 2, e: 2, atUpperBound: false, isLast: false },
    { L: 4_000, rangeNumber: 2, e: 2, atUpperBound: false, isLast: false },
    { L: 5_000, rangeNumber: 2, e: 2, atUpperBound: true, isLast: false },
    { L: 5_001, rangeNumber: 3, e: 10, atUpperBound: false, isLast: true },
    { L: 15_000, rangeNumber: 3, e: 10, atUpperBound: true, isLast: true },
  ]

  it.each(cases)('resolves L = $L g into range $rangeNumber with e = $e g', ({ L, rangeNumber, e, atUpperBound, isLast }) => {
    const resolution = loadRange(L)

    expect(resolution.status).toBe('resolved')
    expect(resolution.range?.rangeNumber).toBe(rangeNumber)
    expect(resolution.range?.index).toBe(rangeNumber - 1)
    expect(resolution.applicableIntervalGrams).toBe(e)
    expect(resolution.range?.verificationIntervalGrams).toBe(e)
    expect(resolution.range?.atUpperBound).toBe(atUpperBound)
    expect(resolution.range?.isLast).toBe(isLast)
  })

  it('reports the partial range bounds and n of the resolved range', () => {
    const range = loadRange(3_000).range

    expect(range).not.toBeNull()
    expect(range?.lowerBoundGrams).toBe(2_000) // Min₂ = Max₁ (§3.3.1)
    expect(range?.upperBoundGrams).toBe(5_000) // Max₂
    expect(range?.verificationIntervals).toBe(2_500) // n₂ = Max₂ / e₂, as printed in §3.3.3
  })

  it('takes the applicable e from the resolved range and never from e₁', () => {
    const firstInterval = EXAMPLE.ranges[0].verificationIntervalGrams
    expect(firstInterval).toBe(1)

    expect(loadRange(1_000).applicableIntervalGrams).toBe(1) // range 1 — equal to e₁ by membership
    expect(loadRange(3_000).applicableIntervalGrams).toBe(2) // range 2 — NOT e₁
    expect(loadRange(10_000).applicableIntervalGrams).toBe(10) // range 3 — NOT e₁

    for (const L of [3_000, 10_000]) {
      expect(loadRange(L).applicableIntervalGrams).not.toBe(firstInterval)
    }
  })
})

describe('resolveLoadRange — the six boundary positions around 2 kg and 5 kg', () => {
  it('just below / exactly at / just above Max₁ = 2 kg', () => {
    const below = loadRange(1_999)
    const at = loadRange(2_000)
    const above = loadRange(2_001)

    expect(below.range?.rangeNumber).toBe(1)
    expect(below.applicableIntervalGrams).toBe(1)
    expect(below.range?.atUpperBound).toBe(false)

    expect(at.range?.rangeNumber).toBe(1)
    expect(at.applicableIntervalGrams).toBe(1)
    expect(at.range?.atUpperBound).toBe(true)
    expect(isAtPartialRangeBoundary(at)).toBe(true)

    expect(above.range?.rangeNumber).toBe(2)
    expect(above.applicableIntervalGrams).toBe(2)
    expect(above.range?.atUpperBound).toBe(false)
  })

  it('just below / exactly at / just above Max₂ = 5 kg', () => {
    const below = loadRange(4_999)
    const at = loadRange(5_000)
    const above = loadRange(5_001)

    expect(below.range?.rangeNumber).toBe(2)
    expect(below.applicableIntervalGrams).toBe(2)

    expect(at.range?.rangeNumber).toBe(2)
    expect(at.applicableIntervalGrams).toBe(2)
    expect(at.range?.atUpperBound).toBe(true)

    expect(above.range?.rangeNumber).toBe(3)
    expect(above.applicableIntervalGrams).toBe(10)
  })

  it('flags the exact boundary on both changeovers and nowhere else', () => {
    const boundaries = [2_000, 5_000, 15_000]
    for (const L of [20, 500, 1_999, 2_000, 2_001, 4_999, 5_000, 5_001, 14_999, 15_000]) {
      expect(isAtPartialRangeBoundary(loadRange(L))).toBe(boundaries.includes(L))
    }
  })
})

describe('resolveLoadRange — values that belong to no partial weighing range', () => {
  it('reports a load below Min without substituting e₁', () => {
    for (const L of [19, 10, 0.5, 0]) {
      const resolution = loadRange(L)
      expect(resolution.status).toBe('below-weighing-range')
      expect(resolution.range).toBeNull()
      expect(resolution.applicableIntervalGrams).toBeNull()
      expect(resolution.valueGrams).toBe(L)
    }
  })

  it('reports a load above Max without substituting the last e', () => {
    for (const L of [15_000.5, 15_001, 20_000]) {
      const resolution = loadRange(L)
      expect(resolution.status).toBe('above-weighing-range')
      expect(resolution.range).toBeNull()
      expect(resolution.applicableIntervalGrams).toBeNull()
    }
  })

  it('reports a missing, unparsable or negative load as not-a-value', () => {
    for (const L of [null, Number.NaN, Number.POSITIVE_INFINITY, -1, -20]) {
      const resolution = loadRange(L)
      expect(resolution.status).toBe('not-a-value')
      expect(resolution.range).toBeNull()
      expect(resolution.applicableIntervalGrams).toBeNull()
    }
  })

  it('cites the weighing range for unresolved values and §3.3.1 for resolved ones', () => {
    expect(loadRange(1_000).sourceReference.clauses).toContain('3.3.1')
    expect(loadRange(10).sourceReference.clauses).toContain('T.3.1.4')
    expect(loadRange(10).sourceReference.document).toBe('OIML R 76-1:2006 (E)')
  })
})

describe('resolveIndicationRange / resolveNextIndicationRange', () => {
  it('resolves an indication inside a partial weighing range', () => {
    const indication = resolveIndicationRange(EXAMPLE, 1_500)

    expect(indication.quantity).toBe('indication')
    expect(indication.symbol).toBe('I')
    expect(indication.status).toBe('resolved')
    expect(indication.range?.rangeNumber).toBe(1)
    expect(indication.applicableIntervalGrams).toBe(1)
  })

  it('resolves an indication exactly on a range boundary into the lower range', () => {
    const indication = resolveIndicationRange(EXAMPLE, 2_000)

    expect(indication.range?.rangeNumber).toBe(1)
    expect(indication.range?.atUpperBound).toBe(true)
    expect(indication.applicableIntervalGrams).toBe(1)
  })

  it('resolves a next indication that has crossed into the following range', () => {
    const next = resolveNextIndicationRange(EXAMPLE, 2_002)

    expect(next.quantity).toBe('next-indication')
    expect(next.symbol).toBe('I_next')
    expect(next.range?.rangeNumber).toBe(2)
    expect(next.applicableIntervalGrams).toBe(2)
  })

  it('reports an indication outside the weighing range instead of resolving it', () => {
    expect(resolveIndicationRange(EXAMPLE, 5).status).toBe('below-weighing-range')
    expect(resolveIndicationRange(EXAMPLE, 16_000).status).toBe('above-weighing-range')
    expect(resolveNextIndicationRange(EXAMPLE, null).status).toBe('not-a-value')
    expect(resolveNextIndicationRange(EXAMPLE, null).applicableIntervalGrams).toBeNull()
  })
})

describe('resolveRanges — range_L, range_I, range_I_next, e_L and e*', () => {
  it('exposes the five specified fields', () => {
    const ranges = resolveRanges(EXAMPLE, input({ loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_002 }))

    expect(Object.keys(ranges).sort()).toEqual(['e_L', 'e_star', 'range_I', 'range_I_next', 'range_L'])
    expect(ranges.range_L.range?.rangeNumber).toBe(1)
    expect(ranges.range_I.range?.rangeNumber).toBe(1)
    expect(ranges.range_I_next.range?.rangeNumber).toBe(2)
    expect(ranges.e_L).toBe(1)
    expect(ranges.e_star).toBe(2)
  })

  it('takes e_L from the load range and e* from the next-indication range', () => {
    const ranges = resolveRanges(EXAMPLE, input({ loadGrams: 1_000, nextIndicationGrams: 10_000 }))

    expect(ranges.e_L).toBe(1) // range 1
    expect(ranges.e_star).toBe(10) // range 3 — resolved from I_next alone
    expect(ranges.e_star).toBe(ranges.range_I_next.applicableIntervalGrams)
    expect(ranges.e_L).toBe(ranges.range_L.applicableIntervalGrams)
    expect(ranges.e_star).not.toBe(ranges.e_L)
  })

  it('gives equal e_L and e* when I_next stays in the load range, resolved independently', () => {
    const ranges = resolveRanges(EXAMPLE, input({ loadGrams: 6_000, nextIndicationGrams: 6_010 }))

    expect(ranges.e_L).toBe(10)
    expect(ranges.e_star).toBe(10)
    expect(ranges.range_I_next.range?.rangeNumber).toBe(3)
  })

  it('leaves e_L and e* null when the corresponding quantity did not resolve', () => {
    expect(resolveRanges(EXAMPLE, input()).e_L).toBeNull()
    expect(resolveRanges(EXAMPLE, input()).e_star).toBeNull()
    expect(resolveRanges(EXAMPLE, input({ loadGrams: 1_000 })).e_star).toBeNull()
    expect(resolveRanges(EXAMPLE, input({ nextIndicationGrams: 1_000 })).e_L).toBeNull()
    expect(resolveRanges(EXAMPLE, input({ loadGrams: 5 })).e_L).toBeNull()
  })
})

describe('range resolution — unit safety and instrument shape', () => {
  it('resolves a load entered in kilograms exactly as the same load in grams', () => {
    expect(loadRange(toGrams(2, 'kg'))).toEqual(loadRange(2_000))
    expect(loadRange(toGrams(5, 'kg'))).toEqual(loadRange(5_000))
    expect(loadRange(toGrams(15, 'kg'))).toEqual(loadRange(15_000))
    expect(loadRange(toGrams(0.5, 'kg'))).toEqual(loadRange(500))
    expect(loadRange(toGrams(2.001, 'kg')).range?.rangeNumber).toBe(2)
  })

  it('resolves every load of a single-range instrument into range 1', () => {
    for (const L of [20, 500, 501, 2_000, 2_001, 9_999, 10_000]) {
      const resolution = resolveLoadRange(SINGLE_RANGE, L)
      expect(resolution.status).toBe('resolved')
      expect(resolution.range?.rangeNumber).toBe(1)
      expect(resolution.range?.isLast).toBe(true)
      expect(resolution.applicableIntervalGrams).toBe(1)
    }

    expect(resolveLoadRange(SINGLE_RANGE, 19).status).toBe('below-weighing-range')
    expect(resolveLoadRange(SINGLE_RANGE, 10_001).status).toBe('above-weighing-range')
    expect(isAtPartialRangeBoundary(resolveLoadRange(SINGLE_RANGE, 10_000))).toBe(true)
  })
})

describe('displayability — a load is applied mass, an indication is a displayed value', () => {
  it('never checks the test load against a scale interval', () => {
    for (const L of [20.5, 2_001, 4_999, 5_005, 6_001]) {
      expect(resolveLoadRange(EXAMPLE, L).displayable, `${L} g as a load`).toBeNull()
    }
  })

  it('marks an indication displayable when it is a multiple of the interval of its own range', () => {
    expect(resolveIndicationRange(EXAMPLE, 1_500).displayable).toBe(true) // e₁ = 1 g
    expect(resolveIndicationRange(EXAMPLE, 2_000).displayable).toBe(true) // Max₁, still partial weighing range 1
    expect(resolveNextIndicationRange(EXAMPLE, 2_002).displayable).toBe(true) // e₂ = 2 g
    expect(resolveIndicationRange(EXAMPLE, 6_010).displayable).toBe(true) // e₃ = 10 g
  })

  it('marks an indication not displayable when its range steps past it', () => {
    expect(resolveNextIndicationRange(EXAMPLE, 2_001).displayable).toBe(false) // e₂ = 2 g
    expect(resolveIndicationRange(EXAMPLE, 4_999).displayable).toBe(false) // e₂ = 2 g
    expect(resolveIndicationRange(EXAMPLE, 6_005).displayable).toBe(false) // e₃ = 10 g
  })

  it('leaves displayability null when no partial weighing range applies to the indication', () => {
    expect(resolveIndicationRange(EXAMPLE, 5).displayable).toBeNull()
    expect(resolveIndicationRange(EXAMPLE, 16_000).displayable).toBeNull()
    expect(resolveNextIndicationRange(EXAMPLE, null).displayable).toBeNull()
  })

  it('withholds e* for a next indication its range cannot display, and still resolves e_L', () => {
    const ranges = resolveRanges(
      EXAMPLE,
      input({ loadGrams: 2_001, indicationGrams: 2_000, nextIndicationGrams: 2_001 }),
    )

    // 2 001 g: ordinary as a LOAD (range 2, e₂ = 2 g applies to it), impossible as an INDICATION
    // of range 2.
    expect(ranges.range_L.range?.rangeNumber).toBe(2)
    expect(ranges.e_L).toBe(2)
    expect(ranges.range_I_next.range?.rangeNumber).toBe(2)
    expect(ranges.range_I_next.applicableIntervalGrams).toBe(2)
    expect(ranges.e_star).toBeNull()
    expect(Object.keys(ranges).sort()).toEqual(['e_L', 'e_star', 'range_I', 'range_I_next', 'range_L'])
  })

  it('reports the single range of a single-range instrument as displayable for every multiple of e₁', () => {
    expect(resolveIndicationRange(SINGLE_RANGE, 5_000).displayable).toBe(true)
    expect(resolveIndicationRange(SINGLE_RANGE, 5_000.5).displayable).toBe(false)
  })
})
