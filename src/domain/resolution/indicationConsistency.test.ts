import { describe, expect, it } from 'vitest'
import { fineIntervalInstrument, officialExampleInstrument } from '../../testing/fixtures'
import { consistencyLabel } from './describe'
import {
  INDICATION_SCALE_INTERVAL_RULE_ID,
  checkIndication,
  checkIndications,
  indicationIssue,
  neighbouringIndications,
} from './indicationConsistency'
import { resolveRanges } from './rangeResolver'
import { resolveTestCondition } from './resolveTestCondition'
import type { TestConditionInput } from './types'

/**
 * Indication consistency: a LOAD is applied mass, an INDICATION is a displayed value.
 *
 * The two required cases are the first two tests of the first describe block — the one the default
 * example used to get wrong (I = 2 000 g, I_next = 2 001 g, resolved range with e₂ = 2 g) and the
 * valid 2 g changeover indication next to it (I_next = 2 002 g).
 *
 * Everything rests on verified text of OIML R 76-1:2006: T.3.2.2 (d is "the difference between two
 * consecutive indicated values"), T.3.2.6 (partial weighing ranges "each with different scale
 * intervals"), Table 2 with §3.4.1 (e = d, no auxiliary indicating device), §4.2.2.2 (the "Allowed
 * indications" printed per partial weighing range) and A.4.4.3 with its multi-interval note (the
 * next indication is (I + e), with the interval of "the partial weighing range in which the
 * indication (I + e) appears").
 */

const EXAMPLE = officialExampleInstrument()

function resolve(overrides: Partial<TestConditionInput> = {}) {
  return resolveTestCondition(EXAMPLE, {
    loadGrams: null,
    indicationGrams: null,
    nextIndicationGrams: null,
    ...overrides,
  })
}

