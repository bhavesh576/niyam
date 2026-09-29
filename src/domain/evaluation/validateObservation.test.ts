import { describe, expect, it } from 'vitest'
import { officialExampleInstrument } from '../../testing/fixtures'
import { createExampleObservationDraft } from '../../data/defaultConfiguration'
import { toTestObservationInput } from '../models/observation'
import { validateObservation } from './validateObservation'
import type { TestObservationInput } from './types'

/**
 * Pre-calculation validation of one observation.
 *
 * These tests pin the rule identifier and the wording of every reason an evaluation can be refused,
 * because that wording is part of the deliverable: it has to name the missing or inadmissible
 * quantity and the step of A.4.4.3 that needs it. They also pin that the observation is passed
 * through untouched — a refused evaluation reports what was entered, never a repaired version of it.
 */

const EXAMPLE = officialExampleInstrument()
const FULL: TestObservationInput = toTestObservationInput(createExampleObservationDraft())

function validate(overrides: Partial<TestObservationInput> = {}) {
  return validateObservation(EXAMPLE, { ...FULL, ...overrides })
}

/** Every issue of a validation, as `field: ruleId` pairs, in the order they are reported. */
function fields(result: ReturnType<typeof validate>) {
  return result.issues.map((issue) => `${issue.field}: ${issue.ruleId}`)
}

function firstMessage(result: ReturnType<typeof validate>) {
  return result.issues[0].message
}

describe('a complete, admissible observation', () => {
  it('can be evaluated', () => {
    const result = validate()

    expect(result.canEvaluate).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.resolution.ranges.e_L).toBe(1)
    expect(result.resolution.ranges.e_star).toBe(2)
  })

  it('accepts a zero error of exactly zero and an additional load of exactly zero', () => {
    expect(validate({ zeroErrorGrams: 0 }).canEvaluate).toBe(true)
    // A.4.4.3 describes adding load until the indication increases but fixes no numerical lower
    // bound for ΔL; only a negative ΔL cannot be an added load. Nothing is invented here.
    expect(validate({ additionalLoadGrams: 0 }).canEvaluate).toBe(true)
  })

  it('accepts a load exactly at Min, in the lowest mpe bracket', () => {
    const result = validate({ loadGrams: 20, indicationGrams: 20, nextIndicationGrams: 21, additionalLoadGrams: 0.6 })

    expect(result.canEvaluate).toBe(true)
    expect(result.resolution.mpe.m).toBe(20) // bracket 0 ≤ m ≤ 500
    expect(result.resolution.mpe.coefficient).toBe(0.5)
    expect(result.resolution.mpe.absoluteMpeGrams).toBe(0.5)
  })

  it('refuses a changeover at Max, because the next indication would lie above the weighing range', () => {
    // I_next = 15 010 g > Max = 15 kg. §4.2.3 allows indications up to Max + 9 e, but that clause is
    // verified and deliberately not applied in this build (see docs/r76-verified-extracts.md), so the
    // weighing range ends at Max and no changeover can be observed there.
    const result = validate({ loadGrams: 15_000, indicationGrams: 15_000, nextIndicationGrams: 15_010, additionalLoadGrams: 6 })

    expect(result.canEvaluate).toBe(false)
    expect(fields(result)).toEqual(['nextIndication: r76.a4.4.3.next-indication-outside-weighing-range'])
    expect(firstMessage(result)).toContain('above the weighing range')
    expect(result.resolution.ranges.e_star).toBeNull()
  })

  it('keeps a load out of the displayability requirement', () => {
    // 2 001 g is an ordinary LOAD in partial weighing range 2, even though no range displays it.
    const result = validate({ loadGrams: 2_001, indicationGrams: 2_002, nextIndicationGrams: 2_004, additionalLoadGrams: 1.6 })

    expect(result.canEvaluate).toBe(true)
    expect(result.resolution.ranges.e_L).toBe(2)
    expect(result.resolution.ranges.e_star).toBe(2)
  })
})

