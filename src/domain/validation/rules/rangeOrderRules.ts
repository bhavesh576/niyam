import type { InstrumentConfig } from '../../models/instrument'
import type { ValidationIssue } from '../types'
import { REFERENCES, RULE_IDS } from '../references'
import { rangeField } from '../fieldPath'
import { intervalSymbol, issue, isUsableMass, maxSymbol, rangeLabel } from '../ruleSupport'
import { formatMass } from '../../../utils/mass'
import { approximatelyGreaterThan } from '../../../utils/numeric'

/**
 * Rule group 5 — ordering of the partial weighing ranges.
 *
 * OIML R 76-1:2006, §3.3.1 defines each partial range by
 *   its verification scale interval, e_i, with **e_(i+1) > e_i**;
 *   its maximum capacity, Max_i; and
 *   its minimum capacity, **Min_i = Max_(i-1)** (Min_1 = Min).
 *
 * Because Min_i = Max_(i-1) and n_i = Max_i / e_i must reach the Table 3 minimum (>= 100 for
 * class III), the maximum capacities are strictly increasing as well. Both orderings are checked
 * against the range order as entered — the evaluator does not silently re-sort the ranges, since
 * a wrongly ordered entry is a configuration error the user must see.
 */

/** Max_i must be strictly greater than Max_(i-1). */
export function checkMaximumCapacitiesIncrease(config: InstrumentConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (let index = 1; index < config.ranges.length; index += 1) {
    const previous = config.ranges[index - 1]
    const current = config.ranges[index]
    if (!isUsableMass(previous.maxCapacityGrams) || !isUsableMass(current.maxCapacityGrams)) continue

    if (approximatelyGreaterThan(current.maxCapacityGrams, previous.maxCapacityGrams)) continue

    const equal = current.maxCapacityGrams === previous.maxCapacityGrams
    issues.push(
      issue({
        ruleId: RULE_IDS.maximumCapacitiesIncrease,
        severity: 'error',
        field: rangeField(index, 'maxCapacityGrams'),
        message: `${rangeLabel(index)}: ${maxSymbol(index)} = ${formatMass(current.maxCapacityGrams)} must be greater than ${maxSymbol(index - 1)} = ${formatMass(previous.maxCapacityGrams)}.`,
        detail: equal
          ? `Equal values leave ${rangeLabel(index)} with zero width: §3.3.1 sets Min${subscriptOf(index)} = ${maxSymbol(index - 1)}, so the range would start where it ends.`
          : `§3.3.1 sets Min${subscriptOf(index)} = ${maxSymbol(index - 1)}: the partial weighing ranges must extend to strictly increasing capacities. Reorder the ranges or correct ${maxSymbol(index)}.`,
        reference: REFERENCES.partialRangeDefinition,
        context: {
          index,
          maxCapacityGrams: current.maxCapacityGrams,
          previousMaxCapacityGrams: previous.maxCapacityGrams,
        },
      }),
    )
  }

  return issues
}

/** e_(i+1) > e_i (§3.3.1, stated explicitly in the Recommendation). */
export function checkVerificationIntervalsIncrease(config: InstrumentConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (let index = 1; index < config.ranges.length; index += 1) {
    const previous = config.ranges[index - 1]
    const current = config.ranges[index]
    if (!isUsableMass(previous.verificationIntervalGrams) || !isUsableMass(current.verificationIntervalGrams)) continue

    if (approximatelyGreaterThan(current.verificationIntervalGrams, previous.verificationIntervalGrams)) continue

    const equal = current.verificationIntervalGrams === previous.verificationIntervalGrams
    issues.push(
      issue({
        ruleId: RULE_IDS.verificationIntervalsIncrease,
        severity: 'error',
        field: rangeField(index, 'verificationIntervalGrams'),
        message: `${rangeLabel(index)}: ${intervalSymbol(index)} = ${formatMass(current.verificationIntervalGrams)} must be greater than ${intervalSymbol(index - 1)} = ${formatMass(previous.verificationIntervalGrams)}.`,
        detail: equal
          ? `§3.3.1 requires e${subscriptOf(index)} > e${subscriptOf(index - 1)} in a multi-interval instrument; equal intervals mean the two partial weighing ranges are not distinct. Either merge them into one range or use a coarser interval here.`
          : `§3.3.1 requires e${subscriptOf(index)} > e${subscriptOf(index - 1)}: a multi-interval instrument divides one weighing range into partial ranges of increasing verification scale interval. Reorder the ranges or correct ${intervalSymbol(index)}.`,
        reference: REFERENCES.partialRangeDefinition,
        context: {
          index,
          verificationIntervalGrams: current.verificationIntervalGrams,
          previousVerificationIntervalGrams: previous.verificationIntervalGrams,
        },
      }),
    )
  }

  return issues
}

function subscriptOf(index: number): string {
  return intervalSymbol(index).slice(1)
}
