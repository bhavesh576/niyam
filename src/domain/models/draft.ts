import type { MassUnit } from '../../utils/mass'
import { formatValueInUnit, parseMassToGrams } from '../../utils/mass'
import type { AccuracyClass, Grams, InstrumentConfig, InstrumentType, PartialRange } from './instrument'
import { createRangeId } from './instrument'

/**
 * Form-level draft model.
 *
 * The screen edits *text* plus a display unit; the domain evaluates *grams*. Keeping the two
 * models separate means:
 *
 *   - the validator never parses strings (it is pure numeric logic and fully unit-testable);
 *   - an unparsable entry is representable (`null`) instead of being coerced to 0 or NaN;
 *   - kg/g conversion happens exactly once, in {@link toInstrumentConfig}.
 */

/** One mass as typed by the user: raw text plus the unit the text is expressed in. */
export interface MassDraft {
  raw: string
  unit: MassUnit
}

export interface PartialRangeDraft {
  id: string
  /** Max_i */
  maxCapacity: MassDraft
  /** e_i */
  verificationInterval: MassDraft
}

export interface InstrumentDraft {
  instrumentType: InstrumentType
  accuracyClass: AccuracyClass
  /** Min */
  minCapacity: MassDraft
  /** d */
  displayDivision: MassDraft
  ranges: PartialRangeDraft[]
}

export function createMassDraft(raw = '', unit: MassUnit = 'g'): MassDraft {
  return { raw, unit }
}

/** Renders a gram value into a draft, formatted in the given (or automatically chosen) unit. */
export function massDraftFromGrams(grams: Grams, unit: MassUnit = 'g'): MassDraft {
  return { raw: formatValueInUnit(grams, unit), unit }
}

export function createPartialRangeDraft(
  maxCapacity: MassDraft = createMassDraft(),
  verificationInterval: MassDraft = createMassDraft(),
  id: string = createRangeId(),
): PartialRangeDraft {
  return { id, maxCapacity, verificationInterval }
}

/**
 * Converts the draft into the domain configuration. The only place where user text and display
 * units become grams.
 */
export function toInstrumentConfig(draft: InstrumentDraft): InstrumentConfig {
  return {
    instrumentType: draft.instrumentType,
    accuracyClass: draft.accuracyClass,
    minCapacityGrams: massDraftToGrams(draft.minCapacity),
    displayDivisionGrams: massDraftToGrams(draft.displayDivision),
    ranges: draft.ranges.map<PartialRange>((range) => ({
      id: range.id,
      maxCapacityGrams: massDraftToGrams(range.maxCapacity),
      verificationIntervalGrams: massDraftToGrams(range.verificationInterval),
    })),
  }
}

/** Parses one draft field into grams, or `null` when it is empty or not a decimal number. */
export function massDraftToGrams(draft: MassDraft): Grams | null {
  if (draft.raw.trim().length === 0) return null
  return parseMassToGrams(draft.raw, draft.unit)
}

/**
 * Re-expresses a draft in another unit without changing the mass it stands for,
 * e.g. `{ raw: '2', unit: 'kg' }` -> `{ raw: '2000', unit: 'g' }`.
 */
export function convertMassDraftUnit(draft: MassDraft, unit: MassUnit): MassDraft {
  if (draft.unit === unit) return draft
  const grams = massDraftToGrams(draft)
  if (grams === null) return { ...draft, unit }
  return { raw: formatValueInUnit(grams, unit), unit }
}

/** Draft with the same values but fresh range identifiers (for "load example" style actions). */
export function cloneDraft(draft: InstrumentDraft): InstrumentDraft {
  return {
    instrumentType: draft.instrumentType,
    accuracyClass: draft.accuracyClass,
    minCapacity: { ...draft.minCapacity },
    displayDivision: { ...draft.displayDivision },
    ranges: draft.ranges.map((range) => ({
      id: createRangeId(),
      maxCapacity: { ...range.maxCapacity },
      verificationInterval: { ...range.verificationInterval },
    })),
  }
}

/** Type-level guard: the accuracy class of a Phase 1 draft is always one of the supported ones. */
export type Phase1AccuracyClass = Extract<AccuracyClass, 'III'>
