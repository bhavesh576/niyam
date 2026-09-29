import { describe, expect, it } from 'vitest'
import { officialExampleInstrument } from '../../testing/fixtures'
import { createExampleObservationDraft, createFailingObservationDraft } from '../../data/defaultConfiguration'
import { toTestObservationInput } from '../models/observation'
import { evaluateDigitalWeighingObservation } from './evaluateObservation'
import {
  calculationLines,
  calculationTrace,
  eStarStatement,
  evaluationSummary,
  mpeBracketStatement,
  signedMass,
  signedValue,
  verdictLabel,
  verdictStatement,
} from './describe'
import type { EvaluationResult, TestObservationInput } from './types'

/**
 * The wording the test screen shows.
 *
 * These strings are part of the deliverable: the result panel has to print the substitution exactly
 * as A.4.4.3 prints it (`P = (1 000 + 2.5 – 1.5) g = 1 001 g`), keep the signs of E, E₀ and Ec, and
 * the calculation trace has to be the same ten steps in the same order every time — a deterministic
 * record, not an explanation that varies. Pinning them here means a rewording cannot slip through
 * unnoticed.
 */

const EXAMPLE = officialExampleInstrument()
const TRANSITION = toTestObservationInput(createExampleObservationDraft())

function evaluate(overrides: Partial<TestObservationInput> = {}): EvaluationResult {
  return evaluateDigitalWeighingObservation(EXAMPLE, { ...TRANSITION, ...overrides })
}

const PASS = evaluate()
const FAIL = evaluateDigitalWeighingObservation(EXAMPLE, toTestObservationInput(createFailingObservationDraft()))
const AT_LIMIT = evaluate({ zeroErrorGrams: 0.6 })

describe('signed formatting', () => {
  it('keeps the sign R-76 gives a quantity, and prints zero without one', () => {
    expect(signedValue(-0.4)).toBe('−0.4')
    expect(signedValue(0.5)).toBe('+0.5')
    expect(signedValue(0)).toBe('0')
    expect(signedValue(-1_999.6)).toBe('−1999.6')
  })

  it('adds the unit', () => {
    expect(signedMass(-0.9)).toBe('−0.9 g')
    expect(signedMass(1_999.6)).toBe('+1999.6 g')
    expect(signedMass(0)).toBe('0 g')
  })
})

describe('the verdict', () => {
  it('says PASS, FAIL, or that nothing was evaluated', () => {
    expect(verdictLabel(PASS)).toBe('PASS')
    expect(verdictLabel(FAIL)).toBe('FAIL')
    expect(verdictLabel(evaluate({ nextIndicationGrams: null }))).toBe('not evaluated')
  })

  it('states the comparison it made, with the margin or the excess', () => {
    expect(verdictStatement(PASS)).toBe('|Ec| = 0.9 g ≤ mpe = 1 g — margin 0.1 g')
    expect(verdictStatement(FAIL)).toBe('|Ec| = 1.1 g > mpe = 1 g — excess 0.1 g')
    expect(verdictStatement(evaluate({ nextIndicationGrams: null }))).toBe('no verdict — the observation was not evaluated')
  })

  it('says so when the corrected error sits exactly on the limit', () => {
    expect(verdictLabel(AT_LIMIT)).toBe('PASS')
    expect(verdictStatement(AT_LIMIT)).toBe('|Ec| = 1 g ≤ mpe = 1 g — margin 0 g (exactly at the limit, which is inside it)')
  })
})

describe('e* named with the range it came from', () => {
  it('names the partial weighing range in which (I + e) appears', () => {
    expect(eStarStatement(PASS)).toBe(
      'e* = e₂ = 2 g — the scale interval of partial weighing range 2, in which the indication (I + e) appears',
    )
  })

  it('names range 1 when the changeover stays inside it', () => {
    const inside = evaluate({ loadGrams: 1_000, indicationGrams: 1_000, nextIndicationGrams: 1_001, additionalLoadGrams: 0.6 })
    expect(eStarStatement(inside)).toBe(
      'e* = e₁ = 1 g — the scale interval of partial weighing range 1, in which the indication (I + e) appears',
    )
  })

  it('reports that e* was not resolved instead of falling back on e_L', () => {
    expect(eStarStatement(evaluate({ nextIndicationGrams: null }))).toBe('e* — not resolved (no value)')
    expect(eStarStatement(evaluate({ nextIndicationGrams: 20_000 }))).toBe('e* — above the weighing range (20 kg)')
    expect(eStarStatement(evaluate({ nextIndicationGrams: 2_001 }))).toBe(
      'e* is not resolved — the next indication is not an indication its partial weighing range can display',
    )
  })
})

