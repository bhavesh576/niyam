import type { FieldPath, ValidationIssue, ValidationResult } from '../domain/validation/types'
import { fieldKey } from '../domain/validation/fieldPath'

/** Assertion helpers shared by the validator tests. Not imported by application code. */

export function ruleIds(result: ValidationResult): string[] {
  return result.issues.map((entry) => entry.ruleId)
}

export function issuesWithRule(result: ValidationResult, ruleId: string): ValidationIssue[] {
  return result.issues.filter((entry) => entry.ruleId === ruleId)
}

export function issuesAtField(result: ValidationResult, field: FieldPath): ValidationIssue[] {
  const key = fieldKey(field)
  return result.issues.filter((entry) => entry.field !== null && fieldKey(entry.field) === key)
}

/** Every message the validator produced, joined — used to assert that numbers appear in the text. */
export function messageText(result: ValidationResult): string {
  return result.issues.map((entry) => `${entry.message} ${entry.detail ?? ''}`).join('\n')
}
