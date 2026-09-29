import { useMemo, useState } from 'react'
import { buildWeighingReport } from '../domain/report/buildReport'
import type { NormalizedInstrument } from '../domain/models/normalizedInstrument'
import type { PerformedEvaluation } from '../domain/evaluation/types'
import type { WeighingReport } from '../domain/report/types'
import { ReportDocument } from './ReportDocument'
import { ReportReadiness } from './ReportReadiness'
import { ResultSummary } from './ResultSummary'
import { ResultTable } from './ResultTable'
import { StatusBanner } from './StatusBanner'

interface TestResultPanelProps {
  instrument: NormalizedInstrument | null
  evaluation: PerformedEvaluation | null
  onOpenTest: () => void
  onOpenConfiguration: () => void
}

/**
 * The third work area: what the final result is, and the report made from it.
 *
 * One calculation, one mapping, three renderings. The panel builds the report model from the
 * instrument and the evaluation it is given — `buildWeighingReport` is a mapping of the evaluation
 * result, so the result view, the result table and the printed document all show the same numbers,
 * and none of them can drift from the calculation because none of them calculates.
 *
 * The screen answers *what the result is*: the verdict in the same banner the test screen uses, the
 * record in four groups, the canonical result table, the six readiness gates and the document. How
 * the result was reached — the ten-step trace, the substituted formulae, the range chains and the
 * range-aware notes — stays on the test screen and in the document, and is not repeated here.
 *
 * The model is built whether or not it is complete: an incomplete evaluation produces the six
 * readiness gates with their reasons and no report at all. Once all six gates are satisfied the
 * document exists, so the pane on the right shows it — the same model the screen is reading, built
 * by the same call. `Generate report` is then the stamp: it rebuilds the document with the time it
 * was generated and unlocks printing. The values are rebuilt from the same result object either way,
 * so the document cannot contain anything the screen did not already show.
 */
export function TestResultPanel({ instrument, evaluation, onOpenTest, onOpenConfiguration }: TestResultPanelProps) {
  // Stamp of the model behind the result view: taken once, so re-rendering does not move the clock.
  const [openedAt] = useState(() => new Date())
  // The generated document, kept together with the evaluation it was generated from.
  const [generated, setGenerated] = useState<{ evaluation: PerformedEvaluation; report: WeighingReport } | null>(null)

  const outcome = useMemo(
    () => buildWeighingReport({ instrument, evaluation, generatedAt: openedAt }),
    [instrument, evaluation, openedAt],
  )

  // A document belongs to the evaluation it was generated from. Editing the instrument or the
  // observation produces a different evaluation object, and the document is dropped with it.
  const report =
    generated !== null && generated.evaluation === evaluation && generated.evaluation.instrument === instrument
      ? generated.report
      : null

  function handleGenerate() {
    const stamped = buildWeighingReport({ instrument, evaluation, generatedAt: new Date() })
    if (stamped.status !== 'ready' || evaluation === null) {
      setGenerated(null)
      return
    }
    setGenerated({ evaluation, report: stamped.report })
  }

  function handlePrint() {
    // The browser's own print dialog: “Save as PDF” there is the PDF. Nothing is generated here.
    if (typeof window.print === 'function') window.print()
  }

  const ready = outcome.status === 'ready'

  /* What the right pane shows: the stamped document where one has been generated, otherwise — as
     soon as the six gates are satisfied — the document built from the same outcome the result view
     and the result table are reading. There is no third rendering and no placeholder to click past:
     a PASS on the left and an empty sheet on the right would be two different answers to one
     question. Where the gates are not satisfied there is no document at all, and the pane says why. */
  const document = report ?? (ready ? outcome.report : null)

  /* Two panes, and the split is the whole point of this screen: the result and its gates on the left,
     the document on the right. Neither grows the other, so `Generate report` never moves the verdict
     off the screen, and what is on the right is what prints.

     What is deliberately *not* here: the ten-step trace, the substituted-formula table, the range
     essays and the range-aware notes. Those explain how the observation was evaluated and they live on
     the test screen and in the document; this screen answers what the result is. */
  return (
    <div className="split split-result" role="region" aria-label="Test Result and Report">
      <section className="pane pane-result-main">
        <div className="pane-body screen-only">
          {ready ? (
            <>
              {/* The verdict banner is the same component the test screen uses: PASS is PASS in one
                  shape, in one place, and it is the first thing on this screen. */}
              <ResultSummary report={outcome.report} />
              <ResultTable report={outcome.report} />
            </>
          ) : (
            <StatusBanner
              tone="warn"
              heading={3}
              announced
              mark="!"
              word={outcome.headline}
              statement={outcome.summary}
            >
              {outcome.reasons.length > 0 ? (
                <ul className="not-ready-reasons">
                  {outcome.reasons.map((reason) => (
                    <li key={reason} className="not-ready-reason">
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="model-note">
                No partially populated report is produced: every value a report prints has to come from a completed
                calculation of the observation.
              </p>
              <div className="banner-actions">
                {instrument === null ? (
                  <button type="button" className="button button-primary" onClick={onOpenConfiguration}>
                    Open the instrument configuration
                  </button>
                ) : null}
                <button type="button" className="button button-secondary" onClick={onOpenTest}>
                  Open the digital weighing test
                </button>
              </div>
            </StatusBanner>
          )}

          <ReportReadiness checks={outcome.checks} />
        </div>

        <div className="pane-actions screen-only">
          {/* The one action this screen exists for, so it is the hero button: 36 px, never narrower
              than 120 px, and disabled until all six gates are satisfied. */}
          <button
            type="button"
            className="button button-primary button-hero"
            onClick={handleGenerate}
            disabled={!ready}
          >
            Generate report
          </button>
          {report !== null ? (
            <button type="button" className="button button-secondary" onClick={handlePrint}>
              Print / save as PDF
            </button>
          ) : null}
          <span className="action-note">
            Generated only when all six gates are satisfied · printing sends this document alone to the browser’s print
            dialog, where “Save as PDF” produces the PDF.
          </span>
        </div>
      </section>

      <aside className="pane pane-paper">
        {document !== null ? (
          /* The document, on screen, before it is printed. */
          <>
            {report === null ? (
              <p className="paper-caption screen-only">
                Preview of the document · Generate report stamps the time it was generated and enables printing.
              </p>
            ) : null}
            <ReportDocument report={document} />
          </>
        ) : (
          /* An empty sheet, not a message styled like a document: the pane keeps its size, so nothing
             on the left moves when the report appears. Not an <article> — there is no document yet. */
          <div className="paper paper-empty">
            <p className="paper-empty-line">Report appears here when all six gates are satisfied.</p>
          </div>
        )}
      </aside>
    </div>
  )
}