describe('indication consistency — the changeover of the R-76 class III example', () => {
  it('does NOT accept I_next = 2 001 g as a changeover indication of a range whose e₂ = 2 g', () => {
    const result = resolve({ loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_001 })

    // The value really does fall in partial weighing range 2 …
    expect(result.ranges.range_I_next.status).toBe('resolved')
    expect(result.ranges.range_I_next.range?.rangeNumber).toBe(2)
    expect(result.ranges.range_I_next.applicableIntervalGrams).toBe(2)

    // … but a range that displays in steps of 2 g cannot indicate 2 001 g.
    expect(result.check_I_next.accepted).toBe(false)
    expect(result.check_I_next.status).toBe('not-displayable')
    expect(result.indicationsAccepted).toBe(false)
    expect(result.issues).toEqual([result.check_I_next])

    // The message names the resolved range, its interval and the value that conflicts with it.
    expect(result.check_I_next.message).toContain('Invalid next indication')
    expect(result.check_I_next.message).toContain('partial weighing range 2')
    expect(result.check_I_next.message).toContain('e₂ = 2 g')
    expect(result.check_I_next.message).toContain("the instrument's 2 g scale interval")
    expect(result.check_I_next.message).toContain('2001 g is not a multiple of 2 g')
    expect(result.check_I_next.message).toContain('2001 g / 2 g = 1,000.5')

    expect(result.check_I_next.ruleId).toBe(INDICATION_SCALE_INTERVAL_RULE_ID)
    expect(result.check_I_next.intervalsOfIndication).toBe(1_000.5)
    expect(result.check_I_next.reference.clauses).toContain('T.3.2.2')
    expect(result.check_I_next.reference.clauses).toContain('4.2.2.2')
  })

  it('accepts I_next = 2 002 g — the indication one scale interval up in the range it appears in', () => {
    const result = resolve({ loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_002 })

    expect(result.check_I_next.accepted).toBe(true)
    expect(result.check_I_next.status).toBe('consistent')
    expect(result.check_I_next.intervalsOfIndication).toBe(1_001)
    expect(result.check_I_next.message).toBeNull()
    expect(result.check_I_next.ruleId).toBeNull()
    expect(result.indicationsAccepted).toBe(true)
    expect(result.issues).toEqual([])

    // Accepted, so the interval is handed on.
    expect(result.ranges.e_star).toBe(2)
    expect(result.ranges.range_I_next.displayable).toBe(true)
  })

  it('never rounds, corrects or replaces the value the user entered', () => {
    const input: TestConditionInput = { loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_001 }
    const result = resolveTestCondition(EXAMPLE, input)

    expect(result.check_I_next.valueGrams).toBe(2_001)
    expect(result.ranges.range_I_next.valueGrams).toBe(2_001)
    // The input object is not touched either.
    expect(input.nextIndicationGrams).toBe(2_001)
    // The suggestion appears in the explanation only, as information.
    expect(result.check_I_next.detail).toContain('not rounded, corrected or replaced')
    expect(result.check_I_next.detail).toContain('2000 g and 2002 g')
  })

  it('explains the rejection with the observed changeover of A.4.4.3, not with an assumed step', () => {
    const detail = resolve({
      loadGrams: 2_000,
      indicationGrams: 2_000,
      nextIndicationGrams: 2_001,
    }).check_I_next.detail as string

    expect(detail).toContain('T.3.2.2')
    expect(detail).toContain('difference between two consecutive indicated values')
    expect(detail).toContain('each different scale intervals')
    expect(detail).toContain('T.3.2.6')
    expect(detail).toContain('e = d')
    expect(detail).toContain('"Allowed indications"')
    expect(detail).toContain('A.4.4.3')
    expect(detail).toContain('increased unambiguously by one scale interval (I + e)')
    expect(detail).toContain('the partial weighing range in which the indication (I + e) appears')
    expect(detail).toContain('I + e₂ = 2000 g + 2 g = 2002 g')
  })

  it('quotes no changeover observation when there is no indication I to change over from', () => {
    const detail = resolve({ loadGrams: 2_000, nextIndicationGrams: 2_001 }).check_I_next.detail as string

    // No changeover observation is quoted, and no arithmetic is invented, without an I to
    // change over from: the displayability rule alone carries the rejection.
    expect(detail).not.toContain('A.4.4.3')
    expect(detail).not.toContain('I + e₂ = ')
  })

  it('withholds e* while keeping the range membership of I_next truthful', () => {
    const result = resolve({ loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_001 })

    expect(result.ranges.e_star).toBeNull()
    expect(result.ranges.range_I_next.range?.rangeNumber).toBe(2)
    expect(result.ranges.e_L).toBe(1)
    // The result keeps exactly the five documented fields.
    expect(Object.keys(result.ranges)).toEqual(['range_L', 'range_I', 'range_I_next', 'e_L', 'e_star'])
  })
})

