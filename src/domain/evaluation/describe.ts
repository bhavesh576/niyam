import type { Grams } from '../models/instrument'
import type { MassUnit } from '../../utils/mass'
import { describeTable6Row } from '../constants/r76Tables'
import { formatMass, trimNumber } from '../../utils/mass'
import { approximatelyEqual } from '../../utils/numeric'
import { formatCount, subscript } from '../../utils/text'
import {
  applicableIntervalLabel,
  bracketLabel,
  consistencyLabel,
  intervalCountLabel,
  mpeLabel,
  rangeLabel,
  unresolvedRangeLabel,
} from '../resolution/describe'
import type { EvaluationResult, CalculationLine, TraceStep } from './types'

/**
 * Wording for the Phase 3 evaluation.
 *
 * Pure functions over the evaluation result — no React, no state — the same split Phase 2 uses, so
 * every sentence that quotes R-76 lives in the domain layer where the unit tests can assert it.
 *
 * Masses in the calculation block are printed in **grams**, following the worked example R-76
 * itself prints on p. 89 ("P = (1 000 + 2.5 – 1.5) g = 1 001 g"). Signs are kept: E, E₀ and Ec are
 * signed quantities and only the comparison uses |Ec|.
 */

const MINUS = '−'

/** A signed number without a unit, for use inside a formula: `−0.4`, `+0.5`, `0`. */
export function signedValue(grams: Grams): string {
  if (approximatelyEqual(grams, 0)) return '0'
  return grams < 0 ? `${MINUS}${trimNumber(Math.abs(grams))}` : `+${trimNumber(grams)}`
}

/** A signed mass with its unit: `−0.4 g`, `+0.5 g`, `0 g`. */
export function signedMass(grams: Grams, unit: MassUnit = 'g'): string {
  if (approximatelyEqual(grams, 0)) return formatMass(0, unit)
  return `${signedValue(grams)} ${unit}`
}

/** `PASS`, `FAIL`, or an explicit statement that nothing was evaluated. */
export function verdictLabel(result: EvaluationResult): string {
  if (result.status !== 'evaluated' || result.passed === null) return 'not evaluated'
  return result.passed ? 'PASS' : 'FAIL'
}

/**
 * The comparison as one sentence: `|Ec| = 0.9 g ≤ mpe = 1 g — margin 0.1 g`, or the excess when the
 * limit is exceeded. The inclusive comparison is the one A.4.4.3 prints ("Ec = E – E₀ ≤ mpe") with
 * the ± limits of Table 6.
 */
export function verdictStatement(result: EvaluationResult): string {
  const { absoluteEcGrams, mpeGrams, marginGrams, passed } = result
  if (absoluteEcGrams === null || mpeGrams === null || marginGrams === null || passed === null) {
    return 'no verdict — the observation was not evaluated'
  }

  const relation = passed ? '≤' : '>'
  const difference = passed
    ? `margin ${formatMass(marginGrams, 'g')}${approximatelyEqual(marginGrams, 0) ? ' (exactly at the limit, which is inside it)' : ''}`
    : `excess ${formatMass(Math.abs(marginGrams), 'g')}`

  return `|Ec| = ${formatMass(absoluteEcGrams, 'g')} ${relation} mpe = ${formatMass(mpeGrams, 'g')} — ${difference}`
}

/** e* named with the range it came from, so it can never be read as "the e of the instrument". */
export function eStarStatement(result: EvaluationResult): string {
  const { range_I_next, e_star } = result
  if (e_star !== null && range_I_next.range !== null) {
    const n = range_I_next.range.rangeNumber
    return `e* = e${subscript(n)} = ${formatMass(e_star, 'g')} — the scale interval of partial weighing range ${n}, in which the indication (I + e) appears`
  }
  // The range can resolve while the indication itself is refused — the value falls inside a partial
  // weighing range but is not one of the indications that range can display. e* is then withheld:
  // there is no changeover interval for an indication the instrument cannot show, and e_L is not a
  // substitute for it.
  if (range_I_next.status === 'resolved' && !result.resolution.check_I_next.accepted) {
    return 'e* is not resolved — the next indication is not an indication its partial weighing range can display'
  }
  return `e* — ${unresolvedRangeLabel(range_I_next)}`
}

/**
 * The four calculation lines, in the order A.4.4.3 prints them. Empty when the evaluation was
 * blocked: no intermediate value is shown for an observation that was not evaluated.
 */
