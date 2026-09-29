import { describe, expect, it } from 'vitest'
import { officialExampleInstrument, singleRangeBracketInstrument } from '../../testing/fixtures'
import { createExampleObservationDraft, createFailingObservationDraft } from '../../data/defaultConfiguration'
import { createMassDraft } from '../models/draft'
import type { TestObservationDraft } from '../models/observation'
import { toTestObservationInput, withObservationField } from '../models/observation'
import { evaluateDigitalWeighingObservation } from '../evaluation/evaluateObservation'
import type { PerformedEvaluation } from '../evaluation/types'
import { calculationLines, calculationTrace, evaluationSummary, mpeBracketStatement, verdictStatement } from '../evaluation/describe'
import type { ReportNotReady, ReportTestPoint, WeighingReport } from './types'
import {
  REPORT_NOT_READY_HEADLINE,
  REPORT_NOT_READY_INCOMPLETE,
  REPORT_NOT_READY_NO_EVALUATION,
  REPORT_NOT_READY_STALE_EVALUATION,
  REPORT_SCOPE_LIMITS,
  REPORT_SINGLE_RESULT_BASIS,
  REPORT_STATUS_NOTICE,
  REPORT_TITLE,
} from './content'
import { buildWeighingReport } from './buildReport'

/**
 * Phase 4: the report model is a **mapping** of the Phase 3 result, and a gated one.
 *
 * Three things are tested here, and they are the three things that would silently break the
 * architecture if they were left untested:
 *
 * 1. **Identity.** Every number the report carries is the number the evaluation produced — compared
 *    by value against the result object itself, not against a second expectation of the arithmetic.
 *    If the report ever recalculated P, E, Ec or the mpe, these comparisons would still pass only
 *    while the recalculation agreed, which is exactly why the source scan in
 *    `noDuplicateCalculation.test.ts` exists alongside them.
 * 2. **The gate.** Every incomplete input produces `not-ready` with reasons, and never an object
 *    that holds a report — so no code path can render a partially populated document.
 * 3. **The transition.** The §3.3.3 observation, where range_L, range_I and range_I_next are not
 *    the same range and e* ≠ e_L, keeps all five resolved values in the report.
 */

const instrument = officialExampleInstrument()
const GENERATED_AT = new Date(2026, 8, 29, 19, 41)

function evaluate(draft: TestObservationDraft, against = instrument): PerformedEvaluation {
  const input = toTestObservationInput(draft)
  return { instrument: against, input, result: evaluateDigitalWeighingObservation(against, input) }
}

/** The observation of the §3.3.3 example: L = 2 kg at the changeover into range 2. PASS. */
const transition = () => evaluate(createExampleObservationDraft())
/** The same observation with ΔL = 1.6 g, which puts |Ec| outside the limit. FAIL. */
const failing = () => evaluate(createFailingObservationDraft())

function build(evaluation: PerformedEvaluation | null, against = instrument) {
  return buildWeighingReport({ instrument: against, evaluation, generatedAt: GENERATED_AT })
}

/** Fails the test with the reasons if the report is not ready — the reasons are the useful part. */
function readyReport(evaluation: PerformedEvaluation, against = instrument): WeighingReport {
  const outcome = build(evaluation, against)
  if (outcome.status !== 'ready') {
    throw new Error(`expected a ready report, got: ${outcome.reasons.join(' | ')}`)
  }
  return outcome.report
}

/** The blocked outcome, or a failure naming what was generated instead. */
function blocked(evaluation: PerformedEvaluation | null, against = instrument): ReportNotReady {
  const outcome = build(evaluation, against)
  if (outcome.status !== 'not-ready') {
    throw new Error('expected the report to be blocked, but a report was generated')
  }
  return outcome
}

function firstPoint(report: WeighingReport): ReportTestPoint {
  const point = report.testPoints[0]
  if (point === undefined) throw new Error('the report carries no test point')
  return point
}

