import type { Grams } from '../models/instrument'
import type { FieldPath, RuleReference, ValidationIssue, ValidationSeverity } from './types'
import { subscript } from '../../utils/text'

/**
 * Shared helpers for rule implementations: value guards, issue construction and the
 * R-76 symbol names used in messages (Max₁, e₂, n₃, Min).
 */

/** A mass the evaluator can work with: present, finite and strictly positive. */
export function isUsableMass(value: Grams | null | undefined): value is Grams {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export interface IssueInput {
  ruleId: string
  severity: ValidationSeverity
  field: FieldPath | null
  message: string
  detail?: string
  reference: RuleReference
  context?: Record<string, number | string | boolean | null>
}

/** Constructs a validation issue. Explicit factory so no rule can omit its provenance. */
export function issue(input: IssueInput): ValidationIssue {
  return {
    ruleId: input.ruleId,
    severity: input.severity,
    field: input.field,
    message: input.message,
    detail: input.detail,
    reference: input.reference,
    context: input.context,
  }
}

/** `Max₁` for range index 0. */
export function maxSymbol(index: number): string {
  return `Max${subscript(index + 1)}`
}

/** `e₁` for range index 0. */
export function intervalSymbol(index: number): string {
  return `e${subscript(index + 1)}`
}

/** `n₁` for range index 0. */
export function intervalCountSymbol(index: number): string {
  return `n${subscript(index + 1)}`
}

/** `Min₁` for range index 0. */
export function minSymbol(index: number): string {
  return `Min${subscript(index + 1)}`
}

/** "Range 1" for range index 0. */
export function rangeLabel(index: number): string {
  return `Range ${index + 1}`
}