describe('indication consistency — load range, indication range and changeover step stay apart', () => {
  it('applies the check to indications only: the same 2 001 g is an ordinary LOAD', () => {
    const asLoad = resolve({ loadGrams: 2_001 })

    expect(asLoad.ranges.range_L.range?.rangeNumber).toBe(2)
    expect(asLoad.ranges.range_L.displayable).toBeNull()
    expect(asLoad.ranges.e_L).toBe(2)
    expect(asLoad.mpe.status).toBe('resolved')
    expect(asLoad.mpe.m).toBe(1_000.5)
    expect(asLoad.mpe.coefficient).toBe(1.0)
    expect(asLoad.mpe.absoluteMpeGrams).toBe(2)
    expect(asLoad.indicationsAccepted).toBe(true)
    expect(asLoad.issues).toEqual([])
  })

  it('checks I and I_next against the interval of the range each of them resolves into', () => {
    // I in partial weighing range 1 (e₁ = 1 g): every whole gram is displayable …
    const rangeOne = resolve({ loadGrams: 1_000, indicationGrams: 1_001 })
    expect(rangeOne.check_I.status).toBe('consistent')

    // … but the same value is not displayable in partial weighing range 2 (e₂ = 2 g).
    const rangeTwo = resolve({ loadGrams: 3_000, indicationGrams: 3_001 })
    expect(rangeTwo.check_I.status).toBe('not-displayable')
    expect(rangeTwo.check_I.message).toContain('Invalid indication')
    expect(rangeTwo.check_I.message).toContain('partial weighing range 2')
    expect(rangeTwo.check_I.message).toContain('e₂ = 2 g')
    // The load side is untouched by a rejected indication.
    expect(rangeTwo.ranges.e_L).toBe(2)
    expect(rangeTwo.mpe.absoluteMpeGrams).toBe(2)

    // Partial weighing range 3 steps in e₃ = 10 g.
    expect(resolve({ loadGrams: 6_000, indicationGrams: 6_005 }).check_I.status).toBe('not-displayable')
    expect(resolve({ loadGrams: 6_000, indicationGrams: 6_010 }).check_I.status).toBe('consistent')
    expect(resolve({ loadGrams: 6_000, nextIndicationGrams: 6_010 }).check_I_next.status).toBe('consistent')
  })

  it('accepts every indication that is a multiple of the interval of its own range', () => {
    const cases: Array<[number, number, string]> = [
      [20, 1, 'Min'],
      [500, 1, 'Table 6 bracket edge'],
      [2_000, 1, 'Max₁ — the bound belongs to partial weighing range 1'],
      [2_002, 2, 'first indication of partial weighing range 2 after the changeover'],
      [4_998, 2, 'inside partial weighing range 2'],
      [5_000, 2, 'Max₂'],
      [5_010, 3, 'first indication of partial weighing range 3'],
      [15_000, 3, 'Max₃ = Max'],
    ]

    for (const [value, expectedRange, why] of cases) {
      const result = resolve({ loadGrams: value, indicationGrams: value })
      expect(result.check_I.status, `${value} g (${why})`).toBe('consistent')
      expect(result.ranges.range_I.range?.rangeNumber, `${value} g (${why})`).toBe(expectedRange)
    }
  })

  it('rejects values inside a partial weighing range that its interval cannot display', () => {
    const cases: Array<[number, number, number]> = [
      [2_001, 2, 2],
      [2_999, 2, 2],
      [4_999, 2, 2],
      [5_005, 3, 10],
      [6_001, 3, 10],
      [14_995, 3, 10],
    ]

    for (const [value, expectedRange, expectedInterval] of cases) {
      const result = resolve({ indicationGrams: value })
      expect(result.check_I.status, `${value} g`).toBe('not-displayable')
      expect(result.check_I.resolvedRangeNumber, `${value} g`).toBe(expectedRange)
      expect(result.check_I.indicationIntervalGrams, `${value} g`).toBe(expectedInterval)
      expect(result.check_I.accepted, `${value} g`).toBe(false)
      expect(result.issues, `${value} g`).toHaveLength(1)
    }
  })

  it('rejects an indication of a fractional interval that is off by half an interval', () => {
    const fine = fineIntervalInstrument() // one partial weighing range, e₁ = d = 0.1 g

    const off = resolveTestCondition(fine, { loadGrams: 500.05, indicationGrams: 500.05, nextIndicationGrams: null })
    expect(off.check_I.status).toBe('not-displayable')
    expect(off.check_I.message).toContain('e₁ = 0.1 g')
    expect(off.check_I.intervalsOfIndication).toBe(5_000.5)
    // A load of 500.05 g is unaffected — the mpe still resolves from range_L.
    expect(off.mpe.status).toBe('resolved')

    const on = resolveTestCondition(fine, { loadGrams: 500.1, indicationGrams: 500.1, nextIndicationGrams: null })
    expect(on.check_I.status).toBe('consistent')
    expect(on.check_I.intervalsOfIndication).toBe(5_001)
  })

  it('has nothing to check when an indication is outside the weighing range or not entered', () => {
    const below = resolve({ loadGrams: 2_000, indicationGrams: 19 })
    expect(below.check_I.status).toBe('not-resolved')
    expect(below.check_I.accepted).toBe(true)
    expect(below.check_I.resolvedRangeNumber).toBeNull()
    expect(below.check_I.indicationIntervalGrams).toBeNull()
    expect(below.issues).toEqual([])

    const above = resolve({ loadGrams: 2_000, nextIndicationGrams: 20_000 })
    expect(above.check_I_next.status).toBe('not-resolved')
    expect(above.check_I_next.accepted).toBe(true)
    expect(above.ranges.e_star).toBeNull()

    const empty = resolve({ loadGrams: 2_000 })
    expect(empty.check_I.status).toBe('not-entered')
    expect(empty.check_I_next.status).toBe('not-entered')
    expect(empty.indicationsAccepted).toBe(true)
    expect(empty.issues).toEqual([])
  })

  it('reports both indications when both are rejected, in field order', () => {
    const result = resolve({ loadGrams: 3_000, indicationGrams: 3_001, nextIndicationGrams: 3_003 })

    expect(result.indicationsAccepted).toBe(false)
    expect(result.issues).toHaveLength(2)
    expect(result.issues.map((issue) => issue.field)).toEqual(['indication', 'nextIndication'])
    expect(result.check_I.symbol).toBe('I')
    expect(result.check_I_next.symbol).toBe('I_next')
  })
})

