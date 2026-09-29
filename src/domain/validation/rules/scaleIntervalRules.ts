import type { InstrumentConfig } from '../../models/instrument'
import type { ValidationIssue } from '../types'
import { REFERENCES, RULE_IDS } from '../references'
import { instrumentField, rangeField } from '../fieldPath'
import { intervalSymbol, issue, isUsableMass, rangeLabel } from '../ruleSupport'
import { formatMass, isLegalScaleIntervalForm, neighbouringScaleIntervalForms, scaleIntervalMantissa } from '../../../utils/mass'

/**
 * Rule group 2 — permitted form of the scale intervals.
 *
 * OIML R 76-1:2006, §4.2.2.1:
 *   "The scale interval for weighing results shall be in the form 1 x 10^k, 2 x 10^k or 5 x 10^k
 *    units in which the result is expressed, the index, k, being a positive or negative whole
 *    number or equal to zero."
 *
 * For a multi-interval instrument the same form applies to every e_i, because Table 2 (§3.1.2)
 * gives e = d for an instrument without an auxiliary indicating device and §3.4.1 forbids an
 * auxiliary indicating device on a multi-interval instrument. That chain is recorded as
 * `status: 'derived'` and quoted in REFERENCES.verificationIntervalForm.
 */

export function checkScaleIntervalForms(config: InstrumentConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const d = config.displayDivisionGrams
  if (isUsableMass(d) && !isLegalScaleIntervalForm(d)) {
    issues.push(
      issue({
        ruleId: RULE_IDS.formDisplayDivision,
        severity: 'error',
        field: instrumentField('displayDivisionGrams'),
        message: `d = ${formatMass(d)} is not a permitted scale interval: it must be of the form 1 × 10ᵏ, 2 × 10ᵏ or 5 × 10ᵏ.`,
        detail: formHint(d),
        reference: REFERENCES.scaleIntervalForm,
        context: { displayDivisionGrams: d, mantissa: scaleIntervalMantissa(d) },
      }),
    )
  }

  config.ranges.forEach((range, index) => {
    const e = range.verificationIntervalGrams
    if (!isUsableMass(e) || isLegalScaleIntervalForm(e)) return

    issues.push(
      issue({
        ruleId: RULE_IDS.formVerificationInterval,
        severity: 'error',
        field: rangeField(index, 'verificationIntervalGrams'),
        message: `${rangeLabel(index)}: ${intervalSymbol(index)} = ${formatMass(e)} is not a permitted scale interval: it must be of the form 1 × 10ᵏ, 2 × 10ᵏ or 5 × 10ᵏ.`,
        detail: formHint(e),
        reference: REFERENCES.verificationIntervalForm,
        context: { index, verificationIntervalGrams: e, mantissa: scaleIntervalMantissa(e) },
      }),
    )
  })

  return issues
}

/**
 * Rule group 3 — relationship between d and e₁.
 *
 * Table 2 (§3.1.2): "Graduated, without auxiliary indicating device — e = d".
 * §3.4.1: "A multi-interval instrument shall not be fitted with an auxiliary indicating device."
 * Therefore, for the configuration modelled here, the display division equals the verification
 * scale interval of the first (finest) partial weighing range: d = e₁.
 *
 * NOTE (§3.4.2, d < e ≤ 10 d, e = 10^k kg) applies only when an auxiliary indicating device is
 * present, which §3.4.1 excludes for multi-interval instruments. See src/domain/pendingRules.ts.
 */
export function checkDisplayDivisionMatchesFirstInterval(config: InstrumentConfig): ValidationIssue[] {
  const d = config.displayDivisionGrams
  const e1 = config.ranges[0]?.verificationIntervalGrams ?? null

  if (!isUsableMass(d) || !isUsableMass(e1)) return []
  if (d === e1) return []

  return [
    issue({
      ruleId: RULE_IDS.table2DisplayDivisionEqualsFirstInterval,
      severity: 'error',
      field: instrumentField('displayDivisionGrams'),
      message: `d = ${formatMass(d)} must equal ${intervalSymbol(0)} = ${formatMass(e1)} for this instrument type.`,
      detail:
        'Table 2 (§3.1.2) states e = d for an instrument without an auxiliary indicating device, and §3.4.1 states that a multi-interval instrument shall not be fitted with an auxiliary indicating device. The display division therefore equals the verification scale interval of the first partial weighing range; coarser partial ranges display at their own interval (dᵢ = eᵢ).',
      reference: REFERENCES.table2DisplayDivision,
      context: { displayDivisionGrams: d, firstIntervalGrams: e1 },
    }),
  ]
}

function formHint(value: number): string {
  const { below, above } = neighbouringScaleIntervalForms(value)
  const options = [below, above].filter((option): option is number => option !== null).map((option) => formatMass(option))
  if (options.length === 0) {
    return 'Permitted mantissas are 1, 2 and 5 only (OIML R 76-1:2006, §4.2.2.1).'
  }
  return `Nearest permitted values: ${options.join(' or ')} (OIML R 76-1:2006, §4.2.2.1).`
}
