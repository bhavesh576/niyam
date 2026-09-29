import type { InstrumentConfig } from '../../models/instrument'
import { R76_TABLE_4 } from '../../constants/r76Tables'
import type { ValidationIssue } from '../types'
import { REFERENCES, RULE_IDS } from '../references'
import { rangeField } from '../fieldPath'
import { intervalSymbol, issue, isUsableMass, maxSymbol, rangeLabel } from '../ruleSupport'
import { formatMass, ratio } from '../../../utils/mass'
import { formatCount } from '../../../utils/text'
import { approximatelyLessThan } from '../../../utils/numeric'

/**
 * Rule group 6 — Table 4 (§3.3.3), maximum capacity of partial weighing ranges.
 *
 *   "§3.3.3 Maximum capacity of partial weighing ranges: With the exception of the last partial
 *    weighing range, the requirements in Table 4 shall be complied with, according to the accuracy
 *    class of the instrument."
 *
 *   Table 4:  Max_i / e_(i+1)  >=  50 000 (I)  |  5 000 (II)  |  500 (III)  |  50 (IIII)
 *
 * This is the rule that stops a coarser interval being introduced too early: the fine interval
 * must have been used over enough of the capacity before the instrument switches to e_(i+1).
 * The check applies to ranges 1 .. r-1 (the last partial weighing range is exempt).
 */
export function checkPartialRangeCapacityRatios(config: InstrumentConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const limit = R76_TABLE_4[config.accuracyClass]

  for (let index = 0; index < config.ranges.length - 1; index += 1) {
    const current = config.ranges[index]
    const next = config.ranges[index + 1]
    if (!isUsableMass(current.maxCapacityGrams) || !isUsableMass(next.verificationIntervalGrams)) continue

    const value = ratio(current.maxCapacityGrams, next.verificationIntervalGrams)
    if (value === null || !approximatelyLessThan(value, limit)) continue

    issues.push(
      issue({
        ruleId: RULE_IDS.partialRangeCapacityRatio,
        severity: 'error',
        field: rangeField(index, 'maxCapacityGrams'),
        message: `${rangeLabel(index)}: ${maxSymbol(index)} / ${intervalSymbol(index + 1)} = ${formatMass(current.maxCapacityGrams)} / ${formatMass(next.verificationIntervalGrams)} = ${formatCount(value)} must be at least ${formatCount(limit)} for accuracy class ${config.accuracyClass}.`,
        detail: `§3.3.3 with Table 4: every partial weighing range except the last must satisfy Max${sub(index)} / e${sub(index + 1)} ≥ ${formatCount(limit)}. Raise ${maxSymbol(index)} or use a finer ${intervalSymbol(index + 1)} in ${rangeLabel(index + 1)}.`,
        reference: REFERENCES.table4PartialRangeCapacity,
        context: {
          index,
          maxCapacityGrams: current.maxCapacityGrams,
          nextVerificationIntervalGrams: next.verificationIntervalGrams,
          ratio: value,
          limit,
        },
      }),
    )
  }

  return issues
}

function sub(index: number): string {
  return intervalSymbol(index).slice(1)
}
