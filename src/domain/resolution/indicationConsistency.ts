import type { Grams } from '../models/instrument'
import { MICROGRAMS_PER_GRAM, addGrams, formatMass, toMicrograms } from '../../utils/mass'
import { formatCount, subscript } from '../../utils/text'
import type { RuleReference, ValidationIssue } from '../validation/types'
// `intervalsOf` is reused purely as exact value / e arithmetic (integer micrograms); the mpe
// resolver itself is untouched.
import { intervalsOf } from './mpeResolver'
import { RESOLUTION_REFERENCES } from './references'
import type {
  IndicationCheck,
  RangeResolution,
  RangeResolutionResult,
  ResolvedRange,
  TestConditionResolution,
} from './types'

/**
 * Indication consistency — the check that separates a LOAD from a DISPLAYED VALUE.
 *
 * A multi-interval instrument does not show every number. Its indicating device shows values one
 * actual scale interval apart (T.3.2.2), each partial weighing range has its own scale interval
 * (T.3.2.6), and for this instrument type e = d (Table 2 with §3.4.1). §4.2.2.2 makes that concrete
 * by printing the **"Allowed indications"** of each partial weighing range of a multi-interval
 * instrument with automatic changeover:
 *
 * ```text
 * Max₁ = 150 kg,  e₁ = 50 g   ->  xxx.050 kg      (multiples of 50 g)
 * Max₂ = 300 kg,  e₂ = 100 g  ->  xxx.100 kg      (multiples of 100 g)
 * ```
 *
 * So an indication that falls in partial weighing range i must be an exact multiple of eᵢ. For the
 * class III example of §3.3.3 (Max₁ = 2 kg / e₁ = 1 g, Max₂ = 5 kg / e₂ = 2 g) that means
 * **2 001 g is not a possible indication in partial weighing range 2** — the display there steps in
 * 2 g, so the indications are 2 000 g, 2 002 g, 2 004 g, …
 *
 * What the next indication at a changeover actually is comes from the R-76 procedure, not from a
 * convention invented here. A.4.4.3: *"Additional weights of say 1/10 e are successively added
 * until the indication of the instrument is increased unambiguously by one scale interval (I + e)"*,
 * and its multi-interval note: *"the term ½ e is to be ½ eᵢ or ½ eᵢ₊₁ according to the partial
 * weighing range in which the indication (I + e) appears"*. The next indication is therefore the
 * observed indication one scale interval up, in the scale interval of the range it appears in —
 * for I = 2 000 g that is I + e₂ = 2 002 g.
 *
 * Two rules this module obeys strictly:
 *
 * - The test load L is **not** subject to this check. A load is mass applied to the load receptor,
 *   not a displayed value; 2 001 g is an ordinary test load on this instrument and its mpe is
 *   resolved normally (m = 2 001 g / e₂ = 1 000.5 → ± 1.0 e₂).
 * - A rejected value is **never** rounded, corrected or replaced. It is reported as entered, with
 *   the interval it conflicts with, and `e*` is withheld so that no later phase can consume it.
 */

/** Stable identifier of the indication-consistency rule. */
export const INDICATION_SCALE_INTERVAL_RULE_ID = 'r76.t3.2.2.indication-scale-interval'

/**
 * Checks one indication against the scale interval of the partial weighing range it resolved into.
 *
 * @param resolution     the range resolution of I or I_next.
 * @param changeoverFrom the resolution of I, when checking I_next — used only to quote the
 *                       A.4.4.3 changeover observation (I + e) in the explanation.
 */
