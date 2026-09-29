import type { FieldPath, InstrumentFieldProp, RangeFieldProp, ValidationIssue } from './types'

/**
 * Field path helpers — the bridge between domain validation results and form inputs.
 */

export function instrumentField(prop: InstrumentFieldProp): FieldPath {
  return { kind: 'instrument', prop }
}

export function rangeField(index: number, prop: RangeFieldProp): FieldPath {
  return { kind: 'range', index, prop }
}

/** Stable string key for a field path, used as a React map key and for issue lookup. */
export function fieldKey(field: FieldPath): string {
  return field.kind === 'instrument'
    ? `instrument.${field.prop}`
    : `range.${field.index}.${field.prop}`
}

/** All issues addressed to one field, errors first. */
export function issuesForField(issues: readonly ValidationIssue[], field: FieldPath | null): ValidationIssue[] {
  if (field === null) return []
  const key = fieldKey(field)
  return issues
    .filter((issue) => issue.field !== null && fieldKey(issue.field) === key)
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

/** Configuration-wide issues (not attached to a single field). */
export function globalIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.field === null)
}

function severityRank(severity: ValidationIssue['severity']): number {
  return severity === 'error' ? 0 : 1
}

/** Human readable label of a field path, e.g. `Range 2 — e`. */
export function fieldLabel(field: FieldPath): string {
  if (field.kind === 'instrument') {
    switch (field.prop) {
      case 'instrumentType':
        return 'Instrument type'
      case 'accuracyClass':
        return 'Accuracy class'
      case 'minCapacityGrams':
        return 'Minimum capacity (Min)'
      case 'displayDivisionGrams':
        return 'Display division (d)'
      case 'ranges':
        return 'Partial weighing ranges'
    }
  }
  return `Range ${field.index + 1} — ${field.prop === 'maxCapacityGrams' ? 'Max' : 'e'}`
}
