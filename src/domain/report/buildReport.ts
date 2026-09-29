import type { Grams } from '../models/instrument'
import type { NormalizedInstrument } from '../models/normalizedInstrument'
import type { EvaluationResult, PerformedEvaluation } from '../evaluation/types'
import type { RangeResolution } from '../resolution/types'
import type {
  ReportInstrument,
  ReportInstrumentRange,
  ReportOutcome,
  ReportReadinessCheck,
  ReportReference,
  ReportResult,
  ReportTestInformation,
  ReportTestPoint,
  ReportedInterval,
  ReportedMass,
  ReportedRange,
  ReportInput,
  WeighingReport,
} from './types'
import type { ReportVerdict } from './types'
import {
  REPORT_DOCUMENT_KIND,
  REPORT_EVALUATION_TYPE,
  REPORT_IDENTIFICATION_NOTE,
  REPORT_INDICATION_MODE,
  REPORT_NOT_READY_HEADLINE,
  REPORT_NOT_READY_INCOMPLETE,
  REPORT_NOT_READY_NO_EVALUATION,
  REPORT_NOT_READY_STALE_EVALUATION,
  REPORT_SCOPE_LIMITS,
  REPORT_SINGLE_RESULT_BASIS,
  REPORT_STATUS_NOTICE,
  REPORT_TEST_CONDITION,
  REPORT_TEST_TYPE,
  REPORT_TITLE,
  REPORT_ZERO_ERROR_PROVENANCE,
  SINGLE_RESULT_REFERENCE,
} from './content'
import { describeMpeCoefficient } from '../constants/r76Tables'
import { formatMass, trimNumber } from '../../utils/mass'
import { formatCount, subscript } from '../../utils/text'
import { formatRuleReference, ruleStatusLabel } from '../../utils/reference'
import {
  applicableIntervalLabel,
  changeoverConfirmation,
  consistencyLabel,
  intervalCountLabel,
  intervalSymbol,
  mpeStatusLabel,
  rangeLabel,
  resolutionNotes,
} from '../resolution/describe'
import {
  calculationLines,
  calculationTrace,
  evaluationSummary,
  mpeBracketStatement,
  signedMass,
  signedValue,
  verdictLabel,
  verdictStatement,
} from '../evaluation/describe'
import type { RuleReference } from '../validation/types'

/**
 * Phase 4: the report model, built from the Phase 3 evaluation result.
 *
 * This module contains **no calculation**. It does not resolve a partial weighing range, look up a
 * Table 6 bracket, halve an interval or subtract one mass from another — it reads the values
 * `evaluateDigitalWeighingObservation` already produced and pairs each of them with the text the
 * report prints. Every `ReportedMass.grams` is the result object's own number, so a test can compare
 * the report with the result by identity and prove nothing was recomputed.
 *
 * It also owns the readiness gate of the specification: a report is generated only when the input
 * data, the configuration, the calculation, the range resolution, the mpe and the result are all
 * available. Otherwise the outcome is `not-ready` with the reasons — never a partially populated
 * document that looks complete.
 */

// ---------------------------------------------------------------------------------------------
// Presentation helpers — formatting only, each one taking a value that already exists
// ---------------------------------------------------------------------------------------------

/** A mass from the result, printed in grams. Signed where R-76 signs the quantity (E₀, E, Ec). */
function reportedMass(grams: Grams, signed = false): ReportedMass {
  return {
    grams,
    text: signed ? signedMass(grams, 'g') : formatMass(grams, 'g'),
    tableText: signed ? signedValue(grams) : trimNumber(grams),
  }
}

/** A resolved partial weighing range, as the report prints it. */
function reportedRange(resolution: RangeResolution): ReportedRange {
  const rangeNumber = resolution.range?.rangeNumber ?? 0
  return { rangeNumber, text: rangeLabel(resolution), tableText: `${rangeNumber}` }
}

/** A resolved verification scale interval (`e_L` or `e*`), named with the range it came from. */
function reportedInterval(resolution: RangeResolution, grams: Grams, name: string): ReportedInterval {
  const symbol = intervalSymbol(resolution) ?? 'e'
  return {
    grams,
    symbol,
    text: `${name} = ${symbol} = ${formatMass(grams, 'g')}`,
    tableText: trimNumber(grams),
  }
}