describe('report readiness (§8)', () => {
  it('names the six gates in order, and satisfies all of them for a complete evaluation', () => {
    const outcome = build(transition())

    expect(outcome.status).toBe('ready')
    expect(outcome.checks.map((check) => check.id)).toEqual([
      'input-data',
      'configuration',
      'calculation',
      'range-resolution',
      'mpe',
      'result',
    ])
    expect(outcome.checks.map((check) => check.label)).toEqual([
      'Input data',
      'Configuration',
      'Calculation',
      'Range resolution',
      'MPE',
      'Result',
    ])
    expect(outcome.checks.every((check) => check.ok)).toBe(true)
  })

  it('reports what it read for each satisfied gate, with the values it read it from', () => {
    const outcome = build(transition())
    if (outcome.status !== 'ready') throw new Error('expected ready')
    const byId = Object.fromEntries(outcome.checks.map((check) => [check.id, check.detail]))

    expect(byId['input-data']).toBe('Complete — L = 2000 g, I = 2000 g, ΔL = 1.4 g, I_next = 2002 g, E₀ = +0.5 g.')
    expect(byId['configuration']).toContain('Valid — class III, multi-interval, 3 partial weighing ranges')
    expect(byId['calculation']).toBe('Available — P = 1999.6 g, E = −0.4 g, Ec = −0.9 g.')
    expect(byId['range-resolution']).toBe(
      'Available — range_L = range 1 · range_I = range 1 · range_I_next = range 2 · e_L = 1 g · e* = 2 g.',
    )
    expect(byId['mpe']).toBe(
      'Available — m = 2,000 → 500 < m ≤ 2 000 → ± 1.0 e₁ → mpe = ± 1 g (initial verification, class III).',
    )
    expect(byId['result']).toBe('Available — PASS: |Ec| = 0.9 g ≤ mpe = 1 g — margin 0.1 g.')
  })

  it('is not ready without a validated instrument, and carries no report at all', () => {
    const outcome = buildWeighingReport({ instrument: null, evaluation: transition(), generatedAt: GENERATED_AT })
    if (outcome.status !== 'not-ready') throw new Error('expected the report to be blocked')

    expect('report' in outcome).toBe(false)
    expect(outcome.headline).toBe(REPORT_NOT_READY_HEADLINE)
    expect(outcome.checks.find((check) => check.id === 'configuration')?.ok).toBe(false)
    expect(outcome.checks.find((check) => check.id === 'configuration')?.detail).toContain(
      'no validated instrument configuration',
    )
  })

  it('is not ready before anything was evaluated, and says what to do instead', () => {
    const outcome = blocked(null)

    expect('report' in outcome).toBe(false)
    expect(outcome.summary).toBe(REPORT_NOT_READY_NO_EVALUATION)
    // The configuration is valid, so that one gate is satisfied; the five that need an evaluation are not.
    expect(outcome.checks.map((check) => check.ok)).toEqual([false, true, false, false, false, false])
    expect(outcome.reasons).toHaveLength(5)
    expect(outcome.reasons.join(' ')).toContain('Input data')
    expect(outcome.reasons.join(' ')).toContain('no evaluation was performed')
  })

  it('is not ready when the evaluation belongs to a different instrument configuration', () => {
    const stale = transition()
    const outcome = blocked(stale, singleRangeBracketInstrument())

    expect('report' in outcome).toBe(false)
    expect(outcome.summary).toBe(REPORT_NOT_READY_STALE_EVALUATION)
    expect(outcome.checks.find((check) => check.id === 'configuration')?.detail).toContain(
      'performed against a different instrument configuration',
    )
  })

  it('is not ready when E₀ is missing: no calculation, no verdict, no report', () => {
    const withoutZeroError = evaluate(
      withObservationField(createExampleObservationDraft(), 'zeroError', createMassDraft()),
    )
    expect(withoutZeroError.result.status).toBe('blocked')

    const outcome = blocked(withoutZeroError)

    expect('report' in outcome).toBe(false)
    expect(outcome.headline).toBe(REPORT_NOT_READY_HEADLINE)
    expect(outcome.summary).toBe(REPORT_NOT_READY_INCOMPLETE)
    expect(outcome.checks.find((check) => check.id === 'input-data')?.detail).toBe('Incomplete — E₀ is missing.')
    expect(outcome.checks.find((check) => check.id === 'calculation')?.ok).toBe(false)
    expect(outcome.checks.find((check) => check.id === 'calculation')?.detail).toContain('E0 is required')
    expect(outcome.checks.find((check) => check.id === 'result')?.ok).toBe(false)
    expect(outcome.reasons.join(' ')).not.toContain('Complete —')
  })

  it('is not ready when ΔL is missing, and names ΔL as the missing quantity', () => {
    const withoutAdditionalLoad = evaluate(
      withObservationField(createExampleObservationDraft(), 'additionalLoad', createMassDraft()),
    )
    const outcome = blocked(withoutAdditionalLoad)

    expect('report' in outcome).toBe(false)
    expect(outcome.checks.find((check) => check.id === 'input-data')?.detail).toBe('Incomplete — ΔL is missing.')
  })

  it('is not ready when I_next is not an indication its range can display', () => {
    // 2005 g is not a multiple of e₂ = 2 g, so range_I_next cannot display it and e* is not resolved.
    const undisplayable = evaluate(
      withObservationField(createExampleObservationDraft(), 'nextIndication', createMassDraft('2005', 'g')),
    )
    expect(undisplayable.result.status).toBe('blocked')

    const outcome = blocked(undisplayable)

    expect('report' in outcome).toBe(false)
    expect(outcome.summary).toBe(REPORT_NOT_READY_INCOMPLETE)
    expect(outcome.checks.find((check) => check.id === 'input-data')?.ok).toBe(true)
    expect(outcome.checks.find((check) => check.id === 'calculation')?.ok).toBe(false)
    expect(outcome.checks.find((check) => check.id === 'range-resolution')?.detail).toContain(
      'range_I_next / e* was not resolved',
    )
    // The reason carries the message the tester has to act on, not a generic refusal.
    expect(outcome.reasons.join(' ')).toContain('Invalid next indication')
    expect(outcome.reasons.join(' ')).toContain('not a multiple of 2 g')
    expect(outcome.reasons.join(' ')).not.toContain('2002 g is')
  })

  it('is not ready when I_next is displayable but is not one scale interval above I', () => {
    // 2004 g = I + 2·e₂: the range can display it, but A.4.4.3 needs the indication one interval up.
    const notOneInterval = evaluate(
      withObservationField(createExampleObservationDraft(), 'nextIndication', createMassDraft('2004', 'g')),
    )
    expect(notOneInterval.result.status).toBe('blocked')

    const outcome = blocked(notOneInterval)

    expect('report' in outcome).toBe(false)
    expect(outcome.reasons.join(' ')).toContain('one scale interval')
    expect(outcome.checks.find((check) => check.id === 'result')?.detail).toContain('no verdict')
  })

  it('is not ready when I_next does not lie above I', () => {
    const notIncreased = evaluate(
      withObservationField(createExampleObservationDraft(), 'nextIndication', createMassDraft('2000', 'g')),
    )
    const outcome = blocked(notIncreased)

    expect('report' in outcome).toBe(false)
    expect(outcome.reasons.join(' ')).toContain('is not greater than I')
  })

  it('never produces a report object alongside a failing gate', () => {
    const outcomes = [
      build(null),
      buildWeighingReport({ instrument: null, evaluation: null, generatedAt: GENERATED_AT }),
      build(evaluate(withObservationField(createExampleObservationDraft(), 'load', createMassDraft()))),
      build(evaluate(withObservationField(createExampleObservationDraft(), 'indication', createMassDraft()))),
      build(evaluate(withObservationField(createExampleObservationDraft(), 'zeroError', createMassDraft()))),
      build(failing()),
    ]

    for (const outcome of outcomes.slice(0, 5)) {
      expect(outcome.status).toBe('not-ready')
      if (outcome.status !== 'not-ready') throw new Error('expected the report to be blocked')
      expect('report' in outcome).toBe(false)
      expect(outcome.headline).toBe(REPORT_NOT_READY_HEADLINE)
      expect(outcome.reasons.length).toBeGreaterThan(0)
    }
    // The failing observation is complete: it is ready, and its verdict is FAIL.
    expect(outcomes[5]?.status).toBe('ready')
  })
})