export function checkIndication(
  resolution: RangeResolution,
  changeoverFrom: RangeResolution | null = null,
): IndicationCheck {
  const base = {
    quantity: resolution.quantity,
    symbol: resolution.symbol === 'I_next' ? ('I_next' as const) : ('I' as const),
    field: resolution.quantity === 'next-indication' ? ('nextIndication' as const) : ('indication' as const),
    valueGrams: resolution.valueGrams,
    resolvedRangeNumber: resolution.range?.rangeNumber ?? null,
    indicationIntervalGrams: resolution.applicableIntervalGrams,
  }

  // Nothing entered (both indications are optional in this phase): nothing to check.
  if (resolution.status === 'not-a-value') {
    return {
      ...base,
      status: 'not-entered',
      accepted: true,
      intervalsOfIndication: null,
      message: null,
      detail: null,
      ruleId: null,
      reference: RESOLUTION_REFERENCES.indicationScaleInterval,
    }
  }

  // Outside the weighing range: no partial weighing range, hence no scale interval to check
  // against. The range resolution itself reports this; the consistency rule stays out of it.
  if (resolution.status !== 'resolved' || resolution.range === null || resolution.applicableIntervalGrams === null) {
    return {
      ...base,
      status: 'not-resolved',
      accepted: true,
      intervalsOfIndication: null,
      message: null,
      detail: null,
      ruleId: null,
      reference: RESOLUTION_REFERENCES.indicationScaleInterval,
    }
  }

  const value = resolution.valueGrams as Grams
  const interval = resolution.applicableIntervalGrams
  const quotient = intervalsOf(value, interval)

  if (resolution.displayable !== false) {
    return {
      ...base,
      status: 'consistent',
      accepted: true,
      intervalsOfIndication: quotient,
      message: null,
      detail: null,
      ruleId: null,
      reference: RESOLUTION_REFERENCES.indicationScaleInterval,
    }
  }

  const detail = rejectionDetail(resolution, resolution.range, changeoverFrom)
  const changeover = changeoverSentence(resolution, resolution.range, changeoverFrom)

  return {
    ...base,
    status: 'not-displayable',
    accepted: false,
    intervalsOfIndication: quotient,
    ruleId: INDICATION_SCALE_INTERVAL_RULE_ID,
    message: rejectionMessage(resolution, resolution.range, quotient),
    detail,
    // The trace names every clause the explanation actually quotes.
    reference: changeover === null
      ? RESOLUTION_REFERENCES.indicationScaleInterval
      : withChangeoverReference(RESOLUTION_REFERENCES.indicationScaleInterval),
  }
}

/** Adds the A.4.4.3 changeover observation to the trace when the explanation quotes it. */
function withChangeoverReference(reference: RuleReference): RuleReference {
  const changeover = RESOLUTION_REFERENCES.changeoverObservation
  return {
    document: reference.document,
    clauses: [...reference.clauses, ...changeover.clauses],
    quote: `${reference.quote ?? ''} ${changeover.quote ?? ''}`.trim(),
    status: reference.status,
  }
}

/**
 * Checks both indications of a resolved test condition.
 *
 * I is checked on its own; I_next is checked with I as the changeover origin, which is what makes
 * the explanation quote the observed (I + e) of A.4.4.3 instead of an assumed step.
 */
export function checkIndications(
  ranges: RangeResolutionResult,
): Pick<TestConditionResolution, 'check_I' | 'check_I_next' | 'indicationsAccepted' | 'issues'> {
  const check_I = checkIndication(ranges.range_I)
  const check_I_next = checkIndication(ranges.range_I_next, ranges.range_I)
  const issues = [check_I, check_I_next].filter((check) => !check.accepted)

  return { check_I, check_I_next, indicationsAccepted: issues.length === 0, issues }
}

/**
 * The rejection as a {@link ValidationIssue}, so the existing field-message components can render
 * it beside the offending input exactly like a configuration error (same styling, `aria-invalid`,
 * `aria-describedby`). `field` is `null`: test-condition fields are not configuration fields and
 * are addressed by the panel directly.
 */
export function indicationIssue(check: IndicationCheck): ValidationIssue | null {
  if (check.accepted || check.message === null) return null

  return {
    ruleId: check.ruleId ?? INDICATION_SCALE_INTERVAL_RULE_ID,
    severity: 'error',
    field: null,
    message: check.message,
    detail: check.detail ?? undefined,
    reference: check.reference,
    context: {
      quantity: check.quantity,
      valueGrams: check.valueGrams,
      indicationIntervalGrams: check.indicationIntervalGrams,
      resolvedRangeNumber: check.resolvedRangeNumber,
      intervalsOfIndication: check.intervalsOfIndication,
    },
  }
}

/**
 * The two indications nearest to `valueGrams` that the instrument could display in a range whose
 * scale interval is `intervalGrams`. Reported as information only — the entered value is never
 * replaced by one of them.
 */
