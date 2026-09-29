import type { InstrumentConfig } from '../../models/instrument'
import type { Table3Row } from '../../constants/r76Tables'
import {
  describeTable3Band,
  describeTable3Bands,
  describeTable3NLimits,
  findTable3Row,
  table3RowsFor,
} from '../../constants/r76Tables'
import type { ValidationIssue } from '../types'
import { REFERENCES, RULE_IDS } from '../references'
import { instrumentField, rangeField } from '../fieldPath'
import { intervalCountSymbol, intervalSymbol, issue, isUsableMass, maxSymbol, rangeLabel } from '../ruleSupport'
import { formatMass, ratio } from '../../../utils/mass'
import { formatCount } from '../../../utils/text'
import { approximatelyGreaterThan, approximatelyGreaterOrEqual, approximatelyLessThan } from '../../../utils/numeric'

/**
 * Rule group 4 — Table 3 (§3.2) as applied to a multi-interval instrument by §3.3.2:
 *
 *   "e_i and n_i in each partial weighing range, and Min_1 shall comply with the requirements
 *    given in Table 3 according to the accuracy class of the instrument."
 *
 * with, from §3.3.1, `n_i = Max_i / e_i` and `Min_1 = Min`.
 *
 * Class III rows of Table 3 (verified):
 *   0.1 g <= e <= 2 g  ->  100 <= n <= 10 000,  Min >= 20 e
 *   5 g <= e           ->  500 <= n <= 10 000,  Min >= 20 e
 * and per §3.4.3 the `e` of the Min column is replaced by the actual scale interval `d`.
 */

/** The Table 3 band a verification scale interval belongs to, or `null` when none matches. */
export function table3BandFor(config: InstrumentConfig, eGrams: number): Table3Row | null {
  return findTable3Row(config.accuracyClass, eGrams)
}

/** e_i must fall inside one of the verification scale interval bands of Table 3. */
export function checkVerificationIntervalBands(config: InstrumentConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  config.ranges.forEach((range, index) => {
    const e = range.verificationIntervalGrams
    if (!isUsableMass(e)) return
    if (findTable3Row(config.accuracyClass, e) !== null) return

    issues.push(
      issue({
        ruleId: RULE_IDS.table3IntervalBand,
        severity: 'error',
        field: rangeField(index, 'verificationIntervalGrams'),
        message: `${rangeLabel(index)}: ${intervalSymbol(index)} = ${formatMass(e)} does not fall in any verification scale interval band of accuracy class ${config.accuracyClass} (${describeTable3Bands(config.accuracyClass)}).`,
        detail:
          'Table 3 (§3.2) defines the permitted e bands per accuracy class, and §3.3.2 requires eᵢ of every partial weighing range to comply with Table 3. Note that class III has no row covering 2 g < e < 5 g.',
        reference: REFERENCES.table3MultiInterval,
        context: { index, verificationIntervalGrams: e, accuracyClass: config.accuracyClass },
      }),
    )
  })

  return issues
}