export function calculationLines(result: EvaluationResult): CalculationLine[] {
  const { P, E, E0, Ec, observation, halfEStarGrams, absoluteEcGrams, mpeGrams, passed } = result
  if (
    result.status !== 'evaluated' ||
    P === null || E === null || E0 === null || Ec === null ||
    halfEStarGrams === null || absoluteEcGrams === null || mpeGrams === null || passed === null ||
    observation.loadGrams === null || observation.indicationGrams === null ||
    observation.additionalLoadGrams === null
  ) {
    return []
  }

  const comparisonRelation = passed ? '≤' : '>'
  const comparisonResult = passed
    ? `PASS${approximatelyEqual(mpeGrams, absoluteEcGrams) ? ' (exactly at the limit)' : ''}`
    : 'FAIL'

  return [
    {
      formula: 'P = I + ½e* − ΔL',
      substitution:
        `P = (${trimNumber(observation.indicationGrams)} + ${trimNumber(halfEStarGrams)} ${MINUS} ` +
        `${trimNumber(observation.additionalLoadGrams)}) g`,
      result: `= ${trimNumber(P)} g`,
      clause: 'A.4.4.3',
    },
    {
      formula: 'E = P − L',
      substitution: `E = (${trimNumber(P)} ${MINUS} ${trimNumber(observation.loadGrams)}) g`,
      result: `= ${signedMass(E)}`,
      clause: 'A.4.4.3',
    },
    {
      formula: 'Ec = E − E₀',
      substitution: `Ec = (${signedValue(E)} ${MINUS} (${signedValue(E0)})) g`,
      result: `= ${signedMass(Ec)}`,
      clause: 'A.4.4.3',
    },
    {
      formula: '|Ec| ≤ mpe',
      substitution: `|${signedValue(Ec)}| g = ${formatMass(absoluteEcGrams, 'g')} ${comparisonRelation} ${formatMass(mpeGrams, 'g')}`,
      result: comparisonResult,
      clause: 'A.4.4.3 with Table 6',
    },
  ]
}

/**
 * The deterministic calculation trace: ten steps, always in the same order, each with what it
 * produced or why it could not be completed. This is a record of the arithmetic, not an
 * explanation — the same observation always yields the same ten lines.
 */
export function calculationTrace(result: EvaluationResult): TraceStep[] {
  const { observation, status, resolution } = result
  const { ranges, mpe, check_I, check_I_next } = resolution
  const evaluated = status === 'evaluated'

  const issueFor = (field: 'load' | 'indication' | 'additionalLoad' | 'nextIndication' | 'zeroError'): string | null =>
    result.issues.find((issue) => issue.field === field)?.message ?? null

  const blockedValue = (field: Parameters<typeof issueFor>[0], fallback: string): string =>
    issueFor(field) ?? fallback

  const notReached = 'not calculated — the evaluation was blocked before this step'

  return [
    {
      step: 1,
      label: 'Load range resolved',
      value:
        ranges.range_L.status === 'resolved'
          ? `L = ${formatMass(observation.loadGrams as Grams, 'g')} → ${rangeLabel(ranges.range_L)}`
          : blockedValue('load', `L → ${unresolvedRangeLabel(ranges.range_L)}`),
      clause: '§3.3.1, §3.3.3 example',
      completed: ranges.range_L.status === 'resolved',
    },
    {
      step: 2,
      label: 'Load verification interval resolved',
      value:
        ranges.e_L === null
          ? blockedValue('load', `no applicable e — ${unresolvedRangeLabel(ranges.range_L)}`)
          : `e_L = ${applicableIntervalLabel(ranges.range_L)} (from the partial weighing range of L, never a global e)`,
      clause: '§3.3.3',
      completed: ranges.e_L !== null,
    },
    {
      step: 3,
      label: 'MPE resolved',
      value:
        mpe.status === 'resolved'
          ? `${intervalCountLabel(mpe, ranges.range_L)} → ${bracketLabel(mpe)} → mpe = ${mpeLabel(mpe, ranges.range_L)}`
          : blockedValue('load', `no mpe — ${mpe.status}`),
      clause: '§3.5.1, Table 6',
      completed: mpe.status === 'resolved',
    },
    {
      step: 4,
      label: 'Indication range resolved',
      value:
        ranges.range_I.status === 'resolved'
          ? `I = ${formatMass(observation.indicationGrams as Grams, 'g')} → ${rangeLabel(ranges.range_I)}, ${applicableIntervalLabel(ranges.range_I)} — ${consistencyLabel(check_I)}`
          : blockedValue('indication', `I → ${unresolvedRangeLabel(ranges.range_I)}`),
      clause: '§4.2.2.2, T.3.2.2',
      completed: ranges.range_I.status === 'resolved' && check_I.accepted,
    },
    {
      step: 5,
      label: 'Next indication range resolved',
      value:
        ranges.range_I_next.status === 'resolved'
          ? `I_next = ${formatMass(observation.nextIndicationGrams as Grams, 'g')} → ${rangeLabel(ranges.range_I_next)}, ${applicableIntervalLabel(ranges.range_I_next)} — ${consistencyLabel(check_I_next)}`
          : blockedValue('nextIndication', `I_next → ${unresolvedRangeLabel(ranges.range_I_next)}`),
      clause: '§4.2.2.2, T.3.2.2',
      completed: ranges.range_I_next.status === 'resolved' && check_I_next.accepted,
    },
    {
      step: 6,
      label: 'e* resolved',
      value:
        ranges.e_star === null
          ? blockedValue('nextIndication', 'e* is not resolved — no interval applies to I_next')
          : eStarStatement(result),
      clause: 'A.4.4.3 note',
      completed: ranges.e_star !== null,
    },
    {
      step: 7,
      label: 'P calculated',
      value: evaluated && result.P !== null && result.halfEStarGrams !== null
        ? `P = I + ½e* − ΔL = (${trimNumber(observation.indicationGrams as Grams)} + ${trimNumber(result.halfEStarGrams)} ${MINUS} ${trimNumber(observation.additionalLoadGrams as Grams)}) g = ${trimNumber(result.P)} g`
        : blockedValue('additionalLoad', notReached),
      clause: 'A.4.4.3',
      completed: evaluated && result.P !== null,
    },
    {
      step: 8,
      label: 'E calculated',
      value: evaluated && result.E !== null
        ? `E = P − L = (${trimNumber(result.P as Grams)} ${MINUS} ${trimNumber(observation.loadGrams as Grams)}) g = ${signedMass(result.E)}`
        : notReached,
      clause: 'A.4.4.3',
      completed: evaluated && result.E !== null,
    },
    {
      step: 9,
      label: 'E₀ correction applied',
      value: evaluated && result.Ec !== null
        ? `Ec = E − E₀ = (${signedValue(result.E as Grams)} ${MINUS} (${signedValue(observation.zeroErrorGrams as Grams)})) g = ${signedMass(result.Ec)}`
        : blockedValue('zeroError', notReached),
      clause: 'A.4.4.3, A.4.2.3',
      completed: evaluated && result.Ec !== null,
    },
    {
      step: 10,
      label: 'Ec compared with MPE',
      value: evaluated && result.passed !== null
        ? `${verdictStatement(result)} → ${verdictLabel(result)}`
        : notReached,
      clause: 'A.4.4.3, §3.5.1 Table 6',
      completed: evaluated && result.passed !== null,
    },
  ]
}

