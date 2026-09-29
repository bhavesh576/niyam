import type { ReactNode } from 'react'

interface CollapsibleProps {
  /** What the section is called, e.g. `Calculation Trace`. */
  title: string
  /** One line of orientation beside the title — what is inside, or how much of it is complete. */
  note?: ReactNode
  /** Diagnostic sections start closed; the sections the workflow needs start open. */
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * A disclosure section: the native `details`/`summary` pair, so it is keyboard operable, announced
 * as expandable, and needs no state of its own.
 *
 * Secondary material — the range probe, the boundary table, the calculation trace, the range-aware
 * notes — is kept in the interface but out of the way: one click opens it, and what is inside is
 * exactly what was there before, never a summary of it.
 */
export function Collapsible({ title, note, defaultOpen = false, children }: CollapsibleProps) {
  return (
    <details className="collapsible" open={defaultOpen || undefined}>
      <summary className="collapsible-head">
        <span className="collapsible-caret" aria-hidden="true" />
        <span className="collapsible-title">{title}</span>
        {note ? <span className="collapsible-note">{note}</span> : null}
      </summary>
      <div className="collapsible-body">{children}</div>
    </details>
  )
}
