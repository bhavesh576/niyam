import type { ReactNode } from 'react'
import type { MassDraft } from '../domain/models/draft'
import { convertMassDraftUnit } from '../domain/models/draft'
import type { MassUnit } from '../utils/mass'
import { MASS_UNITS } from '../utils/mass'
import type { ValidationIssue } from '../domain/validation/types'
import { IssueMessages } from './IssueMessages'
import { issueElementIds } from './issueElementIds'

interface MassFieldProps {
  /** DOM id of the input; also the prefix of the ids of its messages. */
  id: string
  /** Accessible name. Used as the visible label unless `compact` is set. */
  label: string
  value: MassDraft
  issues?: readonly ValidationIssue[]
  onChange: (next: MassDraft) => void
  placeholder?: string
  /** Secondary line under the visible label, e.g. the clause that defines the quantity. */
  hint?: ReactNode
  /** Compact rendering for table cells: no visible label, right-aligned number. */
  compact?: boolean
}

/**
 * A mass entry: number + unit selector.
 *
 * The field owns no domain knowledge — it holds text and a display unit and hands both back to
 * the page, which converts the whole draft into grams through `toInstrumentConfig`.
 */
export function MassField({
  id,
  label,
  value,
  issues = [],
  onChange,
  placeholder,
  hint,
  compact = false,
}: MassFieldProps) {
  const hasError = issues.some((issue) => issue.severity === 'error')
  const describedBy = issueElementIds(issues, id)

  const input = (
    <input
      id={id}
      className="control-input"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      value={value.raw}
      // In compact mode the row has no <label> element, so the input carries its own name.
      aria-label={compact ? label : undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={describedBy}
      onChange={(event) => onChange({ ...value, raw: event.target.value })}
    />
  )

  const unitSelect = (
    <select
      className="control-unit"
      aria-label={`Unit for ${label}`}
      value={value.unit}
      onChange={(event) => onChange(convertMassDraftUnit(value, event.target.value as MassUnit))}
    >
      {MASS_UNITS.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </select>
  )

  return (
    <div className="field-control">
      <div className="control-row">
        {input}
        {unitSelect}
      </div>
      <IssueMessages issues={issues} idPrefix={id} />
      {!compact && hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

/**
 * Label block: 12 px, one line, symbol first.
 *
 * `hint` prints a second line under the label — used only where a field genuinely needs one. `title`
 * carries the same wording as a tooltip, for compact grids where a paragraph under every field would
 * push the work off the first screen.
 */
export function FieldLabel({
  htmlFor,
  symbol,
  text,
  hint,
  title,
}: {
  htmlFor: string
  symbol?: string
  text: string
  hint?: string
  title?: string
}) {
  return (
    <label className="field-label" htmlFor={htmlFor} title={title}>
      {symbol ? <span className="symbol">{symbol}</span> : null}
      {symbol ? ' — ' : null}
      {text}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}
