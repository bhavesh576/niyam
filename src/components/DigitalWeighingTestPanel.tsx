import type { NormalizedInstrument } from '../domain/models/normalizedInstrument'
import type { TestObservationDraft, TestObservationField } from '../domain/models/observation'
import { withObservationField } from '../domain/models/observation'
import {
  calculationLines,
  calculationTrace,
  eStarStatement,
  evaluationSummary,
  traceSummary,
  verdictLabel,
  verdictStatement,
} from '../domain/evaluation/describe'
import type { EvaluationResult, ObservationIssue, PerformedEvaluation } from '../domain/evaluation/types'
import {
  applicableIntervalLabel,
  bracketLabel,
  consistencyLabel,
  mpeLabel,
  rangeLabel,
  resolutionNotes,
} from '../domain/resolution/describe'
import { formatMass } from '../utils/mass'
import { formatRuleReference, ruleStatusLabel } from '../utils/reference'
import { formatCount, subscript } from '../utils/text'
import type { ValidationIssue } from '../domain/validation/types'
import { CalculationTable } from './CalculationTable'
import { CalculationTrace } from './CalculationTrace'
import { ClauseTag } from './ClauseTag'
import { Collapsible } from './Collapsible'
import { IssueMessages } from './IssueMessages'
import { FieldLabel, MassField } from './MassField'
import { SectionHead } from './SectionHead'
import { StatusBanner } from './StatusBanner'

interface DigitalWeighingTestPanelProps {
  /** The validated, normalized instrument — `null` until the configuration has been accepted. */
  instrument: NormalizedInstrument | null
  draft: TestObservationDraft
  /** The evaluation performed for the values currently in the fields, or `null` when there is none. */
  evaluation: PerformedEvaluation | null
  /** `true` when an evaluation exists but was produced against a different instrument. */
  evaluationIsStale: boolean
  onDraftChange: (next: TestObservationDraft) => void
  /** Evaluates the draft as it stands. Does nothing while no instrument has been validated. */
  onEvaluate: () => void
  onResetObservation: () => void
  onOpenConfiguration: () => void
}

interface FieldSpec {
  field: TestObservationField
  id: string
  symbol: string
  text: string
  /**
   * The field's full name, `Test load L`: the visible label is symbol-first (`L — Test load`), while
   * this one names the unit selector beside it, which has no visible label of its own.
   */
  label: string
  /** Kept as the label's `title`: the full statement, without a paragraph under every field. */
  hint: string
  placeholder: string
}

/** The five observation quantities, in the order they are entered and reported. */
const OBSERVATION_FIELDS: readonly FieldSpec[] = [
  {
    field: 'load',
    id: 'observation-load',
    symbol: 'L',
    text: 'Test load',
    label: 'Test load L',
    hint: 'required — the load applied to the load receptor',
    placeholder: '2',
  },
  {
    field: 'indication',
    id: 'observation-indication',
    symbol: 'I',
    text: 'Indication',
    label: 'Indication I',
    hint: 'required — indicated at the load L, before any additional weight is applied',
    placeholder: '2000',
  },
  {
    field: 'additionalLoad',
    id: 'observation-additional-load',
    symbol: 'ΔL',
    text: 'Additional load',
    label: 'Additional load ΔL',
    hint: 'required — added in steps of 1/10 eᵢ until the indication increased by one scale interval',
    placeholder: '1.4',
  },
  {
    field: 'nextIndication',
    id: 'observation-next-indication',
    symbol: 'I_next',
    text: 'Next indication',
    label: 'Next indication I_next',
    hint: 'required — the indication (I + e) observed after ΔL was added',
    placeholder: '2002',
  },
  {
    field: 'zeroError',
    id: 'observation-zero-error',
    symbol: 'E₀',
    text: 'Zero error',
    label: 'Zero error E₀',
    hint: 'required, signed — determined at zero or near zero by the same procedure (A.4.2.3), never derived here',
    placeholder: '0.5',
  },
]

