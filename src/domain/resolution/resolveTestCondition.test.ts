import { describe, expect, it } from 'vitest'
import { officialExampleInstrument } from '../../testing/fixtures'
import { createMassDraft, massDraftFromGrams } from '../models/draft'
import {
  createTestConditionDraft,
  hasTestLoad,
  toTestConditionInput,
  withTestConditionField,
} from '../models/testCondition'
import { toGrams } from '../../utils/mass'
import { boundaryProbes } from './boundaries'
import {
  applicableIntervalLabel,
  bracketLabel,
  intervalCountLabel,
  intervalSymbol,
  mpeLabel,
  probeChangeLabel,
  probePointLabel,
  rangeLabel,
  resolutionNotes,
} from './describe'
import { resolveTestCondition } from './resolveTestCondition'
import type { TestConditionInput } from './types'

/**
 * The composition layer, the test-condition draft model and the wording the panel renders.
 *
 * The point of these tests is the guarantee Phase 3 depends on: the interval used to form
 * `m = L / e` and the interval the Table 6 coefficient multiplies are the same `e_L`, taken from
 * the partial weighing range that contains the load — and `e*` comes from I_next, never from L.
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

describe('resolveTestCondition — composition', () => {
  it('resolves ranges and mpe for one test condition', () => {
    // The changeover observation of A.4.4.3 for the §3.3.3 example: I = 2 000 g in partial weighing
    // range 1, next indication (I + e) = 2 002 g appearing in partial weighing range 2, where the
    // scale interval is e₂ = 2 g.
    const result = resolve({ loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_002 })

    expect(result.ranges.e_L).toBe(1)
    expect(result.ranges.e_star).toBe(2)
    expect(result.ranges.range_L.range?.rangeNumber).toBe(1)
    expect(result.ranges.range_I.range?.rangeNumber).toBe(1)
    expect(result.ranges.range_I_next.range?.rangeNumber).toBe(2)
    expect(result.check_I.status).toBe('consistent')
    expect(result.check_I_next.status).toBe('consistent')
    expect(result.indicationsAccepted).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.mpe.status).toBe('resolved')
    expect(result.mpe.m).toBe(2_000)
    expect(result.mpe.coefficient).toBe(1.0)
    expect(result.mpe.absoluteMpeGrams).toBe(1)
  })

  it('withholds e* when I_next is not an indication its own partial weighing range can display', () => {
    const result = resolve({ loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_001 })

    // Range membership is still reported truthfully — 2 001 g does fall inside partial weighing
    // range 2 — but the value is not displayable there, because that range steps in e₂ = 2 g.
    expect(result.ranges.range_I_next.status).toBe('resolved')
    expect(result.ranges.range_I_next.range?.rangeNumber).toBe(2)
    expect(result.ranges.range_I_next.applicableIntervalGrams).toBe(2)
    expect(result.ranges.range_I_next.displayable).toBe(false)

    // No interval is handed on from an indication the instrument cannot show.
    expect(result.ranges.e_star).toBeNull()
    expect(result.check_I_next.accepted).toBe(false)
    expect(result.check_I_next.status).toBe('not-displayable')
    expect(result.indicationsAccepted).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].symbol).toBe('I_next')

    // The entered value is reported as entered — never rounded, corrected or replaced.
    expect(result.check_I_next.valueGrams).toBe(2_001)
    expect(result.check_I_next.message).toContain('2001 g')
    expect(result.check_I_next.message).not.toContain('2002 g = ')

    // The load side is untouched: 2 001 g as a LOAD is ordinary, and the mpe comes from range_L.
    expect(result.ranges.e_L).toBe(1)
    expect(result.ranges.range_L.displayable).toBeNull()
    expect(result.check_I.status).toBe('consistent')
    expect(result.mpe.m).toBe(2_000)
    expect(result.mpe.absoluteMpeGrams).toBe(1)
  })

  it('uses the same e_L for m and for the Table 6 coefficient', () => {
    for (const L of [20, 500, 501, 2_000, 2_001, 4_000, 4_001, 5_000, 5_001, 15_000]) {
      const result = resolve({ loadGrams: L })
      expect(result.mpe.verificationIntervalGrams).toBe(result.ranges.e_L)
      expect(result.mpe.verificationIntervalGrams).toBe(result.ranges.range_L.range?.verificationIntervalGrams)
      if (result.mpe.coefficient !== null && result.mpe.absoluteMpeGrams !== null) {
        expect(result.mpe.m).toBeCloseTo(L / (result.ranges.e_L as number), 9)
      }
    }
  })

  it('never lets I or I_next influence the load mpe', () => {
    const plain = resolve({ loadGrams: 4_000 })
    const withIndications = resolve({ loadGrams: 4_000, indicationGrams: 15_000, nextIndicationGrams: 20 })

    expect(plain.mpe).toEqual(withIndications.mpe)
    expect(withIndications.mpe.m).toBe(2_000) // 4 000 / e₂ — not 15 000 / e₂ and not 4 000 / e₁
    expect(withIndications.mpe.absoluteMpeGrams).toBe(2) // ± 1.0 e₂, as printed in §3.3.3
    expect(withIndications.ranges.e_star).toBe(1) // I_next = 20 g is in range 1
  })

  it('reports every quantity as unresolved when nothing was entered', () => {
    const result = resolve()

    expect(result.ranges.range_L.status).toBe('not-a-value')
    expect(result.ranges.range_I.status).toBe('not-a-value')
    expect(result.ranges.range_I_next.status).toBe('not-a-value')
    expect(result.ranges.e_L).toBeNull()
    expect(result.ranges.e_star).toBeNull()
    expect(result.mpe.status).toBe('no-load-value')
    expect(result.mpe.absoluteMpeGrams).toBeNull()
  })

  it('resolves a load entered in kilograms exactly like the same load in grams', () => {
    expect(resolve({ loadGrams: toGrams(5, 'kg') })).toEqual(resolve({ loadGrams: 5_000 }))
    expect(resolve({ loadGrams: toGrams(2.002, 'kg') }).ranges.e_L).toBe(2)
    expect(resolve({ loadGrams: toGrams(0.5, 'kg') }).mpe.absoluteMpeGrams).toBe(0.5)
  })
})

describe('test condition draft — text and units to grams', () => {
  it('converts each field independently and keeps empty fields null', () => {
    const draft = createTestConditionDraft(
      createMassDraft('2', 'kg'),
      createMassDraft('2000', 'g'),
      createMassDraft('', 'g'),
    )

    expect(toTestConditionInput(draft)).toEqual({
      loadGrams: 2_000,
      indicationGrams: 2_000,
      nextIndicationGrams: null,
    })
    expect(hasTestLoad(draft)).toBe(true)
  })

  it('reports an unparsable test load as absent rather than as zero', () => {
    for (const raw of ['', '  ', 'abc', '1,5', '2.0.1']) {
      const draft = createTestConditionDraft(createMassDraft(raw, 'g'))
      expect(toTestConditionInput(draft).loadGrams).toBeNull()
      expect(hasTestLoad(draft)).toBe(false)
    }
  })

  it('resolves a kilogram draft and a gram draft of the same mass identically', () => {
    const inKilograms = createTestConditionDraft(createMassDraft('5', 'kg'), createMassDraft('5', 'kg'), createMassDraft('5.01', 'kg'))
    const inGrams = createTestConditionDraft(createMassDraft('5000', 'g'), createMassDraft('5000', 'g'), createMassDraft('5010', 'g'))

    expect(toTestConditionInput(inKilograms)).toEqual(toTestConditionInput(inGrams))
    expect(resolveTestCondition(EXAMPLE, toTestConditionInput(inKilograms))).toEqual(
      resolveTestCondition(EXAMPLE, toTestConditionInput(inGrams)),
    )
  })

  it('replaces one field without touching the others', () => {
    const draft = createTestConditionDraft(createMassDraft('1', 'kg'), createMassDraft('900', 'g'))
    const next = withTestConditionField(draft, 'nextIndication', massDraftFromGrams(2_001))

    expect(next.load).toEqual(draft.load)
    expect(next.indication).toEqual(draft.indication)
    expect(next.nextIndication.raw).toBe('2001')
    expect(draft.nextIndication.raw).toBe('') // the original draft is untouched
  })
})

describe('describe — the wording shown next to the resolved values', () => {
  it('names the partial weighing range and its bounds', () => {
    expect(rangeLabel(resolve({ loadGrams: 1_000 }).ranges.range_L)).toBe('Range 1 (20 g → 2 kg)')
    expect(rangeLabel(resolve({ loadGrams: 3_000 }).ranges.range_L)).toBe('Range 2 (2 kg → 5 kg)')
    expect(rangeLabel(resolve({ loadGrams: 10_000 }).ranges.range_L)).toBe('Range 3 (5 kg → 15 kg)')
    expect(rangeLabel(resolve({ loadGrams: 19 }).ranges.range_L)).toBe('below the weighing range (19 g)')
    expect(rangeLabel(resolve({ loadGrams: 15_001 }).ranges.range_L)).toBe('above the weighing range (15.001 kg)')
    expect(rangeLabel(resolve().ranges.range_L)).toBe('not resolved (no value)')
  })

  it('always names the applicable interval with its range subscript', () => {
    expect(applicableIntervalLabel(resolve({ loadGrams: 1_000 }).ranges.range_L)).toBe('e₁ = 1 g')
    expect(applicableIntervalLabel(resolve({ loadGrams: 3_000 }).ranges.range_L)).toBe('e₂ = 2 g')
    expect(applicableIntervalLabel(resolve({ loadGrams: 10_000 }).ranges.range_L)).toBe('e₃ = 10 g')
    expect(intervalSymbol(resolve({ loadGrams: 10_000 }).ranges.range_L)).toBe('e₃')

    const unresolved = applicableIntervalLabel(resolve({ loadGrams: 19 }).ranges.range_L)
    expect(unresolved).toContain('no applicable e')
    expect(unresolved).toContain('below the weighing range')
    expect(unresolved).not.toContain('e₁')
  })

  it('shows m, the Table 6 bracket and the mpe of the load range', () => {
    const at4kg = resolve({ loadGrams: 4_000 })

    expect(intervalCountLabel(at4kg.mpe, at4kg.ranges.range_L)).toBe('m = L / e₂ = 2,000')
    expect(bracketLabel(at4kg.mpe)).toBe('500 < m ≤ 2 000 → ± 1.0 e')
    expect(mpeLabel(at4kg.mpe, at4kg.ranges.range_L)).toBe('± 2 g (± 1.0 e₂)')

    const at500g = resolve({ loadGrams: 500 })
    expect(intervalCountLabel(at500g.mpe, at500g.ranges.range_L)).toBe('m = L / e₁ = 500')
    expect(mpeLabel(at500g.mpe, at500g.ranges.range_L)).toBe('± 0.5 g (± 0.5 e₁)')

    const at15kg = resolve({ loadGrams: 15_000 })
    expect(mpeLabel(at15kg.mpe, at15kg.ranges.range_L)).toBe('± 10 g (± 1.0 e₃)')
  })

  it('states why no mpe could be resolved instead of leaving the cell empty', () => {
    expect(mpeLabel(resolve().mpe, resolve().ranges.range_L)).toContain('no test load L entered')
    expect(mpeLabel(resolve({ loadGrams: 19 }).mpe, resolve({ loadGrams: 19 }).ranges.range_L)).toContain(
      'below the weighing range',
    )
    expect(mpeLabel(resolve({ loadGrams: 20_000 }).mpe, resolve({ loadGrams: 20_000 }).ranges.range_L)).toContain(
      'above the weighing range',
    )
  })

  it('flags a load that sits exactly on a range boundary', () => {
    const notes = resolutionNotes(resolve({ loadGrams: 2_000 }))

    expect(notes.some((note) => note.includes('exactly on Max₁'))).toBe(true)
    expect(notes.some((note) => note.includes('2 000 g → ± 1 e₁') || note.includes('range 2'))).toBe(true)
    expect(resolutionNotes(resolve({ loadGrams: 5_000 })).some((note) => note.includes('exactly on Max₂'))).toBe(true)
    expect(resolutionNotes(resolve({ loadGrams: 15_000 })).some((note) => note.includes('end of the weighing range'))).toBe(
      true,
    )
    expect(resolutionNotes(resolve({ loadGrams: 20 })).some((note) => note.includes('exactly on Min'))).toBe(true)
    expect(resolutionNotes(resolve({ loadGrams: 1_000 }))).toEqual([])
  })

  it('explains a load below Min without extending the weighing range', () => {
    const notes = resolutionNotes(resolve({ loadGrams: 19 }))

    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('below Min')
    expect(notes[0]).toContain('T.3.1.2')
    expect(notes[0]).toContain('no e applies')
    expect(notes[0]).toContain('at or near zero, load e = e₁')
  })

  it('explains e* and how it differs from e_L', () => {
    const crossing = resolutionNotes(resolve({ loadGrams: 2_000, nextIndicationGrams: 2_002 }))
    expect(crossing.some((note) => note.includes('e* = e₂ = 2 g while e_L = 1 g'))).toBe(true)
    expect(crossing.some((note) => note.includes('e is to be taken according to the load applied'))).toBe(true)

    const sameRange = resolutionNotes(resolve({ loadGrams: 6_000, nextIndicationGrams: 6_010 }))
    expect(sameRange.some((note) => note.includes('e* = e_L = 10 g'))).toBe(true)
    expect(sameRange.some((note) => note.includes('resolved from I_next on its own'))).toBe(true)

    const missing = resolutionNotes(resolve({ loadGrams: 6_000 }))
    expect(missing.some((note) => note.includes('e*'))).toBe(false)
  })

  it('says in the notes why a rejected next indication withholds e*', () => {
    const notes = resolutionNotes(resolve({ loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_001 }))

    const rejection = notes.filter((note) => note.includes('is rejected as a next indication'))
    expect(rejection).toHaveLength(1)
    expect(rejection[0]).toContain('partial weighing range 2')
    expect(rejection[0]).toContain('e₂ = 2 g')
    expect(rejection[0]).toContain('e* is withheld')
    expect(rejection[0]).toContain('not rounded, corrected or replaced')
    expect(rejection[0]).toContain('(I + e) of A.4.4.3')
    // The old e* explanation must not appear next to a rejection.
    expect(notes.some((note) => note.includes('e* = e₂ = 2 g while e_L = 1 g'))).toBe(false)
  })

  it('confirms the changeover when I_next is exactly one scale interval above I', () => {
    const notes = resolutionNotes(resolve({ loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_002 }))

    const changeover = notes.filter((note) => note.includes('I_next − I = 2 g = e₂'))
    expect(changeover).toHaveLength(1)
    expect(changeover[0]).toContain('increased unambiguously by one scale interval')
    expect(changeover[0]).toContain('A.4.4.3')

    // Not stated when the step is not one scale interval of the range the indication appears in.
    const other = resolutionNotes(resolve({ loadGrams: 2_000, indicationGrams: 2_000, nextIndicationGrams: 2_004 }))
    expect(other.some((note) => note.includes('I_next − I'))).toBe(false)
    expect(other.some((note) => note.includes('is rejected'))).toBe(false)
  })

  it('reports an indication that falls in another partial weighing range than the load', () => {
    const notes = resolutionNotes(resolve({ loadGrams: 1_000, indicationGrams: 3_000 }))

    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('I = 3 kg falls in partial weighing range 2')
    expect(notes[0]).toContain('e₂ = 2 g')
    expect(notes[0]).toContain('e₁ = 1 g')
  })

  it('describes a probe point and what changes across its boundary', () => {
    const probes = boundaryProbes(EXAMPLE)
    const changeover = probes.find((probe) => probe.boundaryGrams === 2_000)
    expect(changeover).toBeDefined()

    const [below, at, above] = changeover!.points
    expect(probePointLabel(below)).toContain('1.999 kg')
    expect(probePointLabel(below)).toContain('range 1')
    expect(probePointLabel(below)).toContain('e₁ = 1 g')
    expect(probePointLabel(below)).toContain('m = 1,999')
    expect(probePointLabel(below)).toContain('mpe ± 1 g')

    expect(probePointLabel(at)).toContain('m = 2,000')
    expect(probePointLabel(above)).toContain('range 2')
    expect(probePointLabel(above)).toContain('e₂ = 2 g')
    expect(probePointLabel(above)).toContain('m = 1,001')
    expect(probePointLabel(above)).toContain('mpe ± 2 g')

    const change = probeChangeLabel(changeover!)
    expect(change).toContain('e changes')
    expect(change).toContain('e₁ = 1 g')
    expect(change).toContain('e₂ = 2 g')

    const minimum = probes.find((probe) => probe.boundaryGrams === 20)!
    expect(probePointLabel(minimum.points[0])).toContain('no mpe')
    expect(probePointLabel(minimum.points[0])).toContain('below the weighing range')
  })
})
