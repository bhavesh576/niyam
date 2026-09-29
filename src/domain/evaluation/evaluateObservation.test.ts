import { describe, expect, it } from 'vitest'
import { PENDING_RULES } from '../pendingRules'
import { officialExampleInstrument, fineIntervalInstrument, instrumentOf, fixture } from '../../testing/fixtures'
import { createExampleObservationDraft, createFailingObservationDraft } from '../../data/defaultConfiguration'
import { toTestObservationInput } from '../models/observation'
import { toGrams } from '../../utils/mass'
import {
  absoluteGrams,
  evaluateDigitalWeighingObservation,
  halfIntervalGrams,
  isWithinLimit,
} from './evaluateObservation'
import type { TestObservationInput } from './types'

/**
 * The digital weighing-performance calculation of A.4.4.3, evaluated against the multi-interval
 * class III example printed in §3.3.3 (Min = 20 g; Max₁ = 2 kg / e₁ = 1 g; Max₂ = 5 kg / e₂ = 2 g;
 * Max₃ = Max = 15 kg / e₃ = 10 g).
 *
 * Every expected number below is either printed in the Recommendation or follows arithmetically from
 * the three formulae of A.4.4.3 — `P = I + ½ e − ΔL`, `E = P − L`, `Ec = E − E₀ ≤ mpe` — with the
 * ½ e term taken from the partial weighing range in which the indication (I + e) appears, and the
 * mpe from the partial weighing range of the load (Table 6).
 */

const EXAMPLE = officialExampleInstrument()

function evaluate(overrides: Partial<TestObservationInput> = {}) {
  return evaluateDigitalWeighingObservation(EXAMPLE, {
    loadGrams: null,
    indicationGrams: null,
    additionalLoadGrams: null,
    nextIndicationGrams: null,
    zeroErrorGrams: null,
    ...overrides,
  })
}

/** The observation the test screen is pre-filled with: the changeover at Max₁ = 2 kg. */
const TRANSITION: TestObservationInput = toTestObservationInput(createExampleObservationDraft())

describe('normal case — L, I and I_next inside one partial weighing range', () => {
  it('evaluates with e_L = e* = e₁ and resolves the mpe from the load', () => {
    const result = evaluate({
      loadGrams: 1_000,
      indicationGrams: 1_000,
      additionalLoadGrams: 0.6,
      nextIndicationGrams: 1_001,
      zeroErrorGrams: 0.2,
    })

    expect(result.status).toBe('evaluated')
    expect(result.issues).toEqual([])

    // Ranges: all three quantities in partial weighing range 1.
    expect(result.range_L.range?.rangeNumber).toBe(1)
    expect(result.range_I.range?.rangeNumber).toBe(1)
    expect(result.range_I_next.range?.rangeNumber).toBe(1)
    expect(result.e_L).toBe(1)
    expect(result.e_star).toBe(1)

    // MPE, recorded as the specification requires: m, coefficient, bracket, absolute value.
    expect(result.m).toBe(1_000)
    expect(result.mpeCoefficient).toBe(1.0)
    expect(result.mpeBracket?.mLowerBoundExclusive).toBe(500)
    expect(result.mpeBracket?.mUpperBoundInclusive).toBe(2_000)
    expect(result.mpeBracket?.mCellText).toBe('500 < m ≤ 2 000')
    expect(result.mpeGrams).toBe(1)

    // P = 1000 + ½·1 − 0.6 = 999.9 ; E = −0.1 ; Ec = −0.1 − 0.2 = −0.3
    expect(result.halfEStarGrams).toBe(0.5)
    expect(result.P).toBe(999.9)
    expect(result.E).toBe(-0.1)
    expect(result.E0).toBe(0.2)
    expect(result.Ec).toBe(-0.3)
    expect(result.absoluteEcGrams).toBe(0.3)
    expect(result.marginGrams).toBeCloseTo(0.7, 9)
    expect(result.passed).toBe(true)
  })

  it('keeps E, E₀ and Ec signed and only compares the absolute value', () => {
    const positive = evaluate({
      loadGrams: 1_000,
      indicationGrams: 1_000,
      additionalLoadGrams: 0.2,
      nextIndicationGrams: 1_001,
      zeroErrorGrams: -0.5,
    })

    // P = 1000 + 0.5 − 0.2 = 1000.3 ; E = +0.3 ; Ec = 0.3 − (−0.5) = +0.8
    expect(positive.E).toBe(0.3)
    expect(positive.E0).toBe(-0.5)
    expect(positive.Ec).toBe(0.8)
    expect(positive.absoluteEcGrams).toBe(0.8)
    expect(positive.passed).toBe(true)

    const negative = evaluate({
      loadGrams: 1_000,
      indicationGrams: 1_000,
      additionalLoadGrams: 0.8,
      nextIndicationGrams: 1_001,
      zeroErrorGrams: 0.5,
    })
    // P = 999.7 ; E = −0.3 ; Ec = −0.8
    expect(negative.Ec).toBe(-0.8)
    expect(negative.absoluteEcGrams).toBe(0.8)
    expect(negative.passed).toBe(true)
  })
})

