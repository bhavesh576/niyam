import { traceSummary } from '../domain/evaluation/describe'
import { REPORT_SECTIONS } from '../domain/report/content'
import type { ReportTestPoint, WeighingReport } from '../domain/report/types'
import { formatCount } from '../utils/text'
import { CalculationTable } from './CalculationTable'
import { CalculationTrace } from './CalculationTrace'
import { ResultTable } from './ResultTable'

interface ReportDocumentProps {
  report: WeighingReport
}

/**
 * The report document: an A4 technical record in six sections, printed from the report model and from
 * nothing else.
 *
 * A Instrument identification · B Test observation · C Resolved metrological context · D Calculation ·
 * E Compliance · F Technical reference. The order is the order the evaluation itself runs in, so the
 * document can be read from the top without referring back to the screen.
 *
 * This component holds no arithmetic and no wording of its own. Every value comes from the model built
 * in `domain/report/buildReport.ts`, which took every value from the result of the evaluation — so what
 * is printed here is what the result view showed, and the two cannot disagree because there is only one
 * place the numbers are produced. The result table and the calculation table are the same components the
 * screens use; the trace is the same ten steps.
 *
 * The whole document is what `@media print` keeps: the application chrome around it is hidden, sections
 * are kept from breaking across pages where a break would separate a heading from its table, and
 * printing this page produces the report and nothing else.
 */
