import type { InstrumentConfig } from '../models/instrument'
import type { FieldPath, ValidationIssue, ValidationResult } from './types'
import { checkPhase1Scope, checkRequiredInputs } from './rules/scopeAndInputRules'
import { checkDisplayDivisionMatchesFirstInterval, checkScaleIntervalForms } from './rules/scaleIntervalRules'
import {
  checkMinimumCapacity,
  checkVerificationIntervalBands,
  checkVerificationIntervalCounts,
} from './rules/table3Rules'
import { checkMaximumCapacitiesIncrease, checkVerificationIntervalsIncrease } from './rules/rangeOrderRules'
import { checkPartialRangeCapacityRatios } from './rules/table4Rules'
import {
  checkIntegralIntervalCounts,
  checkMultiplePartialRanges,
  checkWeighingRangeIsNotEmpty,
} from './rules/structuralRules'

/**
 * validateConfiguration(config) — the single entry point of the Phase 1 evaluator.
 *
 * Pure domain logic: no React, no DOM, no I/O. Given an {@link InstrumentConfig} whose masses are
 * already expressed in grams, it returns a structured {@link ValidationResult}:
 *
 * ```text
 * { valid: boolean, errors: ValidationIssue[], warnings: ValidationIssue[], issues: ValidationIssue[] }
 * ```
 *
 * Every issue names the field it belongs to (`field`), carries the numbers it was computed from
 * (`context`) and cites its source (`reference`), so the UI can show the exact reason beside the
 * affected input and a reviewer can trace any message back to OIML R 76-1:2006.
 *
 * The check order below is the reading order of the configuration screen; `sortIssues` then groups
 * the messages by field so that a range's problems appear together.
 */
export function validateConfiguration(config: InstrumentConfig): ValidationResult {
  const collected: ValidationIssue[] = [
    // 0. Is this configuration inside the scope of this build at all?
    ...checkPhase1Scope(config),
    // 1. Is everything entered, and is it a positive mass?
    ...checkRequiredInputs(config),
    // 2. Are d and every e_i of the permitted 1 / 2 / 5 x 10^k form?           (§4.2.2.1, Table 2)
    ...checkScaleIntervalForms(config),
    // 3. Does d match e_1, as Table 2 requires without an auxiliary device?     (Table 2, §3.4.1)
    ...checkDisplayDivisionMatchesFirstInterval(config),
    // 4. Is every e_i inside a Table 3 band of the accuracy class?              (§3.3.2, Table 3)
    ...checkVerificationIntervalBands(config),
    // 5. Is Min at least the Table 3 lower limit, with e replaced by d?         (§3.4.3, Table 3)
    ...checkMinimumCapacity(config),
    // 6. Is n_i = Max_i / e_i within the Table 3 minimum and maximum?           (§3.3.1, §3.3.2)
    ...checkVerificationIntervalCounts(config),
    // 7. Are Max_i and e_i strictly increasing along the partial ranges?        (§3.3.1)
    ...checkMaximumCapacitiesIncrease(config),
    ...checkVerificationIntervalsIncrease(config),
    // 8. Does every non-final partial range satisfy Max_i / e_(i+1) >= 500?     (§3.3.3, Table 4)
    ...checkPartialRangeCapacityRatios(config),
    // 9. Structural consistency (clearly not presented as R-76 requirements).
    ...checkWeighingRangeIsNotEmpty(config),
    ...checkIntegralIntervalCounts(config),
    ...checkMultiplePartialRanges(config),
  ]

  const issues = sortIssues(collected)
  const errors = issues.filter((entry) => entry.severity === 'error')
  const warnings = issues.filter((entry) => entry.severity === 'warning')

  return { valid: errors.length === 0, errors, warnings, issues }
}

/** Field order of the configuration screen; used to present issues in reading order. */
const INSTRUMENT_FIELD_ORDER = [
  'instrumentType',
  'accuracyClass',
  'minCapacityGrams',
  'displayDivisionGrams',
  'ranges',
] as const

function fieldRank(field: FieldPath | null): number {
  if (field === null) return 0
  if (field.kind === 'instrument') {
    const position = INSTRUMENT_FIELD_ORDER.indexOf(field.prop)
    return 1 + (position === -1 ? INSTRUMENT_FIELD_ORDER.length : position)
  }
  return 100 + field.index * 2 + (field.prop === 'maxCapacityGrams' ? 0 : 1)
}

/**
 * Stable sort by field position. `Array.prototype.sort` is stable, so issues of the same field keep
 * the order in which the rule groups above produced them.
 */
export function sortIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((a, b) => fieldRank(a.field) - fieldRank(b.field))
}