describe('required quantities', () => {
  it('reports each missing quantity with the step of A.4.4.3 that needs it', () => {
    expect(fields(validate({ loadGrams: null }))).toEqual(['load: r76.a4.4.3.load-required'])
    expect(firstMessage(validate({ loadGrams: null }))).toBe(
      'L is required: the error of indication is determined at a certain load, L, and the maximum permissible error follows from the partial weighing range that contains it.',
    )

    expect(fields(validate({ indicationGrams: null }))).toEqual(['indication: r76.a4.4.3.indication-required'])
    expect(firstMessage(validate({ indicationGrams: null }))).toContain('I is required')
    expect(firstMessage(validate({ indicationGrams: null }))).toContain('P = I + ½ e')

    expect(fields(validate({ additionalLoadGrams: null }))).toEqual(['additionalLoad: r76.a4.4.3.additional-load-required'])
    expect(firstMessage(validate({ additionalLoadGrams: null }))).toBe('ΔL is required to determine the changeover point.')

    expect(fields(validate({ nextIndicationGrams: null }))).toEqual(['nextIndication: r76.a4.4.3.next-indication-required'])
    expect(firstMessage(validate({ nextIndicationGrams: null }))).toBe('I_next is required for the digital changeover calculation.')

    expect(fields(validate({ zeroErrorGrams: null }))).toEqual(['zeroError: r76.a4.4.3.zero-error-required'])
    expect(firstMessage(validate({ zeroErrorGrams: null }))).toBe('Cannot evaluate: E0 is required for corrected error Ec.')
  })

  it('reports every missing quantity at once, in the order the calculation needs them', () => {
    const result = validate({
      loadGrams: null,
      indicationGrams: null,
      additionalLoadGrams: null,
      nextIndicationGrams: null,
      zeroErrorGrams: null,
    })

    expect(result.canEvaluate).toBe(false)
    expect(fields(result)).toEqual([
      'load: r76.a4.4.3.load-required',
      'indication: r76.a4.4.3.indication-required',
      'additionalLoad: r76.a4.4.3.additional-load-required',
      'nextIndication: r76.a4.4.3.next-indication-required',
      'zeroError: r76.a4.4.3.zero-error-required',
    ])
    expect(result.issues.every((issue) => issue.severity === 'error')).toBe(true)
    expect(result.issues.every((issue) => (issue.detail ?? '').length > 0)).toBe(true)
  })

  it('rejects a negative additional load, naming the value as entered', () => {
    const result = validate({ additionalLoadGrams: -1.4 })

    expect(fields(result)).toEqual(['additionalLoad: r76.a4.4.3.additional-load-negative'])
    expect(firstMessage(result)).toContain('is negative')
    expect(firstMessage(result)).toContain('1.4 g')
  })
})

describe('indications, resolved through the instrument', () => {
  it('reuses the Phase 2 indication-consistency rule for I and for I_next', () => {
    const indication = validate({ indicationGrams: 2_001 })
    expect(fields(indication)).toEqual(['indication: r76.t3.2.2.indication-scale-interval'])
    expect(firstMessage(indication)).toContain('Invalid indication')
    expect(firstMessage(indication)).toContain('e₂ = 2 g')
    expect(firstMessage(indication)).toContain('2001 g / 2 g = 1,000.5')

    const next = validate({ nextIndicationGrams: 2_001 })
    expect(fields(next)).toEqual(['nextIndication: r76.t3.2.2.indication-scale-interval'])
    expect(firstMessage(next)).toContain('Invalid next indication')
    expect(firstMessage(next)).toContain('2001 g is not a multiple of 2 g')
  })

  it('withholds e* when the next indication was rejected', () => {
    const result = validate({ nextIndicationGrams: 2_001 })

    expect(result.resolution.ranges.e_star).toBeNull()
    // The range itself resolves — what is refused is the indication, not the range.
    expect(result.resolution.ranges.range_I_next.status).toBe('resolved')
    expect(result.resolution.ranges.range_I_next.displayable).toBe(false)
    expect(result.resolution.check_I_next.accepted).toBe(false)
    expect(result.resolution.check_I_next.ruleId).toBe('r76.t3.2.2.indication-scale-interval')
  })

  it('rejects indications outside the weighing range, on both sides', () => {
    const above = validate({ indicationGrams: 20_000, nextIndicationGrams: 20_002 })
    expect(fields(above)).toEqual([
      'indication: r76.a4.4.3.indication-outside-weighing-range',
      'nextIndication: r76.a4.4.3.next-indication-outside-weighing-range',
    ])
    expect(above.issues[0].message).toContain('above the weighing range')
    expect(above.issues[1].message).toContain('e* cannot be resolved')

    const below = validate({ loadGrams: 1_000, indicationGrams: 10, nextIndicationGrams: 11 })
    expect(below.issues[0].message).toContain('below the weighing range')
  })

  it('rejects a load outside the weighing range with the Phase 2 rule', () => {
    const below = validate({ loadGrams: 10 })
    expect(fields(below)).toEqual(['load: r76.t3.1.4.load-outside-weighing-range'])
    expect(firstMessage(below)).toContain('L is below the weighing range (10 g)')
    expect(firstMessage(below)).toContain('Table 6 gives no maximum permissible error')

    const above = validate({ loadGrams: 20_000 })
    expect(firstMessage(above)).toContain('L is above the weighing range (20 kg)')
    expect(above.resolution.mpe.status).not.toBe('resolved')
  })
})

