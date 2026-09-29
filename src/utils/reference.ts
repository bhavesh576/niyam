import type { RuleReference } from '../domain/validation/types'

/**
 * Presentation helpers for rule provenance, shared by the inline field messages and the
 * result panel. Keeping them here means the wording about where a rule comes from is written
 * once and cannot drift between the two places.
 */

/**
 * `OIML R 76-1:2006 (E) — §3.3.3, Table 4`
 *
 * Numbered clauses of the body are cited with `§`; tables, terminology entries (`T.3.2.2`) and the
 * annex (`A.4.4.3`) are cited as printed, because `§A.4.4.3` is not how the Recommendation refers
 * to its own annex.
 */
export function formatRuleReference(reference: RuleReference): string {
  const clauses = reference.clauses.map((clause) =>
    clause.startsWith('Table') || clause.startsWith('T.') || clause.startsWith('A.') ? clause : `§${clause}`,
  )
  return `${reference.document} — ${clauses.join(', ')}`
}

/**
 * Label for rules that are not plain verified R-76 requirements.
 * Returns `null` for `verified`, i.e. nothing extra is shown for a directly quoted clause.
 */
export function ruleStatusLabel(reference: RuleReference): string | null {
  switch (reference.status) {
    case 'verified':
      return null
    case 'derived':
      return 'derived from the clauses above'
    case 'structural':
      return 'configuration consistency check — not an R-76 numeric requirement'
    case 'scope':
      return 'limitation of this build — not an R-76 requirement'
  }
}