describe('report mapping — every value is the result’s own value', () => {
  it('carries the observation, the calculation and the limit as the numbers the evaluation produced', () => {
    const evaluation = transition()
    const result = evaluation.result
    const point = firstPoint(readyReport(evaluation))

    expect(point.observation.load.grams).toBe(result.observation.loadGrams)
    expect(point.observation.indication.grams).toBe(result.observation.indicationGrams)
    expect(point.observation.additionalLoad.grams).toBe(result.observation.additionalLoadGrams)
    expect(point.observation.nextIndication.grams).toBe(result.observation.nextIndicationGrams)
    expect(point.observation.zeroError.grams).toBe(result.observation.zeroErrorGrams)

    expect(point.calculation.halfChangeoverInterval.grams).toBe(result.halfEStarGrams)
    expect(point.calculation.p.grams).toBe(result.P)
    expect(point.calculation.e.grams).toBe(result.E)
    expect(point.calculation.ec.grams).toBe(result.Ec)

    expect(point.context.loadInterval.grams).toBe(result.e_L)
    expect(point.context.changeoverInterval.grams).toBe(result.e_star)

    expect(point.compliance.intervalCount).toBe(result.m)
    expect(point.compliance.mpe.grams).toBe(result.mpeGrams)
    expect(point.compliance.absoluteCorrectedError.grams).toBe(result.absoluteEcGrams)
    expect(point.compliance.margin.grams).toBe(result.marginGrams)
    expect(point.compliance.bracketText).toBe(result.mpeBracket?.mCellText)
  })

  it('carries the resolved ranges, not a re-resolution of them', () => {
    const evaluation = transition()
    const result = evaluation.result
    const point = firstPoint(readyReport(evaluation))

    expect(point.context.loadRange.rangeNumber).toBe(result.range_L.range?.rangeNumber)
    expect(point.context.indicationRange.rangeNumber).toBe(result.range_I.range?.rangeNumber)
    expect(point.context.nextIndicationRange.rangeNumber).toBe(result.range_I_next.range?.rangeNumber)
    expect(point.context.loadRange.text).toBe('Range 1 (20 g → 2 kg)')
    expect(point.context.nextIndicationRange.text).toBe('Range 2 (2 kg → 5 kg)')
  })

  it('prints the substitution lines and the trace exactly as the evaluation printed them', () => {
    const evaluation = transition()
    const point = firstPoint(readyReport(evaluation))

    expect(point.calculation.lines).toEqual(calculationLines(evaluation.result))
    expect(point.calculation.trace).toEqual(calculationTrace(evaluation.result))
    expect(point.calculation.trace).toHaveLength(10)
    expect(point.calculation.trace.every((step) => step.completed)).toBe(true)
  })

  it('takes the compliance wording and the verdict from the evaluation as well', () => {
    const evaluation = transition()
    const result = evaluation.result
    const point = firstPoint(readyReport(evaluation))

    expect(point.compliance.mpeStatement).toBe(mpeBracketStatement(result))
    expect(point.compliance.comparisonText).toBe(verdictStatement(result))
    expect(point.compliance.comparisonText).toBe('|Ec| = 0.9 g ≤ mpe = 1 g — margin 0.1 g')
    expect(point.compliance.verdict).toBe(result.passed ? 'PASS' : 'FAIL')
    expect(point.compliance.verdict).toBe('PASS')
    expect(point.context.limitChain).toContain(evaluationSummary(result).split(' · ')[0] === '' ? '' : 'L = 2000 g')
  })

  it('prints the transition values the report has to keep: range_L, range_I, range_I_next, e_L and e*', () => {
    const point = firstPoint(readyReport(transition()))

    expect(point.context.loadRange.tableText).toBe('1')
    expect(point.context.indicationRange.tableText).toBe('1')
    expect(point.context.nextIndicationRange.tableText).toBe('2')
    expect(point.context.loadInterval.text).toBe('e_L = e₁ = 1 g')
    expect(point.context.loadInterval.tableText).toBe('1')
    expect(point.context.changeoverInterval.text).toBe('e* = e₂ = 2 g')
    expect(point.context.changeoverInterval.symbol).toBe('e₂')
    expect(point.context.changeoverInterval.tableText).toBe('2')

    // §7: the two chains, separately — the load side ends at the mpe, the indication side at e*.
    expect(point.context.limitChain).toBe(
      'L = 2000 g → Range 1 (20 g → 2 kg) → e_L = e₁ = 1 g → m = L / e₁ = 2,000 → 500 < m ≤ 2 000 → mpe = ± 1 g',
    )
    expect(point.context.changeoverChain).toBe(
      'I = 2000 g → Range 1 (20 g → 2 kg) (e₁ = 1 g); I_next = 2002 g → Range 2 (2 kg → 5 kg) → e* = e₂ = 2 g',
    )
    expect(point.context.notes.join(' ')).toContain('e*')
  })

  it('prints the fifteen values of the result table in grams, with signs kept where R-76 signs them', () => {
    const point = firstPoint(readyReport(transition()))

    expect([
      point.observation.load.tableText,
      point.observation.indication.tableText,
      point.observation.additionalLoad.tableText,
      point.observation.nextIndication.tableText,
      point.context.loadRange.tableText,
      point.context.indicationRange.tableText,
      point.context.nextIndicationRange.tableText,
      point.context.loadInterval.tableText,
      point.context.changeoverInterval.tableText,
      point.calculation.p.tableText,
      point.calculation.e.tableText,
      point.observation.zeroError.tableText,
      point.calculation.ec.tableText,
      point.compliance.mpe.tableText,
      point.compliance.verdict,
    ]).toEqual(['2000', '2000', '1.4', '2002', '1', '1', '2', '1', '2', '1999.6', '−0.4', '+0.5', '−0.9', '± 1', 'PASS'])

    expect(point.observation.zeroError.text).toBe('+0.5 g')
    expect(point.calculation.e.text).toBe('−0.4 g')
    expect(point.calculation.ec.text).toBe('−0.9 g')
    expect(point.calculation.p.text).toBe('1999.6 g')
    expect(point.compliance.margin.text).toBe('+0.1 g')
  })

  it('reports FAIL, with the excess, when |Ec| is outside the limit', () => {
    const evaluation = failing()
    const report = readyReport(evaluation)
    const point = firstPoint(report)

    expect(point.compliance.verdict).toBe('FAIL')
    expect(point.compliance.absoluteCorrectedError.text).toBe('1.1 g')
    expect(point.compliance.comparisonText).toContain('> mpe = 1 g')
    expect(point.compliance.comparisonText).toContain('excess 0.1 g')
    expect(point.compliance.margin.text).toBe('−0.1 g')
    expect(report.result.verdict).toBe('FAIL')
    expect(report.result.passedCount).toBe(0)
    expect(report.result.failedCount).toBe(1)
    expect(report.result.statement).toBe(verdictStatement(evaluation.result))
  })

  it('reports PASS, with the margin, when |Ec| is inside the limit', () => {
    const report = readyReport(transition())

    expect(report.result.verdict).toBe('PASS')
    expect(report.result.testPointCount).toBe(1)
    expect(report.result.passedCount).toBe(1)
    expect(report.result.failedCount).toBe(0)
    expect(report.result.basis).toBe(REPORT_SINGLE_RESULT_BASIS)
  })
})