describe('transition case — the indication crosses into the next partial weighing range', () => {
  it('uses e_L for the mpe and e* for the ½ e term, and the two differ', () => {
    const result = evaluateDigitalWeighingObservation(EXAMPLE, TRANSITION)

    expect(result.status).toBe('evaluated')
    expect(result.range_L.range?.rangeNumber).toBe(1) // L = 2 kg = Max₁, the bound belongs to range 1
    expect(result.range_I.range?.rangeNumber).toBe(1) // I = 2 000 g, displayable with e₁ = 1 g
    expect(result.range_I_next.range?.rangeNumber).toBe(2) // I_next = 2 002 g, in range 2
    expect(result.e_L).toBe(1)
    expect(result.e_star).toBe(2)
    expect(result.e_star).not.toBe(result.e_L)

    // mpe from the LOAD side: m = 2 000 / e₁ → 500 < m ≤ 2 000 → ± 1.0 e₁ = ± 1 g.
    expect(result.m).toBe(2_000)
    expect(result.mpeCoefficient).toBe(1.0)
    expect(result.mpeGrams).toBe(1)

    // P uses ½ e* = 1 g, not ½ e_L = 0.5 g.
    expect(result.halfEStarGrams).toBe(1)
    expect(result.P).toBe(1_999.6) // 2000 + 1 − 1.4
    expect(result.P).not.toBe(1_999.1) // what ½ e_L would have given
    expect(result.E).toBe(-0.4) // 1999.6 − 2000
    expect(result.Ec).toBe(-0.9) // −0.4 − 0.5
    expect(result.absoluteEcGrams).toBe(0.9)
    expect(result.marginGrams).toBeCloseTo(0.1, 9)
    expect(result.passed).toBe(true)
  })

  it('is the observation the test screen is pre-filled with, and passes', () => {
    expect(TRANSITION).toEqual({
      loadGrams: 2_000,
      indicationGrams: 2_000,
      additionalLoadGrams: 1.4,
      nextIndicationGrams: 2_002,
      zeroErrorGrams: 0.5,
    })

    const result = evaluateDigitalWeighingObservation(EXAMPLE, TRANSITION)
    expect(result.passed).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('fails the same observation when ΔL puts the corrected error outside the limit', () => {
    const result = evaluateDigitalWeighingObservation(EXAMPLE, toTestObservationInput(createFailingObservationDraft()))

    // ΔL = 1.6 g → P = 1999.4 → E = −0.6 → Ec = −1.1 → |Ec| > mpe = 1 g
    expect(result.P).toBe(1_999.4)
    expect(result.E).toBe(-0.6)
    expect(result.Ec).toBe(-1.1)
    expect(result.absoluteEcGrams).toBeCloseTo(1.1, 9)
    expect(result.mpeGrams).toBe(1)
    expect(result.passed).toBe(false)
    expect(result.marginGrams).toBeCloseTo(-0.1, 9)
    // A FAIL is still an evaluation: every intermediate value is present.
    expect(result.status).toBe('evaluated')
    expect(result.issues).toEqual([])
  })

  it('resolves a transition into the third partial weighing range with e* = e₃', () => {
    const result = evaluate({
      loadGrams: 5_000, // Max₂ — still partial weighing range 2, e_L = e₂ = 2 g
      indicationGrams: 5_000,
      additionalLoadGrams: 4.2,
      nextIndicationGrams: 5_010, // range 3, e₃ = 10 g
      zeroErrorGrams: 0.5,
    })

    expect(result.range_L.range?.rangeNumber).toBe(2)
    expect(result.range_I.range?.rangeNumber).toBe(2)
    expect(result.range_I_next.range?.rangeNumber).toBe(3)
    expect(result.e_L).toBe(2)
    expect(result.e_star).toBe(10)
    // m = 5 000 / e₂ = 2 500 → 2 000 < m ≤ 10 000 → ± 1.5 e₂ = ± 3 g (§3.3.3 prints ± 3 g at 5 000 g)
    expect(result.m).toBe(2_500)
    expect(result.mpeCoefficient).toBe(1.5)
    expect(result.mpeGrams).toBe(3)
    // P = 5000 + 5 − 4.2 = 5000.8 ; E = +0.8 ; Ec = +0.3
    expect(result.halfEStarGrams).toBe(5)
    expect(result.P).toBe(5_000.8)
    expect(result.E).toBeCloseTo(0.8, 9)
    expect(result.Ec).toBeCloseTo(0.3, 9)
    expect(result.passed).toBe(true)
  })
})

describe('boundary case — a load exactly on a partial-range boundary or a Table 6 bracket edge', () => {
  it('keeps L = Max₁ = 2 kg in partial weighing range 1 with mpe ± 1.0 e₁', () => {
    const result = evaluateDigitalWeighingObservation(EXAMPLE, TRANSITION)

    expect(result.range_L.range?.atUpperBound).toBe(true)
    expect(result.e_L).toBe(1)
    expect(result.m).toBe(2_000) // the bracket edge itself: 500 < m ≤ 2 000
    expect(result.mpeGrams).toBe(1)
  })

  it('resolves a load one gram above the boundary from partial weighing range 2', () => {
    const result = evaluate({
      loadGrams: 2_001, // an ordinary LOAD, though not a displayable indication of range 2
      indicationGrams: 2_002,
      additionalLoadGrams: 1.6,
      nextIndicationGrams: 2_004,
      zeroErrorGrams: 0.5,
    })

    expect(result.status).toBe('evaluated')
    expect(result.range_L.range?.rangeNumber).toBe(2)
    expect(result.e_L).toBe(2)
    expect(result.m).toBe(1_000.5)
    expect(result.mpeCoefficient).toBe(1.0)
    expect(result.mpeGrams).toBe(2) // ± 1.0 e₂, as §3.3.3 prints for 2 001 g … 4 000 g
    expect(result.e_star).toBe(2)
    // P = 2002 + 1 − 1.6 = 2001.4 ; E = +0.4 ; Ec = −0.1
    expect(result.P).toBe(2_001.4)
    expect(result.E).toBeCloseTo(0.4, 9)
    expect(result.Ec).toBeCloseTo(-0.1, 9)
    expect(result.passed).toBe(true)
  })

  it('applies the ± 0.5 e bracket at its upper edge, m = 500', () => {
    const result = evaluate({
      loadGrams: 500,
      indicationGrams: 500,
      additionalLoadGrams: 0.5,
      nextIndicationGrams: 501,
      zeroErrorGrams: 0,
    })

    expect(result.m).toBe(500)
    expect(result.mpeCoefficient).toBe(0.5)
    expect(result.mpeGrams).toBe(0.5) // §3.3.3: "for m ≤ 500 g  mpe = ± 0.5 e₁ = ± 0.5 g"
    // P = 500 + 0.5 − 0.5 = 500 ; E = 0 ; Ec = 0 − 0 = 0
    expect(result.P).toBe(500)
    expect(result.E).toBe(0)
    expect(result.Ec).toBe(0)
    expect(result.passed).toBe(true)
    expect(result.marginGrams).toBe(0.5)
  })
})

describe('the verdict comparison |Ec| ≤ mpe', () => {
  const at = (mpe: number, ec: number) => isWithinLimit(ec, mpe)

  it('accepts an error exactly at the limit', () => {
    expect(at(1, 1)).toBe(true)
    expect(at(0.5, 0.5)).toBe(true)
    expect(at(10, 10)).toBe(true)
  })

  it('rejects an error one microgram outside the limit', () => {
    expect(at(1, 1.000001)).toBe(false)
    expect(at(0.5, 0.500001)).toBe(false)
    expect(at(1, 0.999999)).toBe(true)
  })

  it('passes just inside and fails just outside, end to end', () => {
    // E = −0.4 g for the transition observation; E₀ moves Ec across the ± 1 g limit.
    const inside = evaluate({ ...TRANSITION, zeroErrorGrams: 0.599999 })
    expect(inside.Ec).toBeCloseTo(-0.999999, 9)
    expect(inside.passed).toBe(true)

    const exact = evaluate({ ...TRANSITION, zeroErrorGrams: 0.6 })
    expect(exact.Ec).toBe(-1)
    expect(exact.absoluteEcGrams).toBe(1)
    expect(exact.marginGrams).toBe(0)
    expect(exact.passed).toBe(true) // equality is inside the limit

    const outside = evaluate({ ...TRANSITION, zeroErrorGrams: 0.600001 })
    expect(outside.Ec).toBeCloseTo(-1.000001, 9)
    expect(outside.passed).toBe(false)
  })

  it('fails on the positive side by the same absolute limit', () => {
    // E = +0.4 g (ΔL = 0.6 g at L = I = 2 000 g in range 1 … e* = 2 g needs I_next in range 2)
    const result = evaluate({
      loadGrams: 1_000,
      indicationGrams: 1_000,
      additionalLoadGrams: 0.1,
      nextIndicationGrams: 1_001,
      zeroErrorGrams: -0.7,
    })
    // P = 1000.4 ; E = +0.4 ; Ec = 0.4 + 0.7 = +1.1 > mpe = 1 g
    expect(result.E).toBeCloseTo(0.4, 9)
    expect(result.Ec).toBeCloseTo(1.1, 9)
    expect(result.passed).toBe(false)
    expect(result.marginGrams).toBeCloseTo(-0.1, 9)
  })

  it('compares against the initial-verification limit only, never the doubled in-service limit', () => {
    const result = evaluateDigitalWeighingObservation(EXAMPLE, TRANSITION)
    expect(result.mpeGrams).toBe(1) // not 2 g (§3.5.2 is not applied in this build)
  })
})

describe('the worked example printed in A.4.4.3 (p. 89)', () => {
  /**
   * "An instrument with a verification scale interval, e, of 5 g is loaded with 1 kg and thereby
   * indicates 1 000 g. After adding successive weights of 0.5 g, the indication changes from 1 000 g
   * to 1 005 g at an additional load of 1.5 g." — one partial weighing range, e₁ = d = 5 g, so that
   * the example is reproduced with the interval it names.
   */
  const FIVE_GRAM = instrumentOf(fixture({ min: 100, d: 5, ranges: [{ max: 15_000, e: 5 }] }))

  it('reproduces P = (1 000 + 2.5 − 1.5) g = 1 001 g and E = + 1 g', () => {
    const result = evaluateDigitalWeighingObservation(FIVE_GRAM, {
      loadGrams: 1_000,
      indicationGrams: 1_000,
      additionalLoadGrams: 1.5, // added in steps of 1/10 e = 0.5 g (A.4.4.3 note)
      nextIndicationGrams: 1_005,
      zeroErrorGrams: 0.5, // "If the changeover point at zero as calculated above was E0 = + 0.5 g"
    })

    expect(result.status).toBe('evaluated')
    expect(result.e_L).toBe(5)
    expect(result.e_star).toBe(5)
    expect(result.halfEStarGrams).toBe(2.5)
    expect(result.P).toBe(1_001) // printed: "P = (1 000 + 2.5 – 1.5) g = 1 001 g"
    expect(result.E).toBe(1) // printed: "E = (1 001 – 1 000) g = + 1 g"
    expect(result.Ec).toBe(0.5) // printed: "Ec = + 1 – (+ 0.5) = + 0.5 g"
  })

  it('compares that corrected error with the limit of the partial weighing range of the load', () => {
    const result = evaluateDigitalWeighingObservation(FIVE_GRAM, {
      loadGrams: 1_000,
      indicationGrams: 1_000,
      additionalLoadGrams: 1.5,
      nextIndicationGrams: 1_005,
      zeroErrorGrams: 0.5,
    })

    // m = L / e₁ = 200 → class III bracket 0 ≤ m ≤ 500 → ± 0.5 e₁ = ± 2.5 g.
    expect(result.m).toBe(200)
    expect(result.mpeCoefficient).toBe(0.5)
    expect(result.mpeGrams).toBe(2.5)
    expect(result.absoluteEcGrams).toBe(0.5)
    expect(result.marginGrams).toBe(2)
    expect(result.passed).toBe(true)
  })
})

describe('blocked evaluations — nothing is calculated, nothing is substituted', () => {
  const full = TRANSITION

  function expectBlocked(result: ReturnType<typeof evaluate>) {
    expect(result.status).toBe('blocked')
    expect(result.passed).toBeNull()
    expect(result.P).toBeNull()
    expect(result.E).toBeNull()
    expect(result.Ec).toBeNull()
    expect(result.absoluteEcGrams).toBeNull()
    expect(result.marginGrams).toBeNull()
    expect(result.halfEStarGrams).toBeNull()
    expect(result.issues.length).toBeGreaterThan(0)
  }

  it('blocks when ΔL is missing', () => {
    const result = evaluate({ ...full, additionalLoadGrams: null })
    expectBlocked(result)
    expect(result.issues.map((issue) => issue.field)).toContain('additionalLoad')
    expect(result.issues.some((issue) => issue.message === 'ΔL is required to determine the changeover point.')).toBe(true)
  })

  it('blocks when ΔL is negative, without negating it', () => {
    const result = evaluate({ ...full, additionalLoadGrams: -1.4 })
    expectBlocked(result)
    const issue = result.issues.find((candidate) => candidate.field === 'additionalLoad')
    expect(issue?.message).toContain('is negative')
    expect(result.observation.additionalLoadGrams).toBe(-1.4)
  })

  it('blocks when I_next is not an indication its resolved range can display', () => {
    const result = evaluate({ ...full, nextIndicationGrams: 2_001 })
    expectBlocked(result)
    const issue = result.issues.find((candidate) => candidate.field === 'nextIndication')
    expect(issue?.ruleId).toBe('r76.t3.2.2.indication-scale-interval') // the Phase 2 rule, reused
    expect(issue?.message).toContain('Invalid next indication')
    expect(issue?.message).toContain('e₂ = 2 g')
    expect(result.e_star).toBeNull()
  })

  it('blocks when I is not an indication its resolved range can display', () => {
    const result = evaluate({ loadGrams: 3_000, indicationGrams: 3_001, additionalLoadGrams: 1.4, nextIndicationGrams: 3_002, zeroErrorGrams: 0.5 })
    expectBlocked(result)
    expect(result.issues.some((issue) => issue.field === 'indication' && issue.message.includes('Invalid indication'))).toBe(true)
  })

  it('blocks when E₀ is missing, and evaluates when E₀ is exactly zero', () => {
    const missing = evaluate({ ...full, zeroErrorGrams: null })
    expectBlocked(missing)
    expect(missing.issues.some((issue) => issue.message === 'Cannot evaluate: E0 is required for corrected error Ec.')).toBe(true)
    expect(missing.E0).toBeNull()

    const zero = evaluate({ ...full, zeroErrorGrams: 0 })
    expect(zero.status).toBe('evaluated')
    expect(zero.E0).toBe(0)
    expect(zero.Ec).toBe(-0.4) // Ec = E − 0
    expect(zero.passed).toBe(true)
  })

  it('blocks when L, I or I_next is missing, and reports every missing quantity', () => {
    const empty = evaluate()
    expectBlocked(empty)
    expect(empty.issues.map((issue) => issue.field)).toEqual([
      'load',
      'indication',
      'additionalLoad',
      'nextIndication',
      'zeroError',
    ])

    const noLoad = evaluate({ ...full, loadGrams: null })
    expectBlocked(noLoad)
    expect(noLoad.issues.map((issue) => issue.field)).toEqual(['load'])
    // The indication side still resolves, and e* is still reported — only the verdict is withheld.
    expect(noLoad.e_star).toBe(2)
    expect(noLoad.mpeGrams).toBeNull()
  })

  it('blocks when the load lies outside the weighing range', () => {
    const below = evaluate({ ...full, loadGrams: 10 })
    expectBlocked(below)
    expect(below.issues[0].message).toContain('below the weighing range')

    const above = evaluate({ ...full, loadGrams: 20_000 })
    expectBlocked(above)
    expect(above.issues[0].message).toContain('above the weighing range')
    expect(above.mpeGrams).toBeNull()
  })

  it('never modifies the observation it was given', () => {
    const observation: TestObservationInput = { ...full, nextIndicationGrams: 2_001 }
    evaluateDigitalWeighingObservation(EXAMPLE, observation)

    expect(observation).toEqual({ ...full, nextIndicationGrams: 2_001 })
    expect(observation.nextIndicationGrams).toBe(2_001)
  })
})

describe('the changeover relationship I → I_next (A.4.4.3)', () => {
  it('blocks when the next indication did not increase', () => {
    const equal = evaluate({ ...TRANSITION, nextIndicationGrams: 2_000 })
    expect(equal.status).toBe('blocked')
    expect(equal.issues.some((issue) => issue.message.includes('is not greater than I'))).toBe(true)

    const lower = evaluate({ ...TRANSITION, nextIndicationGrams: 1_998 })
    expect(lower.status).toBe('blocked')
    expect(lower.issues.some((issue) => issue.message.includes('is not greater than I'))).toBe(true)
  })

  it('blocks when the step is not one scale interval of the range the next indication appears in', () => {
    const twoSteps = evaluate({ ...TRANSITION, nextIndicationGrams: 2_004 })
    expect(twoSteps.status).toBe('blocked')
    const issue = twoSteps.issues.find((candidate) => candidate.field === 'nextIndication')
    expect(issue?.ruleId).toBe('r76.a4.4.3.changeover-not-one-interval')
    expect(issue?.message).toContain('I_next − I = 4 g')
    expect(issue?.message).toContain('e* = 2 g')
    expect(issue?.detail).toContain('I + e₂ = 2000 g + 2 g = 2002 g')

    // Inside partial weighing range 1 the same requirement uses e₁ = 1 g.
    const inRangeOne = evaluate({
      loadGrams: 1_000,
      indicationGrams: 1_000,
      additionalLoadGrams: 0.6,
      nextIndicationGrams: 1_002,
      zeroErrorGrams: 0.2,
    })
    expect(inRangeOne.status).toBe('blocked')
    expect(inRangeOne.issues.some((candidate) => candidate.message.includes('e* = 1 g'))).toBe(true)
  })

  it('accepts a changeover of exactly one scale interval on either side of a boundary', () => {
    // Below the boundary: e* = e₁ = 1 g.
    expect(
      evaluate({
        loadGrams: 1_999,
        indicationGrams: 1_999,
        additionalLoadGrams: 0.6,
        nextIndicationGrams: 2_000,
        zeroErrorGrams: 0.2,
      }).status,
    ).toBe('evaluated')

    // Across the boundary: e* = e₂ = 2 g.
    expect(evaluateDigitalWeighingObservation(EXAMPLE, TRANSITION).status).toBe('evaluated')
  })
})

describe('arithmetic helpers', () => {
  it('halves a verification scale interval exactly', () => {
    expect(halfIntervalGrams(1)).toBe(0.5)
    expect(halfIntervalGrams(2)).toBe(1)
    expect(halfIntervalGrams(10)).toBe(5)
    expect(halfIntervalGrams(0.1)).toBe(0.05)
    expect(halfIntervalGrams(0.2)).toBe(0.1)
  })

  it('refuses to halve an interval that is not representable, instead of rounding it', () => {
    expect(halfIntervalGrams(0)).toBeNull()
    expect(halfIntervalGrams(-1)).toBeNull()
    expect(halfIntervalGrams(0.000001)).toBeNull() // one microgram: no exact half
  })

  it('takes absolute values at the internal resolution', () => {
    expect(absoluteGrams(-0.9)).toBe(0.9)
    expect(absoluteGrams(0.9)).toBe(0.9)
    expect(absoluteGrams(0)).toBe(0)
    expect(absoluteGrams(-1_999.6)).toBe(1_999.6)
  })
})

describe('unit and instrument safety', () => {
  it('evaluates an observation entered in kilograms exactly like the same one in grams', () => {
    const inGrams = evaluateDigitalWeighingObservation(EXAMPLE, TRANSITION)
    const inKilograms = evaluateDigitalWeighingObservation(EXAMPLE, {
      loadGrams: toGrams(2, 'kg'),
      indicationGrams: toGrams(2, 'kg'),
      additionalLoadGrams: toGrams(0.0014, 'kg'),
      nextIndicationGrams: toGrams(2.002, 'kg'),
      zeroErrorGrams: toGrams(0.0005, 'kg'),
    })

    expect(inKilograms.P).toEqual(inGrams.P)
    expect(inKilograms.E).toEqual(inGrams.E)
    expect(inKilograms.Ec).toEqual(inGrams.Ec)
    expect(inKilograms.mpeGrams).toEqual(inGrams.mpeGrams)
    expect(inKilograms.passed).toEqual(inGrams.passed)
  })

  it('evaluates a fractional interval instrument with ½ e* = 0.05 g', () => {
    const fine = fineIntervalInstrument() // one partial weighing range, e₁ = d = 0.1 g
    const result = evaluateDigitalWeighingObservation(fine, {
      loadGrams: 50,
      indicationGrams: 50,
      additionalLoadGrams: 0.05,
      nextIndicationGrams: 50.1,
      zeroErrorGrams: 0.02,
    })

    expect(result.status).toBe('evaluated')
    expect(result.e_L).toBe(0.1)
    expect(result.e_star).toBe(0.1)
    expect(result.m).toBe(500) // the ± 0.5 e bracket edge
    expect(result.mpeGrams).toBe(0.05)
    expect(result.halfEStarGrams).toBe(0.05)
    expect(result.P).toBe(50) // 50 + 0.05 − 0.05
    expect(result.E).toBe(0)
    expect(result.Ec).toBe(-0.02)
    expect(result.passed).toBe(true)
  })

  it('records the clauses the evaluation rests on', () => {
    const result = evaluateDigitalWeighingObservation(EXAMPLE, TRANSITION)

    expect(result.references.length).toBeGreaterThan(4)
    const quoted = result.references.map((reference) => reference.quote ?? '').join(' ')
    expect(quoted).toContain('P = I + ½ e – ΔL')
    expect(quoted).toContain('E = P – L')
    expect(quoted).toContain('Ec = E – E0 ≤ mpe')
    expect(quoted).toContain('according to the partial weighing range in which the indication (I + e) appears')
    expect(result.references.every((reference) => reference.document === 'OIML R 76-1:2006 (E)')).toBe(true)
  })

  it('carries the Phase 2 resolution inside the result instead of resolving twice', () => {
    const result = evaluateDigitalWeighingObservation(EXAMPLE, TRANSITION)

    expect(result.resolution.ranges.e_L).toBe(result.e_L)
    expect(result.resolution.ranges.e_star).toBe(result.e_star)
    expect(result.resolution.mpe.absoluteMpeGrams).toBe(result.mpeGrams)
    expect(result.resolution.check_I.accepted).toBe(true)
    expect(result.resolution.check_I_next.accepted).toBe(true)
    expect(result.range_L).toBe(result.resolution.ranges.range_L)
  })
})

describe('scope bookkeeping — what this evaluation does not claim', () => {
  const ids = PENDING_RULES.map((rule) => rule.id)

  it('no longer lists the errors of indication as pending', () => {
    expect(ids).not.toContain('r76.3.5.3.errors-of-indication')
  })

  it('lists the requirements that need more than one observation, or a model this build does not have', () => {
    expect(ids).toContain('r76.3.6.1.repeatability') // §3.6.1 — several weighings of the same load
    expect(ids).toContain('r76.3.6.2.eccentric-loading') // §3.6.2 — several load positions
    expect(ids).toContain('r76.a4.2.3.zero-setting-accuracy') // where E₀ is measured
    expect(ids).toContain('r76.a4.4.1.weighing-test-suite') // ≥ 10 test loads, reports
    expect(ids).toContain('r76.a4.4.3.determination-accuracy') // uncertainty, grey zone
    expect(ids).toContain('r76.3.5.2.mpe-in-service') // §3.5.2 — twice the limit
    expect(ids).toContain('r76.3.3.4.tare-device') // net load
  })

  it('records the rounding-error clause as satisfied structurally rather than as unimplemented', () => {
    const rounding = PENDING_RULES.find((rule) => rule.id === 'r76.3.5.3.2.rounding-error-elimination')

    expect(rounding?.reason).toBe('not-applicable-to-scope')
    expect(rounding?.note).toContain('P = I + ½ e* − ΔL')
    expect(rounding?.note).toContain('d = e > 0.2 e')
  })
})
