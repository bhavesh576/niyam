import type { ReactNode } from 'react'

interface ClauseTagProps {
  children: ReactNode
}

/**
 * A clause reference rendered as a tag: `A.4.4.3`, `Table 6`, `§3.3.3`, or the full citation the
 * domain layer produced.
 *
 * Presentational only — the text inside is always the string the domain gave, never a shortened or
 * prettified version of it, so a clause on screen can be looked up in the Recommendation as written.
 */
export function ClauseTag({ children }: ClauseTagProps) {
  return <span className="clause-tag">{children}</span>
}
