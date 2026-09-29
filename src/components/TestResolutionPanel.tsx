import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { NormalizedInstrument } from '../domain/models/normalizedInstrument'
import type { TestConditionDraft } from '../domain/models/testCondition'
import { toTestConditionInput, withTestConditionField } from '../domain/models/testCondition'
import { boundaryProbes } from '../domain/resolution/boundaries'
import {
  applicableIntervalLabel,
  bracketLabel,
  consistencyLabel,
  intervalCountLabel,
  mpeLabel,
  rangeLabel,
  resolutionNotes,
} from '../domain/resolution/describe'
import { indicationIssue } from '../domain/resolution/indicationConsistency'
import { resolveTestCondition } from '../domain/resolution/resolveTestCondition'
import { formatMass } from '../utils/mass'
import { formatRuleReference, ruleStatusLabel } from '../utils/reference'
import { formatCount, subscript } from '../utils/text'
import { BoundaryProbeTable } from './BoundaryProbeTable'
import { Collapsible } from './Collapsible'
import { FieldLabel, MassField } from './MassField'
import { SectionHead } from './SectionHead'

interface TestResolutionPanelProps {
  /** The validated, normalized instrument the test condition is resolved against. */
  instrument: NormalizedInstrument
  draft: TestConditionDraft
  onDraftChange: (next: TestConditionDraft) => void
}

/**
 * Range Probe and Range Boundaries — the diagnostic drawer of the configuration screen.
 *
 * Both are disclosures: they are there whenever a configuration has been accepted, they start closed
 * so that the configuration itself is what the screen is about, and opening one shows the resolution
 * in full — never a summary of it.
 *
 * Available only for a configuration the validator accepted, because range resolution needs a
 * normalized range model. It answers three questions and stops there:
 *
 * 1. Which partial weighing range contains the test load L, the indication I and the next
 *    indication I_next? (§3.3.1, §3.3.3) — three separate lookups, three possibly different ranges.
 * 2. Which verification scale interval applies to each of them — `e_L`, `e_I` and `e*`? An
 *    indication is additionally checked against the scale interval of the range it appears in: a
 *    value the instrument cannot display is rejected at its field, and `e*` is then withheld
 *    (`indicationConsistency.ts`).
 * 3. Which maximum permissible error on initial verification follows for L? (§3.5.1, Table 6)
 *
 * It deliberately does not calculate an error of indication, a changeover point or a PASS/FAIL
 * verdict, and it prints no report — that is the digital weighing test (`DigitalWeighingTestPanel`),
 * which consumes the resolution produced here.
 *
 * The component holds no domain logic: it converts the draft to grams, calls
 * {@link resolveTestCondition} and {@link boundaryProbes}, and renders the structured result with
 * the wording the domain provides.
 */