describe('the calculation, printed as A.4.4.3 prints it', () => {
  it('substitutes the observed values into the three formulae and then compares', () => {
    expect(calculationLines(PASS)).toEqual([
      { formula: 'P = I + ½e* − ΔL', substitution: 'P = (2000 + 1 − 1.4) g', result: '= 1999.6 g', clause: 'A.4.4.3' },
      { formula: 'E = P − L', substitution: 'E = (1999.6 − 2000) g', result: '= −0.4 g', clause: 'A.4.4.3' },
      { formula: 'Ec = E − E₀', substitution: 'Ec = (−0.4 − (+0.5)) g', result: '= −0.9 g', clause: 'A.4.4.3' },
      { formula: '|Ec| ≤ mpe', substitution: '|−0.9| g = 0.9 g ≤ 1 g', result: 'PASS', clause: 'A.4.4.3 with Table 6' },
    ])
  })

  it('shows the same substitution for a failing observation, with the comparison reversed', () => {
    const lines = calculationLines(FAIL)

    expect(lines[0]).toEqual({ formula: 'P = I + ½e* − ΔL', substitution: 'P = (2000 + 1 − 1.6) g', result: '= 1999.4 g', clause: 'A.4.4.3' })
    expect(lines[2].result).toBe('= −1.1 g')
    expect(lines[3]).toEqual({ formula: '|Ec| ≤ mpe', substitution: '|−1.1| g = 1.1 g > 1 g', result: 'FAIL', clause: 'A.4.4.3 with Table 6' })
  })

  it('marks a comparison made exactly at the limit', () => {
    expect(calculationLines(AT_LIMIT)[3].result).toBe('PASS (exactly at the limit)')
    expect(calculationLines(AT_LIMIT)[3].substitution).toBe('|−1| g = 1 g ≤ 1 g')
  })

  it('prints no intermediate value for an observation that was not evaluated', () => {
    expect(calculationLines(evaluate({ nextIndicationGrams: null }))).toEqual([])
    expect(calculationLines(evaluate({ zeroErrorGrams: null }))).toEqual([])
    expect(calculationLines(evaluate({ additionalLoadGrams: -1.4 }))).toEqual([])
  })
})