describe('the report document (§5)', () => {
  it('is titled as a prototype and carries the notice that it is not a certificate', () => {
    const report = readyReport(transition())

    expect(report.title).toBe(REPORT_TITLE)
    expect(report.title).toBe('R-76 Weighing Performance Evaluation — Prototype')
    expect(report.statusNotice).toBe(REPORT_STATUS_NOTICE)
    expect(report.statusNotice).toContain('not an OIML certificate')
    expect(report.statusNotice).toContain('not a government or statutory approval')
    expect(report.statusNotice).toContain('not a legal metrology certificate')
    expect(report.statusNotice).toContain('competent legal metrology authority')
  })

  it('identifies the instrument by its configuration, and says which identification is not recorded', () => {
    const { instrument: section } = readyReport(transition())

    expect(section.identifier).toBe('Max = 2 kg / 5 kg / 15 kg · e = 1 g / 2 g / 10 g · Min = 20 g · d = 1 g')
    expect(section.identificationNote).toContain('make, model, serial number')
    expect(section.identificationNote).toContain('not recorded in this prototype')
    expect(section.accuracyClassText).toBe('Class III')
    expect(section.classAndTypeText).toBe('Class III — multi-interval')
    expect(section.capacitiesText).toBe('Min = 20 g → Max = Max₃ = 15 kg')
    expect(section.displayDivisionText).toContain('e = d')
    expect(section.partialRangeCount).toBe(3)
  })

  it('prints the partial weighing ranges with the interval and the interval count of each', () => {
    const { instrument: section } = readyReport(transition())

    expect(section.ranges.map((range) => range.rangeNumber)).toEqual([1, 2, 3])
    expect(section.ranges.map((range) => range.intervalText)).toEqual(['e₁ = 1 g', 'e₂ = 2 g', 'e₃ = 10 g'])
    expect(section.ranges.map((range) => range.lowerBoundText)).toEqual(['Min₁ = 20 g', 'Min₂ = 2 kg', 'Min₃ = 5 kg'])
    expect(section.ranges.map((range) => range.upperBoundText)).toEqual(['Max₁ = 2 kg', 'Max₂ = 5 kg', 'Max₃ = 15 kg'])
    expect(section.ranges.map((range) => range.intervalsText)).toEqual(['n₁ = 2,000', 'n₂ = 2,500', 'n₃ = 1,500'])
  })

  it('states the test type, the evaluation type, the indication mode and the condition', () => {
    const { test } = readyReport(transition())

    expect(test.testType).toBe('Weighing test — evaluation of error at a changeover point')
    expect(test.evaluationType).toBe('Initial verification')
    expect(test.indicationMode).toContain('Digital indication, no auxiliary indicating device')
    expect(test.indicationMode).toContain('e = d')
    expect(test.testCondition).toContain('1/10 eᵢ')
    expect(test.testCondition).toContain('increased unambiguously by one scale interval')
    expect(test.observationText).toBe('L = 2000 g · I = 2000 g · ΔL = 1.4 g · I_next = 2002 g · E₀ = +0.5 g')
    expect(test.testPointCount).toBe(1)
  })

  it('says where E₀ came from, and confirms the changeover that e* was taken from', () => {
    const { test } = readyReport(transition())

    expect(test.zeroErrorProvenance).toContain('E₀ = +0.5 g — entered by the tester')
    expect(test.zeroErrorProvenance).toContain('not derived here')
    expect(test.zeroErrorProvenance).toContain('not assumed to be zero')
    expect(test.changeoverText).toContain('I_next − I = 2 g = e₂')
    expect(test.changeoverText).toContain('increased unambiguously by one scale interval')
  })

  it('holds one test point now, in an array that a series of test points can fill later', () => {
    const report = readyReport(transition())

    expect(Array.isArray(report.testPoints)).toBe(true)
    expect(report.testPoints).toHaveLength(1)
    expect(firstPoint(report).label).toBe('Test point 1')
  })

  it('lists only the clauses this evaluation rests on, with the quote behind each', () => {
    const report = readyReport(transition())
    const citations = report.references.map((reference) => reference.citation)
    const joined = citations.join(' | ')

    expect(citations.every((citation) => citation.startsWith('OIML R 76-1:2006 (E) — '))).toBe(true)
    // Used: the procedure, the limit table, the multi-interval rules, e = d, and §3.6 for a single result.
    expect(joined).toContain('A.4.4.3')
    expect(joined).toContain('Table 6')
    expect(joined).toContain('§3.5.1')
    expect(joined).toContain('§3.3.3')
    expect(joined).toContain('§3.4.1')
    expect(joined).toContain('§3.6')
    // Not used, therefore not cited: in-service limits, repeatability, eccentric loading, the test suite.
    expect(joined).not.toContain('3.5.2')
    expect(joined).not.toContain('3.6.1')
    expect(joined).not.toContain('3.6.2')
    expect(joined).not.toContain('A.4.4.1')

    const singleResult = report.references.find((reference) => reference.citation.endsWith('§3.6'))
    expect(singleResult?.quote).toContain(
      'the error of any single weighing result shall by itself not exceed the maximum permissible error',
    )
  })

  it('prints what the evaluation does not cover next to the result', () => {
    const report = readyReport(transition())

    expect(report.result.scopeLimits).toEqual(REPORT_SCOPE_LIMITS)
    expect(report.result.scopeLimits).toHaveLength(7)
    const limits = report.result.scopeLimits.join(' ')
    expect(limits).toContain('§3.5.2')
    expect(limits).toContain('§3.6.1')
    expect(limits).toContain('A.4.4.1')
    expect(limits).toContain('A.4.2.3')
    expect(limits).toContain('uncertainty')
    expect(limits).toContain('multiple-range instruments')
  })

  it('stamps the moment it was generated, and keeps the timestamp it was given', () => {
    const report = readyReport(transition())

    expect(report.generatedAt).toBe(GENERATED_AT)
    expect(report.generatedAtText).toBe('2026-09-29 19:41')
  })

  it('pads a single-digit month, day, hour and minute in the printed timestamp', () => {
    const report = readyReport(transition(), instrument)
    const early = buildWeighingReport({
      instrument,
      evaluation: transition(),
      generatedAt: new Date(2026, 0, 5, 8, 7),
    })

    expect(early.status).toBe('ready')
    if (early.status === 'ready') expect(early.report.generatedAtText).toBe('2026-01-05 08:07')
    expect(report.generatedAtText).toBe('2026-09-29 19:41')
  })
})