export function ReportDocument({ report }: ReportDocumentProps) {
  const { instrument, test, result } = report
  const multiPoint = report.testPoints.length > 1

  return (
    <article className="report-document report-paper" id="report-document" aria-labelledby="report-document-title">
      <header className="report-head">
        <p className="report-eyebrow">NIYAM · Range-aware R-76 test engine · OIML R 76-1:2006</p>
        <h2 className="report-title" id="report-document-title">
          {report.title}
        </h2>
        <p className="report-kind">{report.documentKind}</p>

        <dl className="report-facts">
          <dt>Instrument</dt>
          <dd>{instrument.identifier}</dd>
          <dt>Accuracy Class</dt>
          <dd>{instrument.accuracyClassText}</dd>
          <dt>Evaluation Type</dt>
          <dd>{test.evaluationType}</dd>
          <dt>Generated</dt>
          <dd>{report.generatedAtText}</dd>
        </dl>

        <p className="report-notice">{report.statusNotice}</p>
      </header>

      <section className="report-section">
        <h3 className="report-section-title">{REPORT_SECTIONS.instrument}</h3>
        <p className="report-note">{instrument.identificationNote}</p>

        <dl className="report-facts">
          <dt>Class and type</dt>
          <dd>{instrument.classAndTypeText}</dd>
          <dt>Capacities</dt>
          <dd>{instrument.capacitiesText}</dd>
          <dt>Display division</dt>
          <dd>{instrument.displayDivisionText}</dd>
          <dt>Partial weighing ranges</dt>
          <dd>{formatCount(instrument.partialRangeCount)}</dd>
        </dl>

        <table className="model-table report-table">
          <caption>Partial weighing ranges of the instrument, with the verification scale interval of each.</caption>
          <thead>
            <tr>
              <th scope="col">Range</th>
              <th scope="col">Minᵢ</th>
              <th scope="col">Maxᵢ</th>
              <th scope="col">eᵢ</th>
              <th scope="col">nᵢ</th>
            </tr>
          </thead>
          <tbody>
            {instrument.ranges.map((range) => (
              <tr key={range.rangeNumber}>
                <th scope="row">Range {range.rangeNumber}</th>
                <td className="numeric">{range.lowerBoundText}</td>
                <td className="numeric">{range.upperBoundText}</td>
                <td className="numeric">{range.intervalText}</td>
                <td className="numeric">{range.intervalsText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h3 className="report-section-title">{REPORT_SECTIONS.observation}</h3>

        <dl className="report-facts">
          <dt>Test performed</dt>
          <dd>{test.testType}</dd>
          <dt>Evaluation type</dt>
          <dd>{test.evaluationType}</dd>
          <dt>Indication mode</dt>
          <dd>{test.indicationMode}</dd>
          <dt>Test condition</dt>
          <dd>{test.testCondition}</dd>
          <dt>Observation</dt>
          <dd className="numeric">{test.observationText}</dd>
          <dt>Zero error E₀</dt>
          <dd>{test.zeroErrorProvenance}</dd>
          <dt>Test points reported</dt>
          <dd>{formatCount(test.testPointCount)}</dd>
        </dl>

        {test.changeoverText ? <p className="report-note">{test.changeoverText}</p> : null}
      </section>

      <section className="report-section">
        <h3 className="report-section-title">{REPORT_SECTIONS.context}</h3>
        <p className="report-note">
          The partial weighing ranges the observation resolved to, and the two verification scale intervals that follow
          from them: e_L, which the maximum permissible error belongs to, and e*, which the ½ e term of A.4.4.3 belongs
          to. They are resolved separately and are not the same quantity at a changeover.
        </p>

        {report.testPoints.map((point) => (
          <ContextSection key={point.label} point={point} headed={multiPoint} />
        ))}
      </section>

      <section className="report-section">
        <h3 className="report-section-title">{REPORT_SECTIONS.calculation}</h3>
        <p className="report-note">
          The four substitution lines of A.4.4.3, then the ten steps the evaluation recorded while producing them — the
          same lines and the same steps the test screen shows.
        </p>

        {report.testPoints.map((point) => (
          <div key={point.label} className="report-trace">
            {multiPoint ? <h4 className="report-subtitle">{point.label}</h4> : null}
            <CalculationTable lines={point.calculation.lines} />
            <p className="report-note">{traceSummary(point.calculation.trace)}</p>
            <CalculationTrace steps={point.calculation.trace} />
          </div>
        ))}
      </section>

      <section className="report-section">
        <h3 className="report-section-title">{REPORT_SECTIONS.compliance}</h3>

        <p className={`verdict ${result.verdict === 'PASS' ? 'verdict-pass' : 'verdict-fail'}`}>
          <span className="verdict-word">{result.verdict}</span>
          <span className="verdict-statement">{result.statement}</span>
        </p>

        {report.testPoints.map((point) => (
          <ComplianceFacts key={point.label} point={point} headed={multiPoint} />
        ))}

        <ResultTable report={report} />

        <dl className="report-facts">
          <dt>Test points</dt>
          <dd>
            {formatCount(result.testPointCount)} reported · {formatCount(result.passedCount)} passed ·{' '}
            {formatCount(result.failedCount)} failed
          </dd>
          <dt>Basis of the result</dt>
          <dd>{result.basis}</dd>
        </dl>

        <h4 className="report-subtitle">What this evaluation does not cover</h4>
        <ul className="resolution-notes">
          {result.scopeLimits.map((limit) => (
            <li key={limit} className="resolution-note">
              {limit}
            </li>
          ))}
        </ul>
      </section>

      <section className="report-section">
        <h3 className="report-section-title">{REPORT_SECTIONS.reference}</h3>
        <p className="report-note">
          Only the clauses this evaluation actually rests on are listed. Nothing is cited that was not applied, and no
          limit, formula or table value has been supplied from anywhere other than these clauses.
        </p>

        <ol className="report-references">
          {report.references.map((reference, index) => (
            <li key={`${reference.citation}-${index}`} className="report-reference">
              <span className="report-reference-citation">{reference.citation}</span>
              {reference.quote ? <span className="report-reference-quote">“{reference.quote}”</span> : null}
              {reference.statusText ? <span className="report-reference-status">{reference.statusText}</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <footer className="report-foot">
        <p>{report.statusNotice}</p>
        <p className="report-foot-meta">
          Generated {report.generatedAtText} · {report.title} · {formatCount(result.testPointCount)} test point
          {result.testPointCount === 1 ? '' : 's'} · result {result.verdict}
        </p>
      </footer>
    </article>
  )
}

/** Section C for one test point: the resolved ranges, the two chains and the range-aware notes. */
function ContextSection({ point, headed }: { point: ReportTestPoint; headed: boolean }) {
  const { context } = point

  return (
    <div className="report-point">
      {headed ? <h4 className="report-subtitle">{point.label}</h4> : null}

      <dl className="report-facts">
        <dt>range_L — resolved range of the load</dt>
        <dd>{context.loadRange.text}</dd>
        <dt>range_I — resolved range of the indication</dt>
        <dd>{context.indicationRange.text}</dd>
        <dt>range_I_next — resolved range of the next indication</dt>
        <dd>{context.nextIndicationRange.text}</dd>
        <dt>e_L — interval of the load’s range</dt>
        <dd>{context.loadInterval.text}</dd>
        <dt>e* — interval of the changeover</dt>
        <dd>{context.changeoverInterval.text}</dd>
        <dt>I displayable in range_I</dt>
        <dd>{context.indicationConsistency}</dd>
        <dt>I_next displayable in range_I_next</dt>
        <dd>{context.nextIndicationConsistency}</dd>
      </dl>

      <dl className="report-facts report-chains">
        <dt>Chain applied to the test load</dt>
        <dd className="numeric">{context.limitChain}</dd>
        <dt>Chain applied to the changeover indication</dt>
        <dd className="numeric">{context.changeoverChain}</dd>
      </dl>

      {context.notes.length > 0 ? (
        <ul className="resolution-notes">
          {context.notes.map((note) => (
            <li key={note.slice(0, 48)} className="resolution-note">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Section E for one test point: the limit, the corrected error and the comparison behind the verdict. */
function ComplianceFacts({ point, headed }: { point: ReportTestPoint; headed: boolean }) {
  const { compliance } = point

  return (
    <div className="report-point">
      {headed ? <h4 className="report-subtitle">{point.label}</h4> : null}

      <dl className="report-facts">
        <dt>m = L / e_L</dt>
        <dd className="numeric">{compliance.intervalCountText}</dd>
        <dt>mpe bracket</dt>
        <dd>{compliance.bracketText}</dd>
        <dt>Coefficient</dt>
        <dd>{compliance.coefficientText}</dd>
        <dt>Maximum permissible error</dt>
        <dd>{compliance.mpeStatement}</dd>
        <dt>|Ec| — corrected error, absolute</dt>
        <dd className="numeric">{compliance.absoluteCorrectedError.text}</dd>
        <dt>Margin</dt>
        <dd className="numeric">{compliance.margin.text}</dd>
        <dt>Comparison</dt>
        <dd>{compliance.comparisonText}</dd>
        <dt>Result</dt>
        <dd className={compliance.verdict === 'PASS' ? 'is-pass' : 'is-fail'}>{compliance.verdict}</dd>
      </dl>
    </div>
  )
}
