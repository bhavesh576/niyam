import type { NormalizedInstrument } from '../domain/models/normalizedInstrument'
import { fieldLabel } from '../domain/validation/fieldPath'
import type { ValidationIssue, ValidationResult } from '../domain/validation/types'
import { formatRuleReference, ruleStatusLabel } from '../utils/reference'
import { formatCount } from '../utils/text'
import { ClauseTag } from './ClauseTag'
import { NormalizedRangeTable } from './NormalizedRangeTable'
import { SectionHead } from './SectionHead'
import { StatusBanner } from './StatusBanner'
import { revealField } from './fieldElementId'

interface ValidationResultPanelProps {
  result: ValidationResult
  /** Normalized range model; available when the configuration is complete. */
  instrument: NormalizedInstrument | null
}

/**
 * Result of a validation run: the verdict, the exact reason for every problem beside the field it
 * belongs to, and — when the configuration is valid — the normalized range model derived from it.
 *
 * The banner is the same component the test and result screens use for a verdict, so "valid" and
 * "PASS" are recognisably the same kind of statement, and "invalid" and "FAIL" likewise.
 */
export function ValidationResultPanel({ result, instrument }: ValidationResultPanelProps) {
  return (
    <section className="pane-block" aria-live="polite">
      {/* One line: the word and the counts. The clauses the values were checked against are named by
          the action row of the form, and every problem is listed below — none is summarised away. */}
      <StatusBanner
        tone={result.valid ? 'pass' : 'fail'}
        word={result.valid ? 'Configuration valid' : 'Configuration invalid'}
        heading={2}
        mark={result.valid ? '✓' : '✕'}
        meta={
          <span className="status-counts">
            {formatCount(result.errors.length)} {result.errors.length === 1 ? 'error' : 'errors'} ·{' '}
            {formatCount(result.warnings.length)} {result.warnings.length === 1 ? 'warning' : 'warnings'}
          </span>
        }
      />

      {result.errors.length > 0 ? <IssueGroup title="Errors" issues={result.errors} /> : null}

      {result.warnings.length > 0 ? (
        <IssueGroup title="Warnings — do not invalidate the configuration" issues={result.warnings} />
      ) : null}

      {result.valid && instrument ? <NormalizedRangeTable instrument={instrument} /> : null}

      {result.valid && !instrument ? (
        <p className="model-note">The normalized range model is unavailable while the configuration is incomplete.</p>
      ) : null}
    </section>
  )
}

function IssueGroup({ title, issues }: { title: string; issues: readonly ValidationIssue[] }) {
  return (
    <div className="section">
      <SectionHead title={title} level={3} note={`${formatCount(issues.length)} listed`} />

      <ul className="issue-list">
        <li className="issue-row issue-head" aria-hidden="true">
          <span>Field</span>
          <span>Issue</span>
          <span>Clause</span>
          <span />
        </li>
        {issues.map((issue, index) => (
          <IssueRow key={`${issue.ruleId}-${index}`} issue={issue} />
        ))}
      </ul>
    </div>
  )
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const statusLabel = ruleStatusLabel(issue.reference)
  // Held in a const so the narrowing survives into the click handler.
  const field = issue.field

  return (
    <li className={`issue-row ${issue.severity}`}>
      <span className="issue-field">{field ? fieldLabel(field) : 'Configuration'}</span>

      <div className="issue-body">
        <p className="issue-message">{issue.message}</p>
        {issue.detail ? <p className="issue-detail">{issue.detail}</p> : null}
      </div>

      <span className="issue-clause">
        <ClauseTag>{formatRuleReference(issue.reference)}</ClauseTag>
        {statusLabel ? <span className="issue-status">{statusLabel}</span> : null}
      </span>

      {field ? (
        <button
          type="button"
          className="button button-quiet goto-field"
          aria-label={`Go to the field: ${fieldLabel(field)}`}
          onClick={() => revealField(field)}
        >
          → field
        </button>
      ) : (
        <span className="goto-field-spacer" />
      )}
    </li>
  )
}
