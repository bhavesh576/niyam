import { Fragment } from 'react'
import type { ReportTestPoint, WeighingReport } from '../domain/report/types'
import { formatCount } from '../utils/text'
import { StatusBanner } from './StatusBanner'

interface ResultSummaryProps {
  report: WeighingReport
}

/**
 * The result view: the verdict, then the record in four groups — and nothing else.
 *
 * Instrument · Observation · Resolved · Compliance. Every value is read from the report model, which
 * read it from the evaluation result; this component decides only how the groups are laid out, and it
 * uses the same status banner the test screen and the printed document use, so PASS is PASS in all
 * three places.
 *
 * What is deliberately *not* here: the ten-step trace, the substituted formulae, the range chains and
 * the range-aware notes. Those explain **how** the observation was evaluated, and they are on the test
 * screen and in the document; this screen answers **what the result is**. The verdict is one of two
 * words — there is no third state, no confidence and no qualification, because R-76 gives the limit
 * and the comparison either satisfies it or it does not.
 */
export function ResultSummary({ report }: ResultSummaryProps) {
  const { instrument, result } = report
  const passed = result.verdict === 'PASS'

  return (
    <div className="section result-record">
      {/* The counts are a sentence, so they take the second line of the banner (`metaLine`): the
          verdict and its comparison stay one horizontal line above them, and the banner stays one
          48 px block instead of a column of single words. */}
      <StatusBanner
        tone={passed ? 'pass' : 'fail'}
        verdict
        mark={passed ? '✓' : '✕'}
        word={result.verdict}
        statement={result.statement}
        metaLine
        meta={
          <span className="status-counts">
            {report.test.testType} · {report.test.evaluationType} ·{' '}
            {result.testPointCount === 1 ? 'one test point' : `${formatCount(result.testPointCount)} test points`} ·{' '}
            {formatCount(result.passedCount)} passed · {formatCount(result.failedCount)} failed
          </span>
        }
      />

      <div className="detail-grid">
        <div className="detail-column category-entered">
          <p className="detail-kicker">Entered</p>
          <h4 className="detail-heading">Instrument</h4>
          {/* No identification line here: the configuration is spelled out by the rows below it,
              and the one-line identifier is the document's header, where it belongs. */}
          <dl className="detail-list">
            <dt>Class and type</dt>
            <dd>{instrument.classAndTypeText}</dd>
            <dt>Capacities</dt>
            <dd>{instrument.capacitiesText}</dd>
            <dt>Display division</dt>
            <dd>{instrument.displayDivisionText}</dd>
            {instrument.ranges.map((range) => (
              <Fragment key={range.rangeNumber}>
                <dt>Range {range.rangeNumber}</dt>
                <dd>
                  {range.lowerBoundText} → {range.upperBoundText}, {range.intervalText}, {range.intervalsText}
                </dd>
              </Fragment>
            ))}
          </dl>
        </div>

        {report.testPoints.map((point) => (
          <Fragment key={point.label}>
            <ObservationColumn point={point} />
            <ResolvedColumn point={point} />
            <ComplianceColumn point={point} />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function ObservationColumn({ point }: { point: ReportTestPoint }) {
  return (
    <div className="detail-column category-entered">
      <p className="detail-kicker">Entered · {point.label}</p>
      <h4 className="detail-heading">Observation</h4>
      <dl className="detail-list">
        <dt>L — test load</dt>
        <dd>{point.observation.load.text}</dd>
        <dt>I — indication</dt>
        <dd>{point.observation.indication.text}</dd>
        <dt>ΔL — additional load</dt>
        <dd>{point.observation.additionalLoad.text}</dd>
        <dt>I_next — indication (I + e)</dt>
        <dd>{point.observation.nextIndication.text}</dd>
        <dt>E₀ — zero error</dt>
        <dd>{point.observation.zeroError.text}</dd>
      </dl>
    </div>
  )
}

function ResolvedColumn({ point }: { point: ReportTestPoint }) {
  return (
    <div className="detail-column category-resolved">
      {/* No kicker here: the group is already named for the category it belongs to. */}
      <h4 className="detail-heading">Resolved</h4>
      <dl className="detail-list">
        <dt>range_L</dt>
        <dd>{point.context.loadRange.text}</dd>
        <dt>range_I</dt>
        <dd>{point.context.indicationRange.text}</dd>
        <dt>range_I_next</dt>
        <dd>{point.context.nextIndicationRange.text}</dd>
        <dt>e_L</dt>
        <dd>{point.context.loadInterval.text}</dd>
        <dt>e*</dt>
        <dd>{point.context.changeoverInterval.text}</dd>
        <dt>I displayable</dt>
        <dd>{point.context.indicationConsistency}</dd>
        <dt>I_next displayable</dt>
        <dd>{point.context.nextIndicationConsistency}</dd>
      </dl>
    </div>
  )
}

function ComplianceColumn({ point }: { point: ReportTestPoint }) {
  return (
    <div className="detail-column category-verdict">
      <p className="detail-kicker">Calculated · verdict</p>
      <h4 className="detail-heading">Compliance</h4>
      <dl className="detail-list">
        <dt>m = L / e_L</dt>
        <dd>{point.compliance.intervalCountText}</dd>
        <dt>mpe bracket</dt>
        <dd>{point.compliance.bracketText}</dd>
        <dt>Coefficient</dt>
        <dd>{point.compliance.coefficientText}</dd>
        <dt>mpe</dt>
        <dd>{point.compliance.mpe.text}</dd>
        <dt>|Ec|</dt>
        <dd>{point.compliance.absoluteCorrectedError.text}</dd>
        <dt>Margin</dt>
        <dd>{point.compliance.margin.text}</dd>
        {/* The comparison itself is the banner above — it is not repeated as another row. */}
        <dt>Result</dt>
        <dd className={point.compliance.verdict === 'PASS' ? 'is-pass' : 'is-fail'}>{point.compliance.verdict}</dd>
      </dl>
    </div>
  )
}
