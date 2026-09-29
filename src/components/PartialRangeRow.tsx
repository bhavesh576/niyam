import type { PartialRangeDraft } from '../domain/models/draft'
import { massDraftToGrams } from '../domain/models/draft'
import { issuesForField, rangeField } from '../domain/validation/fieldPath'
import type { ValidationIssue } from '../domain/validation/types'
import { ratio } from '../utils/mass'
import { formatCount, subscript } from '../utils/text'
import { MassField } from './MassField'

interface PartialRangeRowProps {
  /** 0-based index; displayed as "Range {index + 1}". */
  index: number
  range: PartialRangeDraft
  issues: readonly ValidationIssue[]
  /**
   * Minᵢ of this partial weighing range: `Min` for the first range, Maxᵢ₋₁ for every other. Read
   * from the validated range model when there is one, and from the draft chain while typing, so the
   * column always shows the mass the range starts at.
   */
  lowerBound?: string | null
  /** `true` for the row that carries Max — the last partial weighing range (§3.3.1). */
  isLast?: boolean
  onChange: (next: PartialRangeDraft) => void
  onRemove: () => void
}

/**
 * One row of the partial weighing ranges table: 36 px, six columns.
 *
 * The difference between the columns is the point. **Max** and **e** are entered, so they are inputs
 * with their own unit selectors (kg for the capacities of the R-76 example, g for its intervals).
 * **Min** and **n** are derived, so they are read-only values on a tinted ground and cannot be
 * mistaken for something the tester typed: Minᵢ is `Min` for the first range and Maxᵢ₋₁ for every
 * other, which is what makes the chain Min → Max₁ → Max₂ → Max₃ of a multi-interval instrument
 * visible in the table that edits it, and nᵢ = Maxᵢ / eᵢ is the definition in §3.3.1.
 *
 * No limit is evaluated in this component; that is the validator's job.
 */
export function PartialRangeRow({
  index,
  range,
  issues,
  lowerBound = null,
  isLast = false,
  onChange,
  onRemove,
}: PartialRangeRowProps) {
  const maxField = rangeField(index, 'maxCapacityGrams')
  const intervalField = rangeField(index, 'verificationIntervalGrams')
  const maxIssues = issuesForField(issues, maxField)
  const intervalIssues = issuesForField(issues, intervalField)
  const hasError = [...maxIssues, ...intervalIssues].some((issue) => issue.severity === 'error')
  const intervals = intervalCount(range)
  const number = index + 1

  return (
    <div className={hasError ? 'range-row has-error' : 'range-row'}>
      <div className="range-name">
        Range {number}
        {isLast ? <span className="tag">last</span> : null}
      </div>

      <div
        className="range-derived"
        title={index === 0 ? 'Min₁ = Min (§3.3.1) — derived, not entered' : `Min${subscript(number)} = Max${subscript(index)} (§3.3.1) — derived, not entered`}
      >
        {lowerBound === null ? (
          <span className="derived-empty">not entered</span>
        ) : (
          <span className="derived-value">{lowerBound}</span>
        )}
      </div>

      <MassField
        id={`range-${index}-max`}
        label={`Range ${number} maximum capacity Max${subscript(number)}`}
        compact
        value={range.maxCapacity}
        issues={maxIssues}
        placeholder="0"
        onChange={(maxCapacity) => onChange({ ...range, maxCapacity })}
      />

      <MassField
        id={`range-${index}-e`}
        label={`Range ${number} verification scale interval e${subscript(number)}`}
        compact
        value={range.verificationInterval}
        issues={intervalIssues}
        placeholder="0"
        onChange={(verificationInterval) => onChange({ ...range, verificationInterval })}
      />

      <div
        className="range-derived range-n"
        title={`n${subscript(number)} = Max${subscript(number)} / e${subscript(number)} (§3.3.1) — derived, not entered`}
      >
        {intervals === null ? (
          <span className="derived-empty">—</span>
        ) : (
          <span className="derived-value">
            n{subscript(number)} = {formatCount(intervals)}
          </span>
        )}
      </div>

      {/* Range 1 cannot be removed: a multi-interval instrument has at least one partial range. */}
      {index > 0 ? (
        <button
          type="button"
          className="range-remove"
          onClick={onRemove}
          aria-label={`Remove range ${number}`}
          title={`Remove range ${number}`}
        >
          {'×'}
        </button>
      ) : (
        <span className="range-remove-spacer" aria-hidden="true" />
      )}
    </div>
  )
}

/** nᵢ = Maxᵢ / eᵢ when both values of the row are present and positive, and the ratio is exact. */
function intervalCount(range: PartialRangeDraft): number | null {
  const max = massDraftToGrams(range.maxCapacity)
  const e = massDraftToGrams(range.verificationInterval)
  if (max === null || e === null || max <= 0 || e <= 0) return null

  return ratio(max, e)
}
