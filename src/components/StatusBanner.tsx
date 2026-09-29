import type { ReactNode } from 'react'

/**
 * The tone of a status banner. Three of them are states of an evaluation, two are states of a
 * configuration, and `neutral` is the plain informational case.
 *
 * `pass` and `fail` are the only tones that may carry a verdict word: R-76 gives the limit and the
 * comparison either satisfies it or it does not, so nothing between the two is ever rendered.
 */
export type StatusTone = 'pass' | 'fail' | 'warn' | 'neutral'

interface StatusBannerProps {
  tone: StatusTone
  /** The word the banner leads with: `PASS`, `FAIL`, `Not evaluated`, `Configuration valid`, … */
  word: string
  /** What the word rests on: the comparison that produced it, or the reason nothing was produced. */
  statement?: string | null
  /** Render the word as a heading of this level, where the banner is the title of its section. */
  heading?: 2 | 3
  /**
   * Announce word + statement as a status region named *Verdict*. Used only for the two legal
   * outcomes, and the announced element then contains exactly those two strings and nothing else,
   * so what a screen reader hears is what the comparison says.
   */
  verdict?: boolean
  /** Announce the whole banner as a status region — where there is no verdict to announce. */
  announced?: boolean
  /** Decorative glyph. Never announced, never part of the status text. */
  mark?: string
  /**
   * Right-hand edge of the banner: counts and gates. Always outside the announced verdict, so a
   * banner with only a word and a count is one 40 px line.
   */
  meta?: ReactNode
  /**
   * Put `meta` on a second line of its own instead of at the right edge. For the one banner whose
   * counts are a full sentence: at the right edge they would take the width and squeeze the verdict
   * into a column of single words. The banner stays one block of two short lines.
   */
  metaLine?: boolean
  /** Under the word: reasons, issue messages, the list of open gates. */
  children?: ReactNode
}

/**
 * One status banner, used for every state the application reports: the verdict of an evaluation on
 * the test screen, the same verdict on the result screen and in the printed document, a blocked
 * evaluation, a report that is not ready, and the result of a configuration validation.
 *
 * The point of sharing it is that PASS looks like PASS wherever it appears — the same component, the
 * same tone colours, the same relationship between the word and the comparison behind it.
 */
export function StatusBanner({
  tone,
  word,
  statement = null,
  heading,
  verdict = false,
  announced = false,
  mark,
  meta,
  metaLine = false,
  children,
}: StatusBannerProps) {
  const wordClass = verdict ? 'status-word verdict-word' : 'status-word'
  const bannerClass = `status-banner tone-${tone}${metaLine ? ' meta-line' : ''}`

  // The two legal outcomes: word and statement, and nothing else, inside the announced region.
  if (verdict) {
    return (
      <div className={bannerClass}>
        {mark ? (
          <span className="status-mark" aria-hidden="true">
            {mark}
          </span>
        ) : null}
        <div className="status-main">
          <p className="status-verdict" role="status" aria-label="Verdict">
            <span className={wordClass}>{word}</span>
            {statement ? <span className="status-statement">{statement}</span> : null}
          </p>
          {children}
        </div>
        {/* Counts sit at the right edge, outside the announced element: a screen reader hears the
            comparison, not the bookkeeping beside it. */}
        {meta ? <div className="status-meta">{meta}</div> : null}
      </div>
    )
  }

  const wordNode =
    heading === 2 ? (
      <h2 className={wordClass}>{word}</h2>
    ) : heading === 3 ? (
      <h3 className={wordClass}>{word}</h3>
    ) : (
      <p className={wordClass}>{word}</p>
    )

  return (
    <div className={bannerClass} role={announced ? 'status' : undefined}>
      {mark ? (
        <span className="status-mark" aria-hidden="true">
          {mark}
        </span>
      ) : null}
      <div className="status-main">
        {wordNode}
        {statement ? <p className="status-statement">{statement}</p> : null}
        {children}
      </div>
      {meta ? <div className="status-meta">{meta}</div> : null}
    </div>
  )
}