describe('the calculation trace', () => {
  it('is the same ten steps, in the order the calculation needs them', () => {
    const steps = calculationTrace(PASS)

    expect(steps).toHaveLength(10)
    expect(steps.map((step) => step.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(steps.map((step) => step.label)).toEqual([
      'Load range resolved',
      'Load verification interval resolved',
      'MPE resolved',
      'Indication range resolved',
      'Next indication range resolved',
      'e* resolved',
      'P calculated',
      'E calculated',
      'E₀ correction applied',
      'Ec compared with MPE',
    ])
    expect(steps.every((step) => step.completed)).toBe(true)
    expect(steps.every((step) => (step.clause ?? '').length > 0)).toBe(true)
  })

  it('shows the transition in the steps that resolve it', () => {
    const steps = calculationTrace(PASS)

    expect(steps[0].value).toBe('L = 2000 g → Range 1 (20 g → 2 kg)')
    expect(steps[1].value).toBe('e_L = e₁ = 1 g (from the partial weighing range of L, never a global e)')
    expect(steps[3].value).toContain('I = 2000 g → Range 1 (20 g → 2 kg), e₁ = 1 g — displayable')
    expect(steps[4].value).toContain('I_next = 2002 g → Range 2 (2 kg → 5 kg), e₂ = 2 g — displayable')
    expect(steps[5].value).toContain('e* = e₂ = 2 g')
    expect(steps[6].value).toBe('P = I + ½e* − ΔL = (2000 + 1 − 1.4) g = 1999.6 g')
    expect(steps[7].value).toBe('E = P − L = (1999.6 − 2000) g = −0.4 g')
    expect(steps[8].value).toBe('Ec = E − E₀ = (−0.4 − (+0.5)) g = −0.9 g')
    expect(steps[9].value).toBe('|Ec| = 0.9 g ≤ mpe = 1 g — margin 0.1 g → PASS')
    expect(steps[9].clause).toBe('A.4.4.3, §3.5.1 Table 6')
  })

  it('ends in FAIL for a failing observation, with every step still completed', () => {
    const steps = calculationTrace(FAIL)

    expect(steps.every((step) => step.completed)).toBe(true)
    expect(steps[9].value).toBe('|Ec| = 1.1 g > mpe = 1 g — excess 0.1 g → FAIL')
  })

  it('stops at the step a missing quantity belongs to, and says why', () => {
    const steps = calculationTrace(evaluate({ nextIndicationGrams: null }))

    expect(steps.filter((step) => step.completed).map((step) => step.step)).toEqual([1, 2, 3, 4])
    expect(steps[4].value).toBe('I_next is required for the digital changeover calculation.')
    expect(steps[5].value).toBe('I_next is required for the digital changeover calculation.')
    expect(steps[6].value).toBe('not calculated — the evaluation was blocked before this step')
    expect(steps[9].value).toBe('not calculated — the evaluation was blocked before this step')
  })

  it('stops at the E₀ correction when E₀ is missing, with the required-value message', () => {
    const steps = calculationTrace(evaluate({ zeroErrorGrams: null }))

    expect(steps.filter((step) => step.completed).map((step) => step.step)).toEqual([1, 2, 3, 4, 5, 6])
    expect(steps[8].value).toBe('Cannot evaluate: E0 is required for corrected error Ec.')
  })

  it('stops at P when ΔL is inadmissible, and at the indication step when I is inadmissible', () => {
    const deltaL = calculationTrace(evaluate({ additionalLoadGrams: -1.4 }))
    expect(deltaL.filter((step) => step.completed).map((step) => step.step)).toEqual([1, 2, 3, 4, 5, 6])
    expect(deltaL[6].value).toContain('is negative')

    const indication = calculationTrace(evaluate({ indicationGrams: 2_001 }))
    expect(indication[3].value).toContain('not displayable')
    expect(indication[3].completed).toBe(false)
    // e* is still resolved from I_next — the trace reports what was resolved, not what was used.
    expect(indication[5].completed).toBe(true)
    expect(indication[6].completed).toBe(false)
  })

  it('is deterministic: the same observation produces byte-identical steps', () => {
    expect(calculationTrace(evaluate())).toEqual(calculationTrace(evaluate()))
    expect(calculationTrace(FAIL)).toEqual(
      calculationTrace(evaluateDigitalWeighingObservation(EXAMPLE, toTestObservationInput(createFailingObservationDraft()))),
    )
  })
})

describe('the one-line summaries', () => {
  it('lists all three ranges and both intervals, so a transition is visible at a glance', () => {
    expect(evaluationSummary(PASS)).toBe(
      'range_L = range 1 · range_I = range 1 · range_I_next = range 2 · e_L = 1 g · e* = 2 g',
    )
    expect(evaluationSummary(FAIL)).toBe(evaluationSummary(PASS))
  })

  it('reports what could not be resolved instead of implying a value', () => {
    expect(evaluationSummary(evaluate({ nextIndicationGrams: null }))).toBe(
      'range_L = range 1 · range_I = range 1 · range_I_next = not resolved · e_L = 1 g · e* = not resolved',
    )
    expect(evaluationSummary(evaluate({ loadGrams: null }))).toBe(
      'range_L = not resolved · range_I = range 1 · range_I_next = range 2 · e_L = not resolved · e* = 2 g',
    )
  })

  it('states the Table 6 bracket, the coefficient and the absolute limit in one line', () => {
    expect(mpeBracketStatement(PASS)).toBe('m = 2,000 → 500 < m ≤ 2 000 → ± 1.0 e₁ → mpe = ± 1 g')

    // The other two class III brackets, each observed inside the partial weighing range it belongs to.
    const lowest = evaluate({ loadGrams: 500, indicationGrams: 500, nextIndicationGrams: 501, additionalLoadGrams: 0.5 })
    expect(mpeBracketStatement(lowest)).toBe('m = 500 → 0 ≤ m ≤ 500 → ± 0.5 e₁ → mpe = ± 0.5 g')

    const highest = evaluate({ loadGrams: 5_000, indicationGrams: 5_000, nextIndicationGrams: 5_010, additionalLoadGrams: 4.2 })
    expect(mpeBracketStatement(highest)).toBe('m = 2,500 → 2 000 < m ≤ 10 000 → ± 1.5 e₂ → mpe = ± 3 g')
  })

  it('says that no bracket was resolved when the load could not be resolved', () => {
    expect(mpeBracketStatement(evaluate({ loadGrams: null }))).toBe('no Table 6 bracket resolved')
    expect(mpeBracketStatement(evaluate({ loadGrams: 20_000 }))).toBe('no Table 6 bracket resolved')
  })
})