export function TestResolutionPanel({ instrument, draft, onDraftChange }: TestResolutionPanelProps) {
  const input = useMemo(() => toTestConditionInput(draft), [draft])
  const resolution = useMemo(() => resolveTestCondition(instrument, input), [instrument, input])
  const probes = useMemo(() => boundaryProbes(instrument), [instrument])
  const notes = useMemo(() => resolutionNotes(resolution), [resolution])
  // Rejections of I and I_next as field messages: same rendering as a configuration error, next to
  // the input that holds the offending value.
  const indicationIssues = useMemo(
    () => ({
      I: [indicationIssue(resolution.check_I)].filter((issue) => issue !== null),
      I_next: [indicationIssue(resolution.check_I_next)].filter((issue) => issue !== null),
    }),
    [resolution],
  )

  const { ranges, mpe } = resolution
  const loadResolved = ranges.range_L.status === 'resolved'

  return (
    <div className="diagnostics">
      <Collapsible title="Range Probe" note="Check which partial weighing range applies to a test load">
        <p className="panel-subtitle">
          Resolves the partial weighing range, the applicable verification scale interval and the maximum permissible
          error on initial verification (Table 6) for a test load. No error of indication is calculated and no verdict
          is given in this panel — the digital weighing test evaluates observations.
        </p>

        <SectionHead level={4} category="entered" title="Probe values" note="L is required; I and I_next are optional" />

        <div className="field-grid">
        <div className="field-cell">
          <FieldLabel htmlFor="test-load" symbol="L" text="Test load" title="required — the load applied to the load receptor" />
          <MassField
          id="test-load"
          label="Test load L"
          value={draft.load}
          onChange={(load) => onDraftChange(withTestConditionField(draft, 'load', load))}
          placeholder="2"
        />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor="test-indication" symbol="I" text="Indication" title="optional — the value indicated under the load L" />
          <MassField
          id="test-indication"
          label="Indication I"
          value={draft.indication}
          issues={indicationIssues.I}
          onChange={(indication) => onDraftChange(withTestConditionField(draft, 'indication', indication))}
          placeholder="2000"
        />
        </div>

        <div className="field-cell">
          <FieldLabel
            htmlFor="test-next-indication"
            symbol="I_next"
            text="Next indication"
            title="optional — the indication observed on the other side of a range changeover, (I + e)"
          />
          <MassField
          id="test-next-indication"
          label="Next indication I_next"
          value={draft.nextIndication}
          issues={indicationIssues.I_next}
          onChange={(nextIndication) => onDraftChange(withTestConditionField(draft, 'nextIndication', nextIndication))}
          placeholder="2002"
        />
        </div>
      </div>

        <SectionHead
          level={4}
          category="resolved"
          title="Resolution"
          note="e is taken from the resolved partial weighing range (§3.3.3) — there is no instrument-wide e."
        />

        <table className="model-table resolution-table">
          <caption>
            Chain applied to the test load: L → partial weighing range of L → e of that range → m = L / e → Table 6
            bracket → absolute mpe.
          </caption>
          <tbody>
            {/* Read the two sides apart: the load side decides the limit, the indication side
                decides e*. Collapsing them into one "e" is exactly what this panel must not do. */}
            <tr className="resolution-group">
              <td colSpan={2}>LOAD SIDE — range_L, e_L, m and the mpe</td>
            </tr>
            <Row label="Test load L">
              {input.loadGrams === null ? 'not entered' : formatMass(input.loadGrams)}
              {input.loadGrams === null ? (
                <span className="resolution-flag">required</span>
              ) : null}
            </Row>

            <Row label="Partial weighing range of L">
              <span className={loadResolved ? undefined : 'resolution-unresolved'}>{rangeLabel(ranges.range_L)}</span>
            </Row>

            <Row label="Applicable verification scale interval">
              <span className={loadResolved ? undefined : 'resolution-unresolved'}>
                {applicableIntervalLabel(ranges.range_L)}
              </span>
            </Row>

            <Row label="m = L / e">{intervalCountLabel(mpe, ranges.range_L)}</Row>

            <Row label={`Table 6 bracket — class ${instrument.accuracyClass}, initial verification`}>
              {bracketLabel(mpe)}
            </Row>

            <Row label="Maximum permissible error" emphasis>
              <span className={mpe.status === 'resolved' ? 'resolution-mpe' : 'resolution-unresolved'}>
                {mpeLabel(mpe, ranges.range_L)}
              </span>
            </Row>

            <tr className="resolution-group">
              <td colSpan={2}>INDICATION SIDE — range_I, range_I_next and e*</td>
            </tr>
            <Row label="Indication I">
              {rangeLabel(ranges.range_I)}
              {ranges.range_I.status === 'resolved' ? (
                <span className="resolution-interval">{applicableIntervalLabel(ranges.range_I)}</span>
              ) : null}
              <span className={resolution.check_I.accepted ? 'resolution-qualifier' : 'resolution-unresolved'}>
                {consistencyLabel(resolution.check_I)}
              </span>
            </Row>

            <Row label="Next indication I_next">
              {rangeLabel(ranges.range_I_next)}
              {ranges.range_I_next.status === 'resolved' ? (
                <span className="resolution-interval">{applicableIntervalLabel(ranges.range_I_next)}</span>
              ) : null}
              <span className={resolution.check_I_next.accepted ? 'resolution-qualifier' : 'resolution-unresolved'}>
                {consistencyLabel(resolution.check_I_next)}
              </span>
            </Row>

            <Row label="e_L and e*" emphasis>
              e_L = {ranges.e_L === null ? 'not resolved' : formatMass(ranges.e_L)}
              <span className="resolution-interval">
                e* = {ranges.e_star === null ? 'not resolved' : formatMass(ranges.e_star)}
              </span>
              <span className="resolution-qualifier">
                {eStarStatement(
                  ranges.range_I_next.range?.rangeNumber ?? null,
                  ranges.range_I_next.range?.rangeNumber !== null &&
                    ranges.range_I_next.range?.rangeNumber === ranges.range_L.range?.rangeNumber,
                  ranges.e_star !== null,
                )}
              </span>
            </Row>
          </tbody>
        </table>

        <p className="model-note">
          {formatRuleReference(mpe.sourceReference)}
          {ruleStatusLabel(mpe.sourceReference) ? ` · ${ruleStatusLabel(mpe.sourceReference)}` : ''} · range membership
          per {formatRuleReference(ranges.range_L.sourceReference)}
        </p>

        {notes.length > 0 ? (
          <ul className="resolution-notes">
            {notes.map((note) => (
              <li key={note.slice(0, 48)} className="resolution-note">
                {note}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="model-note">
          Instrument under test: Min = {formatMass(instrument.minCapacityGrams)} · Max = Max
          {subscript(instrument.rangeCount)} = {formatMass(instrument.maxCapacityGrams)} · d = e₁ ={' '}
          {formatMass(instrument.displayDivisionGrams)} · accuracy class {instrument.accuracyClass} ·{' '}
          {formatCount(instrument.rangeCount)} partial weighing range
          {instrument.rangeCount === 1 ? '' : 's'} · {instrument.instrumentType} instrument. Limits shown are for
          initial verification; the mpe in service (§3.5.2) is not implemented in this build.
        </p>
      </Collapsible>

      <Collapsible
        title="Range Boundaries"
        note={`${formatCount(probes.length)} boundaries · ${formatCount(probes.length * 3)} probe loads, resolved just below, exactly at and just above`}
      >
        <BoundaryProbeTable probes={probes} draft={draft} onDraftChange={onDraftChange} />
      </Collapsible>
    </div>
  )
}

function Row({
  label,
  emphasis = false,
  children,
}: {
  label: string
  emphasis?: boolean
  children: ReactNode
}) {
  return (
    <tr className={emphasis ? 'resolution-row-strong' : undefined}>
      <th scope="row">{label}</th>
      <td className="resolution-value">{children}</td>
    </tr>
  )
}

/** One sentence stating what e* is and where it came from — or why it is withheld. */
function eStarStatement(
  nextRangeNumber: number | null,
  sameRangeAsLoad: boolean,
  eStarDefined: boolean,
): string {
  if (nextRangeNumber === null) {
    return 'e* is not resolved: I_next did not fall inside a partial weighing range, so no verification scale interval applies to it.'
  }
  if (!eStarDefined) {
    return (
      `e* is withheld: I_next falls in partial weighing range ${nextRangeNumber} but was rejected as an indication of ` +
      `that range, so no interval is taken from it (see the message at the field).`
    )
  }
  return sameRangeAsLoad
    ? `e* = e${subscript(nextRangeNumber)}, resolved from I_next alone — equal to e_L only because both quantities fall in the same partial weighing range.`
    : `e* = e${subscript(nextRangeNumber)}, resolved from I_next alone; it differs from e_L because I_next falls in another partial weighing range.`
}