export function neighbouringIndications(
  valueGrams: Grams,
  intervalGrams: Grams,
): { below: Grams; above: Grams } | null {
  const valueMicro = toMicrograms(valueGrams)
  const intervalMicro = toMicrograms(intervalGrams)
  if (!Number.isSafeInteger(valueMicro) || !Number.isSafeInteger(intervalMicro) || intervalMicro <= 0) return null

  const belowMicro = Math.floor(valueMicro / intervalMicro) * intervalMicro
  const aboveMicro = Math.ceil(valueMicro / intervalMicro) * intervalMicro
  if (!Number.isSafeInteger(belowMicro) || !Number.isSafeInteger(aboveMicro)) return null

  return { below: belowMicro / MICROGRAMS_PER_GRAM, above: aboveMicro / MICROGRAMS_PER_GRAM }
}

// ---------------------------------------------------------------------------------------------

function rejectionMessage(resolution: RangeResolution, range: ResolvedRange, quotient: number | null): string {
  const interval = formatMass(range.verificationIntervalGrams, 'g')
  const value = formatMass(resolution.valueGrams as Grams, 'g')
  const ratioText = quotient === null ? 'undefined' : formatCount(quotient)

  const requirement =
    resolution.quantity === 'next-indication'
      ? `Invalid next indication: the resolved partial weighing range ${range.rangeNumber} uses e${subscript(range.rangeNumber)} = ${interval}, so the next valid indication must follow the instrument's ${interval} scale interval`
      : `Invalid indication: the resolved partial weighing range ${range.rangeNumber} uses e${subscript(range.rangeNumber)} = ${interval}, so a displayed indication must follow the instrument's ${interval} scale interval`

  return `${requirement} — ${value} is not a multiple of ${interval} (${value} / ${interval} = ${ratioText}).`
}

function rejectionDetail(
  resolution: RangeResolution,
  range: ResolvedRange,
  changeoverFrom: RangeResolution | null,
): string {
  const interval = formatMass(range.verificationIntervalGrams, 'g')
  const neighbours = neighbouringIndications(resolution.valueGrams as Grams, range.verificationIntervalGrams)

  const definition =
    'A digital indication shows values one actual scale interval apart (T.3.2.2: d is "the difference between two ' +
    'consecutive indicated values"), the partial weighing ranges of a multi-interval instrument have "each different ' +
    'scale intervals" (T.3.2.6), and without an auxiliary indicating device e = d (Table 2 with §3.4.1). The allowed ' +
    `indications of partial weighing range ${range.rangeNumber} are therefore the multiples of ` +
    `e${subscript(range.rangeNumber)} = ${interval} (§4.2.2.2 lists them per partial weighing range as ` +
    '"Allowed indications").'

  const untouched = neighbours
    ? `The entered value is not rounded, corrected or replaced; the nearest indications this instrument could display in that range are ${formatMass(neighbours.below, 'g')} and ${formatMass(neighbours.above, 'g')}.`
    : 'The entered value is not rounded, corrected or replaced.'

  return [definition, changeoverSentence(resolution, range, changeoverFrom), untouched]
    .filter((part): part is string => part !== null)
    .join(' ')
}

/**
 * Quotes the observed changeover of A.4.4.3 for this pair of indications: the next indication is
 * (I + e), where e is the scale interval of the partial weighing range in which (I + e) appears.
 * Only stated when I actually resolved, and in a different partial weighing range than I_next —
 * otherwise there is no changeover to describe and nothing is assumed.
 */
function changeoverSentence(
  resolution: RangeResolution,
  range: ResolvedRange,
  changeoverFrom: RangeResolution | null,
): string | null {
  if (resolution.quantity !== 'next-indication') return null
  if (changeoverFrom === null || changeoverFrom.status !== 'resolved') return null
  if (changeoverFrom.range === null || changeoverFrom.valueGrams === null) return null
  if (changeoverFrom.range.rangeNumber === range.rangeNumber) return null

  const from = changeoverFrom.range.rangeNumber
  const indication = formatMass(changeoverFrom.valueGrams, 'g')
  const interval = formatMass(range.verificationIntervalGrams, 'g')
  const observed = formatMass(addGrams(changeoverFrom.valueGrams, range.verificationIntervalGrams), 'g')

  return (
    `At a changeover the next indication is the indication "increased unambiguously by one scale interval (I + e)", and the ` +
    `interval that applies is the one of "the partial weighing range in which the indication (I + e) appears" (A.4.4.3 note). ` +
    `With I = ${indication} in partial weighing range ${from} and the next indication appearing in partial weighing range ` +
    `${range.rangeNumber}, the observed next indication is I + e${subscript(range.rangeNumber)} = ${indication} + ${interval} = ${observed}.`
  )
}