describe('the changeover relationship of A.4.4.3', () => {
  it('requires the next indication to be greater than the indication', () => {
    for (const next of [2_000, 1_998]) {
      const result = validate({ nextIndicationGrams: next })

      expect(fields(result)).toEqual(['nextIndication: r76.a4.4.3.changeover-not-increased'])
      expect(firstMessage(result)).toContain('is not greater than I = 2 kg')
      expect(firstMessage(result)).toContain('increased unambiguously by one scale interval')
    }
  })

  it('requires the step to be one scale interval of the range in which (I + e) appears', () => {
    const result = validate({ nextIndicationGrams: 2_004 })

    expect(fields(result)).toEqual(['nextIndication: r76.a4.4.3.changeover-not-one-interval'])
    expect(firstMessage(result)).toContain('is not one scale interval')
    expect(firstMessage(result)).toContain('4 g')
    expect(firstMessage(result)).toContain('e* = 2 g')
  })

  it('measures the step against e*, not against the interval of the load', () => {
    // Inside partial weighing range 1 a step of 2 g is one e₂ but not one e₁ → rejected.
    const inRangeOne = validate({
      loadGrams: 1_000,
      indicationGrams: 1_000,
      nextIndicationGrams: 1_002,
      additionalLoadGrams: 0.6,
    })
    expect(fields(inRangeOne)).toEqual(['nextIndication: r76.a4.4.3.changeover-not-one-interval'])
    expect(firstMessage(inRangeOne)).toContain('e* = 1 g')

    // A step of one e₁ up to Max₁ stays inside range 1, where e* = e₁ = 1 g → accepted.
    const accepted = validate({
      loadGrams: 1_999,
      indicationGrams: 1_999,
      nextIndicationGrams: 2_000,
      additionalLoadGrams: 0.6,
    })
    expect(accepted.canEvaluate).toBe(true)
    expect(accepted.resolution.ranges.e_star).toBe(1)
  })

  it('does not judge the step when an indication was already rejected', () => {
    const result = validate({ indicationGrams: 2_001, nextIndicationGrams: 2_001 })

    // Both indications fail the displayability requirement; no changeover rule is stacked on top.
    expect(fields(result)).toEqual([
      'indication: r76.t3.2.2.indication-scale-interval',
      'nextIndication: r76.t3.2.2.indication-scale-interval',
    ])
  })

  it('never invents a next indication to make an observation fit', () => {
    const result = validate({ nextIndicationGrams: 2_001 })
    const detail = result.issues[0].detail ?? ''

    // The detail states what was observed and what the instrument could display — as information
    // only — and says plainly that the entered value stands.
    expect(detail).toContain('the observed next indication is I + e₂ = 2000 g + 2 g = 2002 g')
    expect(detail).toContain('The entered value is not rounded, corrected or replaced')
    expect(detail).toContain('the nearest indications this instrument could display')
    expect(result.resolution.check_I_next.valueGrams).toBe(2_001)
  })
})

describe('accumulation and pass-through', () => {
  it('reports every independent reason at once', () => {
    const result = validate({
      loadGrams: 10,
      indicationGrams: 2_001,
      additionalLoadGrams: -1.4,
      nextIndicationGrams: 2_004,
      zeroErrorGrams: null,
    })

    expect(result.canEvaluate).toBe(false)
    // Four reasons: the step is not judged because I was rejected.
    expect(fields(result)).toEqual([
      'load: r76.t3.1.4.load-outside-weighing-range',
      'indication: r76.t3.2.2.indication-scale-interval',
      'additionalLoad: r76.a4.4.3.additional-load-negative',
      'zeroError: r76.a4.4.3.zero-error-required',
    ])
  })

  it('passes the observation through unchanged, however it was refused', () => {
    const observation: TestObservationInput = {
      loadGrams: 10,
      indicationGrams: 2_001,
      additionalLoadGrams: -1.4,
      nextIndicationGrams: 2_004,
      zeroErrorGrams: null,
    }

    validateObservation(EXAMPLE, observation)

    // The validator reports about the observation; it does not write back into it.
    expect(observation).toEqual({
      loadGrams: 10,
      indicationGrams: 2_001,
      additionalLoadGrams: -1.4,
      nextIndicationGrams: 2_004,
      zeroErrorGrams: null,
    })
  })

  it('still resolves what can be resolved when something else is missing', () => {
    const result = validate({ loadGrams: null })

    // The indication side is unaffected by the missing load, so e* is still reported.
    expect(result.resolution.ranges.e_star).toBe(2)
    expect(result.resolution.check_I.accepted).toBe(true)
    expect(result.resolution.check_I_next.accepted).toBe(true)
    // …but the mpe belongs to the load, so it is not resolved.
    expect(result.resolution.mpe.status).not.toBe('resolved')
  })
})
