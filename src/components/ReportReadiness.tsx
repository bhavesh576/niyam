import type { ReportReadinessCheck } from '../domain/report/types'
import { SectionHead } from './SectionHead'

interface ReportReadinessProps {
  checks: readonly ReportReadinessCheck[]
}

/**
 * The readiness gates of the report, in the order they are checked.
 *
 * Six checks stand between an evaluation and a document: the input data, the configuration, the
 * calculation, the range resolution, the mpe and the result. Each one says what it found, with the
 * values it read them from, and a gate that is not satisfied is shown as a reason — never as a value
 * that was filled in anyway. Display only: the checks themselves were produced by the domain layer.
 */
export function ReportReadiness({ checks }: ReportReadinessProps) {
  const satisfied = checks.filter((check) => check.ok).length
  const open = checks.length - satisfied

  return (
    <div className="section">
      <SectionHead
        title="Report Readiness"
        note={
          open === 0
            ? `${satisfied} / ${checks.length} checks passed · the report can be generated`
            : `${satisfied} / ${checks.length} checks passed · ${open} open — no report is generated until all six pass`
        }
      />

      <ul className="readiness" aria-label="Report readiness gates">
        {checks.map((check) => (
          <li key={check.id} className={check.ok ? 'readiness-check satisfied' : 'readiness-check missing'}>
            <span className="readiness-mark" aria-hidden="true">
              {check.ok ? '✓' : '✗'}
            </span>
            <span className="readiness-label">{check.label}</span>
            <span className="readiness-detail">{check.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
