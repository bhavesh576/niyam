import type { ValidationIssue } from '../domain/validation/types'

/**
 * DOM ids of the messages rendered for one field, so the input can reference them through
 * `aria-describedby`. Kept out of the component file so that file exports components only
 * (fast-refresh requirement).
 */
export function issueElementIds(issues: readonly ValidationIssue[], idPrefix: string): string | undefined {
  if (issues.length === 0) return undefined
  return issues.map((_issue, index) => `${idPrefix}-issue-${index}`).join(' ')
}