/**
 * Digital weighing test — the screen the prototype is for, as a split pane.
 *
 * Left: the instrument under test and the five quantities of one A.4.4.3 changeover observation, in a
 * two-column grid, with Evaluate. Right: what the evaluation made of them — verdict first, then the
 * resolved range context (load side and indication side apart, because e_L and e* are not the same
 * quantity), then the calculation, then the trace and the range-aware notes as closed disclosures.
 *
 * At 1280 × 720 the observation, Evaluate and the verdict are all on the first screen: the results go
 * into the right pane instead of pushing the form down.
 *
 * The component holds no domain logic and no state of its own, and three deliberate behaviours are
 * unchanged: nothing is calculated until the tester asks for it and a result is dropped as soon as an
 * input changes; a result calculated for a different instrument is never shown; a blocked evaluation
 * shows its reasons and the step the calculation stopped at — never a substituted or partial number.
 */
export function DigitalWeighingTestPanel({
  instrument,
  draft,
  evaluation,
  evaluationIsStale,
  onDraftChange,
  onEvaluate,
  onResetObservation,
  onOpenConfiguration,
}: DigitalWeighingTestPanelProps) {
  const result = evaluation === null || evaluationIsStale ? null : evaluation.result

  function handleFieldChange(field: TestObservationField, value: TestObservationDraft[TestObservationField]) {
    onDraftChange(withObservationField(draft, field, value))
  }

  function handleEvaluate() {
    if (instrument === null) return
    onEvaluate()
  }

  function issuesFor(field: TestObservationField): ValidationIssue[] {
    if (result === null) return []
    return result.issues.filter((issue) => issue.field === field).map(asFieldIssue)
  }

  if (instrument === null) {
    return (
      <div className="split split-solo" role="region" aria-labelledby="digital-test-title">
        <section className="pane">
          <h2 className="pane-title" id="digital-test-title">
            Digital Weighing Test
          </h2>
          <StatusBanner
            tone="warn"
            heading={3}
            announced
            mark="!"
            word="Not evaluated"
            statement="No validated instrument yet — the observation is evaluated against the normalized range model of the instrument under test, so the configuration has to be validated first."
          />
          <div className="pane-actions">
            <button type="button" className="button button-primary" onClick={onOpenConfiguration}>
              Open the instrument configuration
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="split split-test" role="region" aria-labelledby="digital-test-title">
      {/* LEFT — what the tester enters. */}
      <section className="pane pane-input">
        <h2 className="pane-title" id="digital-test-title">
          Digital Weighing Test
        </h2>

        <InstrumentStrip instrument={instrument} />

        <SectionHead category="entered" title="Test observation" note="five entries · none derived" />

        <div className="field-grid observation-grid">
          {OBSERVATION_FIELDS.map((spec) => (
            <div className="field-cell" key={spec.field}>
              <FieldLabel htmlFor={spec.id} symbol={spec.symbol} text={spec.text} title={spec.hint} />
              <MassField
                id={spec.id}
                label={spec.label}
                value={draft[spec.field]}
                issues={issuesFor(spec.field)}
                onChange={(value) => handleFieldChange(spec.field, value)}
                placeholder={spec.placeholder}
              />
            </div>
          ))}
        </div>

        <p className="grid-helper">
          ΔL is added in steps of 1/10 eᵢ until the indication increases unambiguously by one scale interval (I + e).
          E₀ is required, signed — determined at zero or near zero by the same procedure (A.4.2.3), never derived here.
        </p>

        <div className="pane-actions">
          <button type="button" className="button button-primary button-hero" onClick={handleEvaluate}>
            Evaluate
          </button>
          <button type="button" className="button button-ghost" onClick={onResetObservation}>
            Reset to transition example
          </button>
          <span className="actions-note">Nothing is calculated until Evaluate. Editing discards the result.</span>
        </div>
      </section>

      {/* RIGHT — what the evaluation made of it. */}
      <section className="pane pane-result">
        {evaluationIsStale ? (
          <StatusBanner
            tone="warn"
            heading={3}
            announced
            mark="!"
            word="Not evaluated"
            statement="The instrument under test has changed since this observation was evaluated, so the previous result is not shown: it belongs to a different range model. Press Evaluate to evaluate these values against the instrument as it is now."
          />
        ) : result === null ? (
          <p className="pane-empty">
            No result yet. Enter the observation and press Evaluate. The fields are pre-filled with the §3.3.3
            changeover at Max₁ = 2 kg.
          </p>
        ) : (
          <EvaluationResult result={result} />
        )}
      </section>
    </div>
  )
}

/**
 * The instrument under test, as validated: one line and three range chips, read-only.
 *
 * It stays in view while the observation is entered because everything on this screen is resolved
 * against it — but it is context, so it is 48 px of text and not a card of its own.
 */
function InstrumentStrip({ instrument }: { instrument: NormalizedInstrument }) {
  return (
    <div
      className="instrument-strip"
      title="The validated multi-interval configuration this observation is evaluated against. d = e₁ because Table 2 gives e = d for an instrument without an auxiliary indicating device."
    >
      <p className="strip-line">
        <span className="strip-label">Instrument under test</span>
        <span className="strip-fact">
          Class {instrument.accuracyClass} — {instrument.instrumentType}
        </span>
        <span className="strip-fact">
          Min {formatMass(instrument.minCapacityGrams)} → Max {formatMass(instrument.maxCapacityGrams)}
        </span>
        <span className="strip-fact">d = e₁ = {formatMass(instrument.displayDivisionGrams)}</span>
      </p>
      <div className="strip-ranges">
        {instrument.ranges.map((range) => (
          <span
            key={range.id}
            className="strip-range"
            title={`Range ${range.rangeNumber} · n${subscript(range.rangeNumber)} = ${formatCount(
              range.verificationIntervals,
            )}`}
          >
            <span className="strip-range-n">{range.rangeNumber}</span>
            <span className="strip-sep" aria-hidden="true">
              {'·'}
            </span>
            {formatMass(range.lowerBoundGrams)} → {formatMass(range.upperBoundGrams)}
            <span className="strip-sep" aria-hidden="true">
              {'·'}
            </span>
            <span className="strip-range-e">
              e{subscript(range.rangeNumber)} = {formatMass(range.verificationIntervalGrams)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * The technical result of one evaluation, in the order it is read: verdict, resolved range context,
 * calculation, then the two closed disclosures that carry the full trace and the range-aware notes.
 */
function EvaluationResult({ result }: { result: EvaluationResult }) {
  const { resolution, range_L, range_I, range_I_next } = result
  const { mpe, check_I, check_I_next, ranges } = resolution
  const lines = calculationLines(result)
  const steps = calculationTrace(result)
  const notes = resolutionNotes(resolution)
  const passed = result.passed === true

  if (result.status === 'blocked') {
    return (
      <>
        <StatusBanner
          tone="warn"
          heading={3}
          announced
          mark="!"
          word="Not evaluated"
          statement={`${formatCount(result.issues.length)} ${result.issues.length === 1 ? 'problem' : 'problems'} · no intermediate value and no verdict is produced`}
        >
          <IssueMessages issues={result.issues.map(asFieldIssue)} idPrefix="observation-blocked" />
        </StatusBanner>

        <Collapsible
          title="Calculation trace"
          note={`${traceSummary(steps)} · stopped at the first step that could not be completed`}
          defaultOpen
        >
          <CalculationTrace steps={steps} />
        </Collapsible>
      </>
    )
  }

  return (
    <>
      <StatusBanner
        tone={passed ? 'pass' : 'fail'}
        verdict
        mark={passed ? '✓' : '✕'}
        word={verdictLabel(result)}
        statement={verdictStatement(result)}
      />

      <SectionHead
        category="resolved"
        title="Range context"
        note={`initial verification · class ${mpe.accuracyClass} · e from the resolved partial range (§3.3.3)`}
      />
      <p className="evaluation-summary">{evaluationSummary(result)}</p>

      <div className="resolution-panels">
        <div className="resolution-panel panel-load">
          <h4 className="resolution-panel-title">Load side</h4>
          <table className="model-table resolution-table">
            <caption>
              Load side of the resolution used by this evaluation: range_L, e_L, m = L / e_L, the Table 6 bracket and
              the maximum permissible error that follows from it.
            </caption>
            <tbody>
              <tr>
                <th scope="row">range_L</th>
                <td className="resolution-value">{rangeLabel(range_L)}</td>
              </tr>
              <tr>
                <th scope="row">e_L</th>
                <td className="resolution-value">{applicableIntervalLabel(range_L)}</td>
              </tr>
              <tr>
                <th scope="row">m = L / e_L</th>
                <td className="resolution-value">{mpe.m === null ? '—' : formatCount(mpe.m)}</td>
              </tr>
              <tr>
                <th scope="row">Table 6</th>
                <td className="resolution-value">{bracketLabel(mpe)}</td>
              </tr>
              <tr className="resolution-row-strong">
                <th scope="row">MPE</th>
                <td className="resolution-value">
                  <span className="resolution-mpe">{mpeLabel(mpe, range_L)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="resolution-panel panel-indication">
          <h4 className="resolution-panel-title">Indication side</h4>
          <table className="model-table resolution-table">
            <caption>
              Indication side of the resolution used by this evaluation: range_I, range_I_next and the changeover
              interval e*, which is the interval the ½ e term of A.4.4.3 takes.
            </caption>
            <tbody>
              <tr>
                <th scope="row">range_I</th>
                <td className="resolution-value">{rangeLabel(range_I)}</td>
              </tr>
              <tr>
                <th scope="row">range_I_next</th>
                <td className="resolution-value">{rangeLabel(range_I_next)}</td>
              </tr>
              <tr className="resolution-row-strong">
                <th scope="row">e*</th>
                <td className="resolution-value" title={eStarStatement(result)}>
                  <span className="resolution-mpe">
                    {ranges.e_star === null ? eStarStatement(result) : applicableIntervalLabel(range_I_next)}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">I displayable</th>
                <td className="resolution-value">{consistencyLabel(check_I)}</td>
              </tr>
              <tr>
                <th scope="row">I_next displayable</th>
                <td className="resolution-value">{consistencyLabel(check_I_next)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {lines.length > 0 ? (
        <>
          <SectionHead category="calculated" title="A.4.4.3 calculation" note="masses in g · signs kept" />
          <CalculationTable lines={lines} />
          <p className="scope-line">
            Scope: The mpe in service (§3.5.2, twice this limit) is not applied in this build, and no uncertainty band
            or grey zone is evaluated — the limit is the limit Table 6 prints.
          </p>
        </>
      ) : null}

      <Collapsible title="Calculation trace" note={traceSummary(steps)}>
        <CalculationTrace steps={steps} />
      </Collapsible>

      <Collapsible
        title="Range-aware notes"
        note={notes.length > 0 ? formatCount(notes.length) : 'none'}
      >
        {notes.length > 0 ? (
          <ul className="resolution-notes">
            {notes.map((note) => (
              <li key={note.slice(0, 48)} className="resolution-note">
                {note}
              </li>
            ))}
          </ul>
        ) : (
          <p className="model-note">
            This resolution needed no qualifying note: L, I and I_next each fall inside a partial weighing range, away
            from its bounds, and both indications are displayable in the range they fall in.
          </p>
        )}

        <p className="reference-line">
          {result.references.map((reference, index) => {
            const status = ruleStatusLabel(reference)
            return (
              // The clause list alone is not a key: two references rest on A.4.4.3 — one on the
              // procedure, one on the formulae. The list itself is fixed and never reordered, so the
              // position in it is stable.
              <span key={`reference-${index + 1}-${reference.clauses.join('+')}`} className="trace-reference">
                <ClauseTag>{formatRuleReference(reference)}</ClauseTag>
                {status ? ` · ${status}` : ''}
              </span>
            )
          })}
        </p>
      </Collapsible>
    </>
  )
}

/** An observation issue rendered by the shared field-message components (which address config fields). */
function asFieldIssue(issue: ObservationIssue): ValidationIssue {
  return { ...issue, field: null }
}
