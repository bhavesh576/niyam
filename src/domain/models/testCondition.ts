import type { MassDraft } from './draft'
import { createMassDraft, massDraftToGrams } from './draft'
import type { TestConditionInput } from '../resolution/types'

/**
 * Form-level draft of one test condition (L, I, I_next).
 *
 * Same split as the instrument configuration: the panel edits text plus a display unit, the domain
 * evaluates grams, and the conversion happens in exactly one place
 * ({@link toTestConditionInput}). A test load typed as `2 kg` and one typed as `2000 g` therefore
 * resolve identically, which the unit tests assert.
 */
export interface TestConditionDraft {
  /** L — test load. Required to resolve an mpe. */
  load: MassDraft
  /** I — indication. Optional in this phase. */
  indication: MassDraft
  /** I_next — next indication. Optional in this phase. */
  nextIndication: MassDraft
}

export type TestConditionField = keyof TestConditionDraft

export function createTestConditionDraft(
  load: MassDraft = createMassDraft(),
  indication: MassDraft = createMassDraft(),
  nextIndication: MassDraft = createMassDraft(),
): TestConditionDraft {
  return { load, indication, nextIndication }
}

/** Draft with one field replaced. */
export function withTestConditionField(
  draft: TestConditionDraft,
  field: TestConditionField,
  value: MassDraft,
): TestConditionDraft {
  return { ...draft, [field]: value }
}

/** Draft (text, g/kg) -> domain input (grams). `null` means empty or not a decimal number. */
export function toTestConditionInput(draft: TestConditionDraft): TestConditionInput {
  return {
    loadGrams: massDraftToGrams(draft.load),
    indicationGrams: massDraftToGrams(draft.indication),
    nextIndicationGrams: massDraftToGrams(draft.nextIndication),
  }
}

/** `true` when a test load has been entered and can be parsed. */
export function hasTestLoad(draft: TestConditionDraft): boolean {
  return toTestConditionInput(draft).loadGrams !== null
}
