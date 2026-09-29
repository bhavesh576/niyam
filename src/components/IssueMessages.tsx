import type { ValidationIssue } from '../domain/validation/types'
import { formatRuleReference, ruleStatusLabel } from '../utils/reference'

interface IssueMessagesProps {
  issues: readonly ValidationIssue[]
  /** Prefix used to build stable DOM ids so inputs can point at their messages (aria-describedby). */
  idPrefix: string
}

/**
 * Renders validation issues as text next to the field they belong to.
 * No message is generic: each one is the technical statement produced by the domain validator,
 * followed by its detail and by the clause it comes from.
 */
export function IssueMessages({ issues, idPrefix }: IssueMessagesProps) {
  if (issues.length === 0) return null

  return (
    <ul className="field-issues">
      {issues.map((issue, index) => {
        const statusLabel = ruleStatusLabel(issue.reference)
        return (
          <li
            key={`${issue.ruleId}-${index}`}
            id={`${idPrefix}-issue-${index}`}
            className={`field-issue ${issue.severity}`}
          >
            <span className="issue-message">{issue.message}</span>
            {issue.detail ? <span className="issue-detail">{issue.detail}</span> : null}
            <span className="issue-source">
              {formatRuleReference(issue.reference)}
              {statusLabel ? ` · ${statusLabel}` : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