/** The Table 6 coefficient with the interval symbol of the load's range, e.g. `± 1.0 e₁`. */
function coefficientText(coefficient: number, loadRange: RangeResolution): string {
  const symbol = loadRange.range ? `e${subscript(loadRange.range.rangeNumber)}` : 'e'
  return describeMpeCoefficient(coefficient).replace(' e', ` ${symbol}`)
}

function toReportReference(reference: RuleReference): ReportReference {
  return {
    citation: formatRuleReference(reference),
    quote: reference.quote ?? null,
    statusText: ruleStatusLabel(reference),
  }
}

/** `2026-09-29 19:41`, local — the caller passes the timestamp so this function stays pure. */
function formatTimestamp(at: Date): string {
  const pad = (value: number) => `${value}`.padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

// ---------------------------------------------------------------------------------------------
// Readiness (§8)
// ---------------------------------------------------------------------------------------------

function checkInputData(evaluation: PerformedEvaluation | null): ReportReadinessCheck {
  const label = 'Input data'
  if (evaluation === null) {
    return { id: 'input-data', label, ok: false, detail: 'Not available — no observation has been evaluated.' }
  }

  const { loadGrams, indicationGrams, additionalLoadGrams, nextIndicationGrams, zeroErrorGrams } =
    evaluation.result.observation

  if (
    loadGrams !== null &&
    indicationGrams !== null &&
    additionalLoadGrams !== null &&
    nextIndicationGrams !== null &&
    zeroErrorGrams !== null
  ) {
    return {
      id: 'input-data',
      label,
      ok: true,
      detail:
        `Complete — L = ${formatMass(loadGrams, 'g')}, I = ${formatMass(indicationGrams, 'g')}, ` +
        `ΔL = ${formatMass(additionalLoadGrams, 'g')}, I_next = ${formatMass(nextIndicationGrams, 'g')}, ` +
        `E₀ = ${signedMass(zeroErrorGrams, 'g')}.`,
    }
  }

  const missing: string[] = []
  if (loadGrams === null) missing.push('L')
  if (indicationGrams === null) missing.push('I')
  if (additionalLoadGrams === null) missing.push('ΔL')
  if (nextIndicationGrams === null) missing.push('I_next')
  if (zeroErrorGrams === null) missing.push('E₀')

  return {
    id: 'input-data',
    label,
    ok: false,
    detail: `Incomplete — ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing.`,
  }
}

function checkConfiguration(
  instrument: NormalizedInstrument | null,
  evaluation: PerformedEvaluation | null,
): ReportReadinessCheck {
  const label = 'Configuration'
  if (instrument === null) {
    return {
      id: 'configuration',
      label,
      ok: false,
      detail: 'Not valid — no validated instrument configuration, so there is no range model to report against.',
    }
  }
  if (evaluation !== null && evaluation.instrument !== instrument) {
    return {
      id: 'configuration',
      label,
      ok: false,
      detail: 'Valid, but the evaluation was performed against a different instrument configuration.',
    }
  }
  return {
    id: 'configuration',
    label,
    ok: true,
    detail:
      `Valid — class ${instrument.accuracyClass}, ${instrument.instrumentType}, ${formatCount(instrument.rangeCount)} partial weighing ` +
      `range${instrument.rangeCount === 1 ? '' : 's'}, Min = ${formatMass(instrument.minCapacityGrams)} → ` +
      `Max = ${formatMass(instrument.maxCapacityGrams)}.`,
  }
}

function checkCalculation(evaluation: PerformedEvaluation | null): ReportReadinessCheck {
  const label = 'Calculation'
  if (evaluation === null) {
    return { id: 'calculation', label, ok: false, detail: 'Not available — no evaluation was performed.' }
  }

  const result = evaluation.result
  if (result.status !== 'evaluated' || result.P === null || result.E === null || result.Ec === null) {
    const first = result.issues[0]?.message ?? 'no calculation was produced'
    const more = result.issues.length > 1 ? ` (${formatCount(result.issues.length)} problems in total)` : ''
    return { id: 'calculation', label, ok: false, detail: `Not available — the evaluation was blocked: ${first}${more}` }
  }

  return {
    id: 'calculation',
    label,
    ok: true,
    detail:
      `Available — P = ${formatMass(result.P, 'g')}, E = ${signedMass(result.E, 'g')}, ` +
      `Ec = ${signedMass(result.Ec, 'g')}.`,
  }
}

function checkRangeResolution(evaluation: PerformedEvaluation | null): ReportReadinessCheck {
  const label = 'Range resolution'
  if (evaluation === null) {
    return { id: 'range-resolution', label, ok: false, detail: 'Not available — no evaluation was performed.' }
  }

  const result = evaluation.result
  const missing: string[] = []
  if (result.range_L.range === null || result.e_L === null) missing.push('range_L / e_L')
  if (result.range_I.range === null) missing.push('range_I')
  if (result.range_I_next.range === null || result.e_star === null) missing.push('range_I_next / e*')

  if (missing.length > 0) {
    const reason = result.resolution.check_I_next.message ?? result.resolution.check_I.message
    return {
      id: 'range-resolution',
      label,
      ok: false,
      detail: `Not available — ${missing.join(', ')} ${missing.length === 1 ? 'was' : 'were'} not resolved${reason ? `: ${reason}` : ''}`,
    }
  }

  return { id: 'range-resolution', label, ok: true, detail: `Available — ${evaluationSummary(result)}.` }
}

function checkMpe(evaluation: PerformedEvaluation | null): ReportReadinessCheck {
  const label = 'MPE'
  if (evaluation === null) {
    return { id: 'mpe', label, ok: false, detail: 'Not available — no evaluation was performed.' }
  }

  const result = evaluation.result
  const { mpe } = result.resolution
  if (mpe.status !== 'resolved' || result.mpeGrams === null || result.m === null || result.mpeBracket === null) {
    return {
      id: 'mpe',
      label,
      ok: false,
      detail: 'Not available — no maximum permissible error was resolved for this load.',
    }
  }

  return {
    id: 'mpe',
    label,
    ok: true,
    detail: `Available — ${mpeBracketStatement(result)} (initial verification, class ${mpe.accuracyClass}).`,
  }
}

function checkResult(evaluation: PerformedEvaluation | null): ReportReadinessCheck {
  const label = 'Result'
  if (evaluation === null) {
    return { id: 'result', label, ok: false, detail: 'Not available — no evaluation was performed.' }
  }
  if (evaluation.result.passed === null) {
    return { id: 'result', label, ok: false, detail: 'Not available — the evaluation produced no verdict.' }
  }
  return {
    id: 'result',
    label,
    ok: true,
    detail: `Available — ${verdictLabel(evaluation.result)}: ${verdictStatement(evaluation.result)}.`,
  }
}

/** `Class III — multi-interval`. */
function classAndTypeText(instrument: NormalizedInstrument): string {
  return `Class ${instrument.accuracyClass} — ${instrument.instrumentType}`
}

// ---------------------------------------------------------------------------------------------
// The report itself
// ---------------------------------------------------------------------------------------------

/** Section A — instrument identification, read from the normalized range model. */
function instrumentSection(instrument: NormalizedInstrument): ReportInstrument {
  const maxima = instrument.ranges.map((range) => formatMass(range.upperBoundGrams)).join(' / ')
  const intervals = instrument.ranges.map((range) => formatMass(range.verificationIntervalGrams)).join(' / ')
  const last = instrument.rangeCount

  const ranges: ReportInstrumentRange[] = instrument.ranges.map((range) => ({
    rangeNumber: range.rangeNumber,
    lowerBoundText: `Min${subscript(range.rangeNumber)} = ${formatMass(range.lowerBoundGrams)}`,
    upperBoundText: `Max${subscript(range.rangeNumber)} = ${formatMass(range.upperBoundGrams)}`,
    intervalText: `e${subscript(range.rangeNumber)} = ${formatMass(range.verificationIntervalGrams)}`,
    intervalsText: `n${subscript(range.rangeNumber)} = ${formatCount(range.verificationIntervals)}`,
  }))

  return {
    identifier: `Max = ${maxima} · e = ${intervals} · Min = ${formatMass(instrument.minCapacityGrams)} · d = ${formatMass(instrument.displayDivisionGrams)}`,
    identificationNote: REPORT_IDENTIFICATION_NOTE,
    accuracyClass: instrument.accuracyClass,
    accuracyClassText: `Class ${instrument.accuracyClass}`,
    instrumentType: instrument.instrumentType,
    classAndTypeText: classAndTypeText(instrument),
    capacitiesText: `Min = ${formatMass(instrument.minCapacityGrams)} → Max = Max${subscript(last)} = ${formatMass(instrument.maxCapacityGrams)}`,
    displayDivisionText: `d = e₁ = ${formatMass(instrument.displayDivisionGrams)} (Table 2: e = d, no auxiliary indicating device)`,
    partialRangeCount: instrument.rangeCount,
    ranges,
  }
}

/**
 * Maps one evaluation onto one test point.
 *
 * Returns `null` when any value the report needs is missing — the caller treats that as "not ready"
 * rather than printing a hole. The guards below repeat the readiness conditions on purpose: this
 * function must be safe to call on its own, and TypeScript must see the values as non-null without
 * a single cast that could hide a mistake.
 */
function testPointSection(evaluation: PerformedEvaluation, index: number): ReportTestPoint | null {
  const result: EvaluationResult = evaluation.result
  const { observation, resolution } = result
  const { mpe } = resolution

  if (result.status !== 'evaluated' || result.passed === null) return null
  if (
    observation.loadGrams === null ||
    observation.indicationGrams === null ||
    observation.additionalLoadGrams === null ||
    observation.nextIndicationGrams === null ||
    observation.zeroErrorGrams === null
  ) {
    return null
  }
  if (
    result.P === null ||
    result.E === null ||
    result.Ec === null ||
    result.absoluteEcGrams === null ||
    result.marginGrams === null ||
    result.halfEStarGrams === null
  ) {
    return null
  }
  if (
    result.e_L === null ||
    result.e_star === null ||
    result.m === null ||
    result.mpeGrams === null ||
    result.mpeCoefficient === null ||
    result.mpeBracket === null
  ) {
    return null
  }
  if (result.range_L.range === null || result.range_I.range === null || result.range_I_next.range === null) return null
  if (mpe.status !== 'resolved') return null

  const load = observation.loadGrams
  const indication = observation.indicationGrams
  const additionalLoad = observation.additionalLoadGrams
  const nextIndication = observation.nextIndicationGrams
  const zeroError = observation.zeroErrorGrams
  const loadInterval = result.e_L
  const changeoverInterval = result.e_star
  const verdict: ReportVerdict = result.passed ? 'PASS' : 'FAIL'

  const loadIntervalText = reportedInterval(result.range_L, loadInterval, 'e_L')
  const changeoverIntervalText = reportedInterval(result.range_I_next, changeoverInterval, 'e*')
  const mpeText = mpeStatusLabel(mpe, result.range_L)

  return {
    label: `Test point ${index + 1}`,
    observation: {
      load: reportedMass(load),
      indication: reportedMass(indication),
      additionalLoad: reportedMass(additionalLoad),
      nextIndication: reportedMass(nextIndication),
      zeroError: reportedMass(zeroError, true),
    },
    context: {
      loadRange: reportedRange(result.range_L),
      indicationRange: reportedRange(result.range_I),
      nextIndicationRange: reportedRange(result.range_I_next),
      loadInterval: loadIntervalText,
      changeoverInterval: changeoverIntervalText,
      indicationConsistency: consistencyLabel(resolution.check_I),
      nextIndicationConsistency: consistencyLabel(resolution.check_I_next),
      // §7 — the range-aware chain, load side: nothing here is computed, each part is a label the
      // resolvers already produced.
      limitChain:
        `L = ${formatMass(load, 'g')} → ${rangeLabel(result.range_L)} → ${loadIntervalText.text} → ` +
        `${intervalCountLabel(mpe, result.range_L)} → ${result.mpeBracket.mCellText} → mpe = ${mpeText}`,
      // …and indication side, where e* comes from.
      changeoverChain:
        `I = ${formatMass(indication, 'g')} → ${rangeLabel(result.range_I)} (${applicableIntervalLabel(result.range_I)}); ` +
        `I_next = ${formatMass(nextIndication, 'g')} → ${rangeLabel(result.range_I_next)} → ${changeoverIntervalText.text}`,
      notes: resolutionNotes(resolution),
    },
    calculation: {
      halfChangeoverInterval: reportedMass(result.halfEStarGrams),
      p: reportedMass(result.P),
      e: reportedMass(result.E, true),
      ec: reportedMass(result.Ec, true),
      lines: calculationLines(result),
      trace: calculationTrace(result),
    },
    compliance: {
      intervalCount: result.m,
      intervalCountText: intervalCountLabel(mpe, result.range_L),
      bracketText: result.mpeBracket.mCellText,
      coefficientText: coefficientText(result.mpeCoefficient, result.range_L),
      mpe: { grams: result.mpeGrams, text: mpeText, tableText: `± ${trimNumber(result.mpeGrams)}` },
      mpeStatement: mpeBracketStatement(result),
      absoluteCorrectedError: reportedMass(result.absoluteEcGrams),
      margin: reportedMass(result.marginGrams, true),
      comparisonText: verdictStatement(result),
      verdict,
    },
  }
}

/**
 * Builds the report, or explains why it cannot be built.
 *
 * The single entry point of the report layer: the screen calls it with the instrument under test and
 * the evaluation on screen, and renders either the document or the reasons.
 */
export function buildWeighingReport(input: ReportInput): ReportOutcome {
  const { instrument, evaluation, generatedAt } = input
  const checks: readonly ReportReadinessCheck[] = [
    checkInputData(evaluation),
    checkConfiguration(instrument, evaluation),
    checkCalculation(evaluation),
    checkRangeResolution(evaluation),
    checkMpe(evaluation),
    checkResult(evaluation),
  ]
  const failed = checks.filter((check) => !check.ok)

  if (instrument === null || evaluation === null || failed.length > 0) {
    return {
      status: 'not-ready',
      checks,
      headline: REPORT_NOT_READY_HEADLINE,
      summary: notReadySummary(instrument, evaluation),
      reasons: failed.map((check) => `${check.label} — ${check.detail}`),
    }
  }

  const point = testPointSection(evaluation, 0)
  if (point === null) {
    // Unreachable while the checks above pass; kept so that no code path can emit a half-filled
    // report if the two ever disagree.
    return {
      status: 'not-ready',
      checks,
      headline: REPORT_NOT_READY_HEADLINE,
      summary: REPORT_NOT_READY_INCOMPLETE,
      reasons: ['Calculation — the evaluation result does not contain every value a report prints.'],
    }
  }

  const testPoints: readonly ReportTestPoint[] = [point]
  const passedCount = testPoints.filter((candidate) => candidate.compliance.verdict === 'PASS').length

  const resultSection: ReportResult = {
    // One failing test point fails the report; with a single point this is that point's verdict.
    verdict: passedCount === testPoints.length ? 'PASS' : 'FAIL',
    statement: point.compliance.comparisonText,
    basis: REPORT_SINGLE_RESULT_BASIS,
    scopeLimits: REPORT_SCOPE_LIMITS,
    testPointCount: testPoints.length,
    passedCount,
    failedCount: testPoints.length - passedCount,
  }

  const testSection: ReportTestInformation = {
    testType: REPORT_TEST_TYPE,
    evaluationType: REPORT_EVALUATION_TYPE,
    indicationMode: REPORT_INDICATION_MODE,
    testCondition: REPORT_TEST_CONDITION,
    observationText:
      `L = ${point.observation.load.text} · I = ${point.observation.indication.text} · ` +
      `ΔL = ${point.observation.additionalLoad.text} · I_next = ${point.observation.nextIndication.text} · ` +
      `E₀ = ${point.observation.zeroError.text}`,
    zeroErrorProvenance: `E₀ = ${point.observation.zeroError.text} — ${REPORT_ZERO_ERROR_PROVENANCE}.`,
    changeoverText: changeoverConfirmation(evaluation.result.resolution),
    testPointCount: testPoints.length,
  }

  const report: WeighingReport = {
    title: REPORT_TITLE,
    documentKind: REPORT_DOCUMENT_KIND,
    statusNotice: REPORT_STATUS_NOTICE,
    generatedAt,
    generatedAtText: formatTimestamp(generatedAt),
    instrument: instrumentSection(instrument),
    test: testSection,
    testPoints,
    result: resultSection,
    // Section E lists only the clauses the calculation rests on: the references the evaluation
    // itself carries, plus §3.6 for comparing a single result with the limit.
    references: [...evaluation.result.references.map(toReportReference), toReportReference(SINGLE_RESULT_REFERENCE)],
  }

  return { status: 'ready', checks, report }
}

function notReadySummary(
  instrument: NormalizedInstrument | null,
  evaluation: PerformedEvaluation | null,
): string {
  if (evaluation === null) return REPORT_NOT_READY_NO_EVALUATION
  if (instrument === null) {
    return 'The instrument configuration is not validated, so there is no range model to report against.'
  }
  if (evaluation.instrument !== instrument) return REPORT_NOT_READY_STALE_EVALUATION
  return REPORT_NOT_READY_INCOMPLETE
}