/**
 * One line summarising what was evaluated, for the result header: the load, the two ranges that
 * differ at a transition, and the two intervals — the visible proof that no single global `e` was
 * used.
 */
export function evaluationSummary(result: EvaluationResult): string {
  const { ranges } = result.resolution
  const parts = [
    `range_L = ${ranges.range_L.range ? `range ${ranges.range_L.range.rangeNumber}` : 'not resolved'}`,
    `range_I = ${ranges.range_I.range ? `range ${ranges.range_I.range.rangeNumber}` : 'not resolved'}`,
    `range_I_next = ${ranges.range_I_next.range ? `range ${ranges.range_I_next.range.rangeNumber}` : 'not resolved'}`,
    `e_L = ${ranges.e_L === null ? 'not resolved' : formatMass(ranges.e_L, 'g')}`,
    `e* = ${ranges.e_star === null ? 'not resolved' : formatMass(ranges.e_star, 'g')}`,
  ]
  return parts.join(' · ')
}

/**
 * How much of the trace was completed: `10 of 10 steps completed`, or `4 of 10` where a blocked
 * input stopped the calculation. The line a disclosure shows beside the title *Calculation Trace*.
 */
export function traceSummary(steps: readonly TraceStep[]): string {
  return `${steps.filter((step) => step.completed).length} of ${steps.length} steps completed`
}

/** The Table 6 bracket and coefficient as one statement, e.g. `500 < m ≤ 2 000 → ± 1.0 e₁`. */
export function mpeBracketStatement(result: EvaluationResult): string {
  const { mpeBracket, mpeCoefficient, m, range_L } = result
  if (mpeBracket === null || mpeCoefficient === null) return 'no Table 6 bracket resolved'

  const symbol = range_L.range ? `e${subscript(range_L.range.rangeNumber)}` : 'e'
  // The Table 6 cell already carries the coefficient (`500 < m ≤ 2 000 → ± 1.0 e`), so the line ends
  // with the absolute limit in grams: `m = 2,000 → 500 < m ≤ 2 000 → ± 1.0 e₁ → mpe = ± 1 g`.
  const bracket = describeTable6Row(mpeBracket).replace(' e', ` ${symbol}`)
  const absolute = result.mpeGrams === null ? '' : ` → mpe = ± ${formatMass(result.mpeGrams, 'g')}`
  return `m = ${m === null ? 'not resolved' : formatCount(m)} → ${bracket}${absolute}`
}
