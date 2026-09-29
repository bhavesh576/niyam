import type { MassDraft } from './draft'
import { createMassDraft, massDraftToGrams } from './draft'
import type { TestConditionInput } from '../resolution/types'
import type { TestObservationInput } from '../evaluation/types'

/**
 * Form-level draft of one digital weighing observation (L, I, ΔL, I_next, E₀).
 *
 * Same split as the instrument configuration and the Phase 2 test condition: the screen edits
 * *text* plus a display unit, the evaluation engine works in *grams*, and the conversion happens in
 * exactly one place ({@link toTestObservationInput}). Nothing downstream ever sees kg mixed with g.
 *
 * Two of the five quantities are signed and that is deliberate:
 *
 * - **ΔL** is the additional load placed on the load receptor (A.4.4.3) — physically non-negative,
 *   and a negative entry is rejected by the observation validation rather than silently negated.
 * - **E₀** is the error at zero (or at a load close to zero), which R-76 writes as a signed value
 *   ("If the changeover point at zero as calculated above was E₀ = + 0.5 g"). It is subtracted from
 *   E, so its sign must survive parsing — `parseMassToGrams` accepts a leading `+` or `-`.
 */
export interface TestObservationDraft {
  /** L — test load applied to the load receptor. */
  load: MassDraft
  /** I — indication noted at that load, before any additional weight is applied. */
  indication: MassDraft
  /** ΔL — additional load at which the indication changed over to I_next. */
  additionalLoad: MassDraft
  /** I_next — the indication increased unambiguously by one scale interval, (I + e). */
  nextIndication: MassDraft
  /** E₀ — zero error, determined separately (A.4.2.3 with A.4.4.3) and entered by the tester. */
  zeroError: MassDraft
}

export type TestObservationField = keyof TestObservationDraft

/** Field order used for on-screen order and for the order of reported issues. */
export const TEST_OBSERVATION_FIELDS: readonly TestObservationField[] = [
  'load',
  'indication',
  'additionalLoad',
  'nextIndication',
  'zeroError',
]

export function createTestObservationDraft(
  load: MassDraft = createMassDraft(),
  indication: MassDraft = createMassDraft(),
  additionalLoad: MassDraft = createMassDraft(),
  nextIndication: MassDraft = createMassDraft(),
  zeroError: MassDraft = createMassDraft(),
): TestObservationDraft {
  return { load, indication, additionalLoad, nextIndication, zeroError }
}

/** Draft with one field replaced. Never mutates the draft it is given. */
export function withObservationField(
  draft: TestObservationDraft,
  field: TestObservationField,
  value: MassDraft,
): TestObservationDraft {
  return { ...draft, [field]: value }
}

/**
 * Draft (text, g/kg) → evaluation input (grams). `null` means the field is empty or the text is not
 * a decimal number — the same convention the Phase 2 test condition uses, so "nothing usable was
 * entered" is reported instead of being coerced to 0.
 */
export function toTestObservationInput(draft: TestObservationDraft): TestObservationInput {
  return {
    loadGrams: massDraftToGrams(draft.load),
    indicationGrams: massDraftToGrams(draft.indication),
    additionalLoadGrams: massDraftToGrams(draft.additionalLoad),
    nextIndicationGrams: massDraftToGrams(draft.nextIndication),
    zeroErrorGrams: massDraftToGrams(draft.zeroError),
  }
}

/** The three quantities Phase 2 resolves ranges for, taken from the same observation. */
export function toTestConditionInputOf(observation: TestObservationInput): TestConditionInput {
  return {
    loadGrams: observation.loadGrams,
    indicationGrams: observation.indicationGrams,
    nextIndicationGrams: observation.nextIndicationGrams,
  }
}

/** The five draft fields as an array, in screen order — for iterating labels and messages. */
export function observationFieldEntries(
  draft: TestObservationDraft,
): ReadonlyArray<[TestObservationField, MassDraft]> {
  return TEST_OBSERVATION_FIELDS.map((field) => [field, draft[field]] as [TestObservationField, MassDraft])
}