describe('checkIndications / checkIndication — the pure functions behind the panel', () => {
  it('checks both indications of a range resolution result', () => {
    const ranges = resolveRanges(EXAMPLE, { loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_001 })
    const checks = checkIndications(ranges)

    expect(checks.check_I.accepted).toBe(true)
    expect(checks.check_I_next.accepted).toBe(false)
    expect(checks.indicationsAccepted).toBe(false)
    expect(checks.issues).toHaveLength(1)
  })

  it('maps a rejection onto the field-message shape the UI already renders', () => {
    const result = resolve({ loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_001 })

    const issue = indicationIssue(result.check_I_next)
    expect(issue).not.toBeNull()
    expect(issue!.severity).toBe('error')
    expect(issue!.ruleId).toBe(INDICATION_SCALE_INTERVAL_RULE_ID)
    expect(issue!.field).toBeNull()
    expect(issue!.message).toBe(result.check_I_next.message)
    expect(issue!.detail).toBe(result.check_I_next.detail)
    expect(issue!.reference.clauses).toContain('A.4.4.3')
    expect(issue!.context?.valueGrams).toBe(2_001)
    expect(issue!.context?.indicationIntervalGrams).toBe(2)

    expect(indicationIssue(result.check_I)).toBeNull()
    expect(indicationIssue(resolve({ loadGrams: 2_000 }).check_I_next)).toBeNull()
  })

  it('names the two indications the instrument could display instead, without choosing one', () => {
    expect(neighbouringIndications(2_001, 2)).toEqual({ below: 2_000, above: 2_002 })
    expect(neighbouringIndications(2_999, 2)).toEqual({ below: 2_998, above: 3_000 })
    expect(neighbouringIndications(6_005, 10)).toEqual({ below: 6_000, above: 6_010 })
    expect(neighbouringIndications(500.05, 0.1)).toEqual({ below: 500, above: 500.1 })
    // An exact multiple returns the value itself on both sides.
    expect(neighbouringIndications(2_002, 2)).toEqual({ below: 2_002, above: 2_002 })
    expect(neighbouringIndications(1_000, 0)).toBeNull()
  })

  it('labels each outcome in one short line for the resolution table', () => {
    const result = resolve({ loadGrams: 3_000, indicationGrams: 3_001, nextIndicationGrams: null })

    // checkIndication on its own agrees with checkIndications.
    expect(checkIndication(result.ranges.range_I).status).toBe('not-displayable')
    expect(consistencyLabel(resolve({ loadGrams: 3_000, indicationGrams: 3_000 }).check_I)).toContain(
      'displayable — multiple of e₂ = 2 g',
    )
    expect(consistencyLabel(result.check_I)).toContain('not displayable — not a multiple of e₂ = 2 g')
    expect(consistencyLabel(resolve({ loadGrams: 3_000 }).check_I_next)).toBe('not entered')
    expect(consistencyLabel(resolve({ loadGrams: 3_000, indicationGrams: 19 }).check_I)).toContain(
      'no partial weighing range applies',
    )
  })
})