/** n_i = Max_i / e_i must lie inside the minimum/maximum number of verification scale intervals. */
export function checkVerificationIntervalCounts(config: InstrumentConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  config.ranges.forEach((range, index) => {
    const max = range.maxCapacityGrams
    const e = range.verificationIntervalGrams
    if (!isUsableMass(max) || !isUsableMass(e)) return

    const row = findTable3Row(config.accuracyClass, e)
    // Without a matching band the band error above already applies; n limits are unknown.
    if (row === null) return

    const n = ratio(max, e)
    if (n === null) return

    const formula = `${intervalCountSymbol(index)} = ${maxSymbol(index)} / ${intervalSymbol(index)} = ${formatMass(max)} / ${formatMass(e)} = ${formatCount(n)}`
    const band = describeTable3Band(row)

    if (approximatelyLessThan(n, row.nMin)) {
      issues.push(
        issue({
          ruleId: RULE_IDS.table3IntervalCountMinimum,
          severity: 'error',
          field: rangeField(index, 'maxCapacityGrams'),
          message: `${rangeLabel(index)}: ${formula} must be at least ${formatCount(row.nMin)} for accuracy class ${config.accuracyClass} with ${band}.`,
          detail: `Table 3 (§3.2) requires ${describeTable3NLimits(row)} for ${band}; §3.3.2 applies those limits to nᵢ = Maxᵢ / eᵢ of every partial weighing range. Either raise ${maxSymbol(index)} or use a finer ${intervalSymbol(index)}.`,
          reference: REFERENCES.table3MultiInterval,
          context: { index, verificationIntervals: n, nMin: row.nMin, maxCapacityGrams: max, verificationIntervalGrams: e },
        }),
      )
      return
    }

    if (row.nMax !== null && approximatelyGreaterThan(n, row.nMax)) {
      issues.push(
        issue({
          ruleId: RULE_IDS.table3IntervalCountMaximum,
          severity: 'error',
          field: rangeField(index, 'maxCapacityGrams'),
          message: `${rangeLabel(index)}: ${formula} must not exceed ${formatCount(row.nMax)} for accuracy class ${config.accuracyClass} with ${band}.`,
          detail: `Table 3 (§3.2) requires ${describeTable3NLimits(row)} for ${band}; §3.3.2 applies those limits to nᵢ = Maxᵢ / eᵢ of every partial weighing range. Either lower ${maxSymbol(index)} or use a coarser ${intervalSymbol(index)}.`,
          reference: REFERENCES.table3MultiInterval,
          context: { index, verificationIntervals: n, nMax: row.nMax, maxCapacityGrams: max, verificationIntervalGrams: e },
        }),
      )
    }
  })

  return issues
}

/**
 * Min (lower limit) from Table 3 with e replaced by d (§3.4.3): class III gives Min >= 20 d.
 */
export function checkMinimumCapacity(config: InstrumentConfig): ValidationIssue[] {
  const min = config.minCapacityGrams
  const d = config.displayDivisionGrams
  if (!isUsableMass(min) || !isUsableMass(d)) return []

  const resolved = resolveMinCapacityFactor(config)
  if (resolved === null) return []

  const required = resolved.factor * d
  if (approximatelyGreaterOrEqual(min, required)) return []

  return [
    issue({
      ruleId: RULE_IDS.minimumCapacity,
      severity: 'error',
      field: instrumentField('minCapacityGrams'),
      message: `Min = ${formatMass(min)} is below the minimum capacity required for accuracy class ${config.accuracyClass}: Min ≥ ${formatCount(resolved.factor)} d = ${formatCount(resolved.factor)} × ${formatMass(d)} = ${formatMass(required)}.`,
      detail: `§3.4.3 requires Min to be determined from Table 3 with the verification scale interval e replaced by the actual scale interval d. Basis: ${resolved.basis}.`,
      reference: REFERENCES.minimumCapacity,
      context: {
        minCapacityGrams: min,
        displayDivisionGrams: d,
        requiredMinCapacityGrams: required,
        factor: resolved.factor,
      },
    }),
  ]
}

/**
 * Resolves the "Min (Lower limit)" multiplier of Table 3 for the configured class.
 *
 * The multiplier normally comes from the Table 3 row selected by e₁. When e₁ is missing or
 * outside every band, the multiplier is still used if all rows of the class state the same value
 * (which is the case for class III: 20 in both rows). If the rows disagreed, the check would be
 * skipped rather than guessed — the ambiguity is then covered by the e-band error.
 */
function resolveMinCapacityFactor(config: InstrumentConfig): { factor: number; basis: string } | null {
  const rows = table3RowsFor(config.accuracyClass)
  if (rows.length === 0) return null

  const e1 = config.ranges[0]?.verificationIntervalGrams ?? null
  if (isUsableMass(e1)) {
    const row = findTable3Row(config.accuracyClass, e1)
    if (row !== null) {
      return { factor: row.minCapacityFactor, basis: `Table 3 row ${describeTable3Band(row)}` }
    }
  }

  const distinct = Array.from(new Set(rows.map((row) => row.minCapacityFactor)))
  if (distinct.length === 1) {
    return {
      factor: distinct[0],
      basis: `Table 3, class ${config.accuracyClass} (all rows of this class state the same Min multiplier)`,
    }
  }

  return null
}
