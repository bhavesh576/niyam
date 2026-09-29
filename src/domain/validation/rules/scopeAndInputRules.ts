import type { InstrumentConfig } from '../../models/instrument'
import { INSTRUMENT_TYPE_LABELS, SUPPORTED_ACCURACY_CLASSES, SUPPORTED_INSTRUMENT_TYPES } from '../../models/instrument'
import type { ValidationIssue } from '../types'
import { REFERENCES, RULE_IDS } from '../references'
import { instrumentField, rangeField } from '../fieldPath'
import { intervalSymbol, issue, isUsableMass, maxSymbol, rangeLabel } from '../ruleSupport'
import { formatMass } from '../../../utils/mass'

/**
 * Rule group 0 — implementation scope.
 *
 * These are NOT requirements of OIML R 76. They exist so that a configuration this phase cannot
 * evaluate is rejected with a precise statement of what is missing, instead of being silently
 * mis-evaluated. Every issue they produce carries `status: 'scope'`.
 */

export function checkPhase1Scope(config: InstrumentConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!SUPPORTED_INSTRUMENT_TYPES.includes(config.instrumentType)) {
    issues.push(
      issue({
        ruleId: RULE_IDS.scopeInstrumentType,
        severity: 'error',
        field: instrumentField('instrumentType'),
        message: `${INSTRUMENT_TYPE_LABELS[config.instrumentType]} configurations are not evaluated in this phase.`,
        detail:
          'This build evaluates multi-interval instruments only: one weighing range divided into partial weighing ranges, each with its own verification scale interval (OIML R 76-1:2006, §3.3). Multiple-range instruments (§3.2 note) are a different model and are planned for a later phase.',
        reference: REFERENCES.scopePhase1,
        context: { instrumentType: config.instrumentType },
      }),
    )
  }

  if (!SUPPORTED_ACCURACY_CLASSES.includes(config.accuracyClass)) {
    issues.push(
      issue({
        ruleId: RULE_IDS.scopeAccuracyClass,
        severity: 'error',
        field: instrumentField('accuracyClass'),
        message: `Accuracy class ${config.accuracyClass} is not evaluated in this phase; only class III (medium accuracy) is implemented.`,
        detail:
          'The Table 3 limits of the other accuracy classes (I, II, IIII) are recorded as reference data in src/domain/constants/r76Tables.ts but the evaluator rejects them until their handling is implemented and tested.',
        reference: REFERENCES.scopePhase1,
        context: { accuracyClass: config.accuracyClass },
      }),
    )
  }

  return issues
}

/**
 * Rule group 1 — required input.
 *
 * A field left empty (or filled with text that is not a decimal number) is `null` in the model.
 * Reporting that separately from "outside the R-76 limits" keeps the messages actionable.
 */
export function checkRequiredInputs(config: InstrumentConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (config.ranges.length === 0) {
    issues.push(
      issue({
        ruleId: RULE_IDS.inputRangesRequired,
        severity: 'error',
        field: instrumentField('ranges'),
        message: 'At least one partial weighing range is required.',
        detail:
          'A multi-interval instrument is defined by its partial weighing ranges (OIML R 76-1:2006, §3.3.1). Add Range 1 with Max₁ and e₁.',
        reference: REFERENCES.structureConfiguration,
        context: { rangeCount: 0 },
      }),
    )
    return issues
  }

  if (config.minCapacityGrams === null) {
    issues.push(
      issue({
        ruleId: RULE_IDS.inputValueRequired,
        severity: 'error',
        field: instrumentField('minCapacityGrams'),
        message: 'Minimum capacity (Min) is required.',
        detail: 'Enter the minimum capacity of the instrument, for example 20 g.',
        reference: REFERENCES.structureConfiguration,
      }),
    )
  } else if (!isUsableMass(config.minCapacityGrams)) {
    issues.push(
      issue({
        ruleId: RULE_IDS.inputValuePositive,
        severity: 'error',
        field: instrumentField('minCapacityGrams'),
        message: `Minimum capacity (Min) must be greater than zero; the entered value is ${formatMass(config.minCapacityGrams)}.`,
        reference: REFERENCES.structureConfiguration,
        context: { minCapacityGrams: config.minCapacityGrams },
      }),
    )
  }

  if (config.displayDivisionGrams === null) {
    issues.push(
      issue({
        ruleId: RULE_IDS.inputValueRequired,
        severity: 'error',
        field: instrumentField('displayDivisionGrams'),
        message: 'Display division (d) is required.',
        detail: 'Enter the actual scale interval d (T.3.2.2), for example 1 g.',
        reference: REFERENCES.structureConfiguration,
      }),
    )
  } else if (!isUsableMass(config.displayDivisionGrams)) {
    issues.push(
      issue({
        ruleId: RULE_IDS.inputValuePositive,
        severity: 'error',
        field: instrumentField('displayDivisionGrams'),
        message: `Display division (d) must be greater than zero; the entered value is ${formatMass(config.displayDivisionGrams)}.`,
        reference: REFERENCES.structureConfiguration,
        context: { displayDivisionGrams: config.displayDivisionGrams },
      }),
    )
  }

  config.ranges.forEach((range, index) => {
    const label = rangeLabel(index)

    if (range.maxCapacityGrams === null) {
      issues.push(
        issue({
          ruleId: RULE_IDS.inputValueRequired,
          severity: 'error',
          field: rangeField(index, 'maxCapacityGrams'),
          message: `${label}: ${maxSymbol(index)} is required.`,
          detail: `Enter the maximum capacity of this partial weighing range, for example ${index === 0 ? '2 kg' : 'a value greater than the previous range'}.`,
          reference: REFERENCES.structureConfiguration,
        }),
      )
    } else if (!isUsableMass(range.maxCapacityGrams)) {
      issues.push(
        issue({
          ruleId: RULE_IDS.inputValuePositive,
          severity: 'error',
          field: rangeField(index, 'maxCapacityGrams'),
          message: `${label}: ${maxSymbol(index)} must be greater than zero; the entered value is ${formatMass(range.maxCapacityGrams)}.`,
          reference: REFERENCES.structureConfiguration,
          context: { index, maxCapacityGrams: range.maxCapacityGrams },
        }),
      )
    }

    if (range.verificationIntervalGrams === null) {
      issues.push(
        issue({
          ruleId: RULE_IDS.inputValueRequired,
          severity: 'error',
          field: rangeField(index, 'verificationIntervalGrams'),
          message: `${label}: ${intervalSymbol(index)} is required.`,
          detail: 'Enter the verification scale interval of this partial weighing range, for example 1 g.',
          reference: REFERENCES.structureConfiguration,
        }),
      )
    } else if (!isUsableMass(range.verificationIntervalGrams)) {
      issues.push(
        issue({
          ruleId: RULE_IDS.inputValuePositive,
          severity: 'error',
          field: rangeField(index, 'verificationIntervalGrams'),
          message: `${label}: ${intervalSymbol(index)} must be greater than zero; the entered value is ${formatMass(range.verificationIntervalGrams)}.`,
          reference: REFERENCES.structureConfiguration,
          context: { index, verificationIntervalGrams: range.verificationIntervalGrams },
        }),
      )
    }
  })

  return issues
}
