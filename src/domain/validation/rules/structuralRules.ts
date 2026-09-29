import type { InstrumentConfig } from '../../models/instrument'
import type { ValidationIssue } from '../types'
import { REFERENCES, RULE_IDS } from '../references'
import { instrumentField, rangeField } from '../fieldPath'
import { intervalCountSymbol, intervalSymbol, issue, isUsableMass, maxSymbol, minSymbol, rangeLabel } from '../ruleSupport'
import { formatMass, isExactMultipleOf, ratio } from '../../../utils/mass'
import { formatCount } from '../../../utils/text'
import { approximatelyLessThan } from '../../../utils/numeric'

/**
 * Rule group 7 — structural consistency of the configuration.
 *
 * These checks are NOT R-76 numeric requirements and are labelled `status: 'structural'`
 * everywhere they surface, so nobody mistakes them for a clause of the Recommendation.
 */

/**
 * Min must lie below Max₁, otherwise the weighing range (T.3.1.4: "range between the minimum and
 * maximum capacities") of the first partial weighing range is empty.
 */
export function checkWeighingRangeIsNotEmpty(config: InstrumentConfig): ValidationIssue[] {
  const min = config.minCapacityGrams
  const firstMax = config.ranges[0]?.maxCapacityGrams ?? null
  if (!isUsableMass(min) || !isUsableMass(firstMax)) return []
  if (approximatelyLessThan(min, firstMax)) return []

  return [
    issue({
      ruleId: RULE_IDS.weighingRangeNotEmpty,
      severity: 'error',
      field: instrumentField('minCapacityGrams'),
      message: `Min = ${formatMass(min)} must be below ${maxSymbol(0)} = ${formatMass(firstMax)}; the weighing range Min → Max would otherwise be empty.`,
      detail: `§3.3.1 sets ${minSymbol(0)} = Min and lets the first partial weighing range run up to ${maxSymbol(0)}. T.3.1.4 defines the weighing range as the range between the minimum and the maximum capacities.`,
      reference: REFERENCES.weighingRange,
      context: { minCapacityGrams: min, firstRangeMaxCapacityGrams: firstMax },
    }),
  ]
}

/**
 * Warning when Maxᵢ is not a whole number of verification scale intervals.
 *
 * §3.3.1 defines nᵢ = Maxᵢ / eᵢ, but the Recommendation does not state that this quotient must be
 * an integer. It is therefore reported as a WARNING with `status: 'structural'` and never as an
 * error — inventing a legal requirement here would be worse than flagging it as unusual.
 */
export function checkIntegralIntervalCounts(config: InstrumentConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  config.ranges.forEach((range, index) => {
    const max = range.maxCapacityGrams
    const e = range.verificationIntervalGrams
    if (!isUsableMass(max) || !isUsableMass(e)) return
    if (isExactMultipleOf(max, e)) return

    const n = ratio(max, e)
    issues.push(
      issue({
        ruleId: RULE_IDS.integralIntervalCount,
        severity: 'warning',
        field: rangeField(index, 'maxCapacityGrams'),
        message: `${rangeLabel(index)}: ${maxSymbol(index)} = ${formatMass(max)} is not a whole number of ${intervalSymbol(index)} = ${formatMass(e)}; ${intervalCountSymbol(index)} = ${formatCount(n ?? Number.NaN)}.`,
        detail: `§3.3.1 defines ${intervalCountSymbol(index)} = ${maxSymbol(index)} / ${intervalSymbol(index)} but does not require the quotient to be an integer, so this is reported as a warning only. ${nearestMultiplesHint(max, e, maxSymbol(index), intervalSymbol(index))}`,
        reference: REFERENCES.structureConfiguration,
        context: { index, maxCapacityGrams: max, verificationIntervalGrams: e, verificationIntervals: n },
      }),
    )
  })

  return issues
}

/**
 * Suggests the capacities either side of `max` that are a whole number of `e`,
 * e.g. Max = 5 000.5 g with e = 2 g -> "5 kg and 5.002 kg".
 */
function nearestMultiplesHint(max: number, e: number, maxName: string, intervalName: string): string {
  const n = ratio(max, e)
  if (n === null) return ''

  const candidates = [Math.floor(n) * e, Math.ceil(n) * e].filter((value) => value > 0)
  if (candidates.length === 0) return ''

  const listed = Array.from(new Set(candidates)).map((value) => formatMass(value))
  return `Nearest values of ${maxName} that are a whole number of ${intervalName}: ${listed.join(' and ')}.`
}

/**
 * Warning when a "multi-interval" configuration carries only one partial weighing range.
 *
 * T.3.2.6 defines a multi-interval instrument as one weighing range "divided into partial weighing
 * ranges each with different scale intervals" (plural, different intervals). R-76 nowhere states a
 * minimum number of partial weighing ranges as a numeric limit, so this is reported as a WARNING
 * with `status: 'structural'` and never as an error: a single partial range is still evaluated
 * against Table 3 exactly as §3.3.2 prescribes.
 */
export function checkMultiplePartialRanges(config: InstrumentConfig): ValidationIssue[] {
  if (config.ranges.length !== 1) return []

  return [
    issue({
      ruleId: RULE_IDS.singlePartialRange,
      severity: 'warning',
      field: instrumentField('ranges'),
      message: `The configuration declares a multi-interval instrument but contains a single partial weighing range (Max₁ = ${formatMassOf(config.ranges[0])}, e₁ = ${formatIntervalOf(config.ranges[0])}).`,
      detail:
        'T.3.2.6 describes a multi-interval instrument as one weighing range divided into partial weighing ranges with different scale intervals. With one partial range the instrument behaves as a single-interval instrument: §3.3.3 / Table 4 does not apply and no range transition exists. The values are still evaluated against Table 3 (§3.3.2).',
      reference: REFERENCES.structureConfiguration,
      context: { rangeCount: 1 },
    }),
  ]
}

function formatMassOf(range: { maxCapacityGrams: number | null }): string {
  return isUsableMass(range.maxCapacityGrams) ? formatMass(range.maxCapacityGrams) : 'not entered'
}

function formatIntervalOf(range: { verificationIntervalGrams: number | null }): string {
  return isUsableMass(range.verificationIntervalGrams) ? formatMass(range.verificationIntervalGrams) : 'not entered'
}
