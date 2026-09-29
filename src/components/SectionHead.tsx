import type { ReactNode } from 'react'

/**
 * The four kinds of information the interface distinguishes (§10 of the design brief):
 *
 * - `entered` — what the test engineer typed;
 * - `resolved` — what NIYAM determined from the configuration and the range rules;
 * - `calculated` — what NIYAM derived arithmetically from the entered values;
 * - `verdict` — the outcome of comparing the two.
 *
 * The category is printed as a small kicker above the section title and colours the section's left
 * edge, so a reader can tell at a glance whether a number on screen was typed, looked up in a range
 * table, or computed — which is the distinction the whole evaluation depends on.
 */
export type InformationCategory = 'entered' | 'resolved' | 'calculated' | 'verdict'

const CATEGORY_LABELS: Record<InformationCategory, string> = {
  entered: 'Entered',
  resolved: 'Resolved',
  calculated: 'Calculated',
  verdict: 'Verdict',
}

interface SectionHeadProps {
  /** The section's own name, e.g. `Test observation`. */
  title: string
  category?: InformationCategory
  /** One line beside the title: what the section does, or how complete it is. */
  note?: ReactNode
  /** Heading level of the title — 2 inside a page-level panel, 3 inside a section, 4 inside a group. */
  level?: 2 | 3 | 4
}

/** The heading row of a section: category kicker, title, and the note that orients the reader. */
export function SectionHead({ title, category, note, level = 3 }: SectionHeadProps) {
  const kicker = category ? <span className="section-kicker">{CATEGORY_LABELS[category]}</span> : null
  const titleClass = 'section-title'
  const headClass = category ? `section-head category-${category}` : 'section-head'

  return (
    <div className={headClass}>
      {level === 2 ? (
        <h2 className={titleClass}>
          {kicker}
          {category ? ' ' : null}
          {title}
        </h2>
      ) : level === 4 ? (
        <h4 className={titleClass}>
          {kicker}
          {category ? ' ' : null}
          {title}
        </h4>
      ) : (
        <h3 className={titleClass}>
          {kicker}
          {category ? ' ' : null}
          {title}
        </h3>
      )}
      {note ? <span className="actions-note">{note}</span> : null}
    </div>
  )
}
