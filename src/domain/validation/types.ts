/**
 * Validation result model.
 *
 * The validator is pure domain logic: it takes an {@link InstrumentConfig} and returns
 * structured, field-addressed results. It never touches React state and never formats UI.
 */

export type ValidationSeverity = 'error' | 'warning'

/**
 * Provenance of a rule.
 *
 * `verified`   — the numeric requirement was read directly out of OIML R 76-1:2006; the clause
 *                and the quoted text are carried in {@link RuleReference} and mirrored in
 *                `docs/r76-verified-extracts.md`.
 * `derived`    — obtained by combining two verified clauses (the combination is documented).
 * `structural` — internal consistency of the configuration. NOT an R-76 numeric requirement and
 *                never presented as one.
 * `scope`      — a limitation of this implementation phase, not a requirement of R-76.
 */
export type RuleStatus = 'verified' | 'derived' | 'structural' | 'scope'

export interface RuleReference {
  /** Source document, e.g. `OIML R 76-1:2006 (E)`. */
  document: string
  /** Clauses / tables the rule comes from, e.g. `['3.3.2', 'Table 3']`. */
  clauses: string[]
  /** Verbatim quote supporting the rule (kept short). Optional for structural/scope rules. */
  quote?: string
  status: RuleStatus
}

/**
 * Address of the configuration field a message belongs to, so the UI can render it beside the
 * affected input instead of in a generic list.
 *
 * `index` is the 0-based position in `InstrumentConfig.ranges`; the UI shows it as `index + 1`.
 */
export type FieldPath =
  | { kind: 'instrument'; prop: InstrumentFieldProp }
  | { kind: 'range'; index: number; prop: RangeFieldProp }

export type InstrumentFieldProp =
  | 'instrumentType'
  | 'accuracyClass'
  | 'minCapacityGrams'
  | 'displayDivisionGrams'
  | 'ranges'

export type RangeFieldProp = 'maxCapacityGrams' | 'verificationIntervalGrams'

export interface ValidationIssue {
  /** Stable rule identifier, e.g. `r76.table4.partial-range-ratio`. */
  ruleId: string
  severity: ValidationSeverity
  /** Field the message must be displayed next to, or `null` for configuration-wide messages. */
  field: FieldPath | null
  /** Short technical statement of the problem, with the actual numbers. */
  message: string
  /** Optional longer explanation (formula, worked example, consequence). */
  detail?: string
  reference: RuleReference
  /** Values involved, for tests and for later phases (report generation). */
  context?: Record<string, number | string | boolean | null>
}

export interface ValidationResult {
  /** `true` when there are no errors. Warnings alone do not invalidate the configuration. */
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  /** errors followed by warnings — the full ordered issue list. */
  issues: ValidationIssue[]
}
