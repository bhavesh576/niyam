import type { FormEvent } from 'react'
import type { InstrumentDraft, PartialRangeDraft } from '../domain/models/draft'
import type { NormalizedInstrument } from '../domain/models/normalizedInstrument'
import { createPartialRangeDraft, massDraftToGrams } from '../domain/models/draft'
import type { AccuracyClass, InstrumentType } from '../domain/models/instrument'
import {
  ACCURACY_CLASS_LABELS,
  INSTRUMENT_TYPE_LABELS,
  SUPPORTED_ACCURACY_CLASSES,
  SUPPORTED_INSTRUMENT_TYPES,
} from '../domain/models/instrument'
import { instrumentField, issuesForField } from '../domain/validation/fieldPath'
import { formatMass } from '../utils/mass'
import type { ValidationIssue } from '../domain/validation/types'
import { FieldLabel, MassField } from './MassField'
import { IssueMessages } from './IssueMessages'
import { PartialRangeRow } from './PartialRangeRow'
import { SectionHead } from './SectionHead'

export interface InstrumentConfigurationFormProps {
  draft: InstrumentDraft
  /** Issues of the last validation run; empty until the configuration has been validated. */
  issues: readonly ValidationIssue[]
  /**
   * The normalized range model, when the configuration is valid. Preferred source for each partial
   * weighing range's lower bound Minᵢ; while nothing has been accepted yet the same chain is shown
   * from the draft, so the column is never an empty box.
   */
  instrument?: NormalizedInstrument | null
  onDraftChange: (next: InstrumentDraft) => void
  onValidate: () => void
  onReset: () => void
}

const INSTRUMENT_TYPE_OPTIONS: InstrumentType[] = ['multi-interval', 'single-interval', 'multiple-range']
const ACCURACY_CLASS_OPTIONS: AccuracyClass[] = ['III', 'I', 'II', 'IIII']

/**
 * Configuration pane: what the tester enters.
 *
 * Deliberately thin — it edits an {@link InstrumentDraft} and renders whatever the domain validator
 * returned, addressed to the field each message belongs to. No R-76 logic lives here.
 *
 * The layout is the work, and it is compact on purpose: four instrument values in a 2 × 2 grid, the
 * partial weighing ranges as one table of 36 px rows, and the action row pinned to the bottom of the
 * pane, so at 1280 × 720 the whole primary path — values, ranges, **Validate configuration** — is on
 * screen without scrolling. What NIYAM made of it is the pane on the right, not more form below.
 */
export function InstrumentConfigurationForm({
  draft,
  issues,
  instrument = null,
  onDraftChange,
  onValidate,
  onReset,
}: InstrumentConfigurationFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onValidate()
  }

  function updateRange(index: number, next: PartialRangeDraft) {
    onDraftChange({
      ...draft,
      ranges: draft.ranges.map((range, position) => (position === index ? next : range)),
    })
  }

  function removeRange(index: number) {
    onDraftChange({ ...draft, ranges: draft.ranges.filter((_range, position) => position !== index) })
  }

  function addRange() {
    onDraftChange({ ...draft, ranges: [...draft.ranges, createPartialRangeDraft()] })
  }

  /**
   * Minᵢ of one row: `Min` for the first partial weighing range, Maxᵢ₋₁ for every later one.
   *
   * The validated range model is the source whenever it exists. Before the first validation the same
   * chain is read off the draft, because a derived column that shows nothing while the tester types
   * is a column that cannot be checked — and the chain Min → Max₁ → Max₂ → Max₃ (§3.3.1) is the whole
   * point of a multi-interval instrument. It is display only: no limit is evaluated here.
   */
  function lowerBoundAt(index: number): string | null {
    if (instrument !== null) {
      const range = instrument.ranges[index]
      if (range) return formatMass(range.lowerBoundGrams)
    }
    const source = index === 0 ? draft.minCapacity : draft.ranges[index - 1]?.maxCapacity
    if (source === undefined) return null
    const grams = massDraftToGrams(source)
    return grams === null ? null : formatMass(grams)
  }

  return (
    <form className="pane pane-form" onSubmit={handleSubmit} noValidate>
      <div className="pane-body">
        <h1 className="pane-title">Instrument Configuration</h1>
        <p className="pane-subtitle">NAWI · entered values checked against OIML R 76-1:2006</p>

        <SectionHead level={3} category="entered" title="Instrument" />

        <div className="field-grid">
          <div className="field-cell">
            <FieldLabel
              htmlFor="instrument-type"
              text="Instrument type"
              title="one weighing range divided into partial weighing ranges (§3.3)"
            />
            <div className="field-control">
              <div className="control-row">
                <select
                  id="instrument-type"
                  className="control-select"
                  value={draft.instrumentType}
                  onChange={(event) => onDraftChange({ ...draft, instrumentType: event.target.value as InstrumentType })}
                >
                  {INSTRUMENT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type} disabled={!SUPPORTED_INSTRUMENT_TYPES.includes(type)}>
                      {INSTRUMENT_TYPE_LABELS[type]}
                      {SUPPORTED_INSTRUMENT_TYPES.includes(type) ? '' : ' — not evaluated in this build'}
                    </option>
                  ))}
                </select>
              </div>
              <IssueMessages issues={issuesForField(issues, instrumentField('instrumentType'))} idPrefix="instrument-type" />
            </div>
          </div>

          <div className="field-cell">
            <FieldLabel htmlFor="accuracy-class" text="Accuracy class" title="medium accuracy — Table 3" />
            <div className="field-control">
              <div className="control-row">
                <select
                  id="accuracy-class"
                  className="control-select"
                  value={draft.accuracyClass}
                  onChange={(event) => onDraftChange({ ...draft, accuracyClass: event.target.value as AccuracyClass })}
                >
                  {ACCURACY_CLASS_OPTIONS.map((accuracyClass) => (
                    <option
                      key={accuracyClass}
                      value={accuracyClass}
                      disabled={!SUPPORTED_ACCURACY_CLASSES.includes(accuracyClass)}
                    >
                      {ACCURACY_CLASS_LABELS[accuracyClass]}
                      {SUPPORTED_ACCURACY_CLASSES.includes(accuracyClass) ? '' : ' — not evaluated in this build'}
                    </option>
                  ))}
                </select>
              </div>
              <IssueMessages issues={issuesForField(issues, instrumentField('accuracyClass'))} idPrefix="accuracy-class" />
            </div>
          </div>

          <div className="field-cell">
            <FieldLabel
              htmlFor="min-capacity"
              symbol="Min"
              text="Minimum capacity"
              title="Min₁ of the first partial weighing range (§3.3.1); Min ≥ 20 d (§3.4.3 with Table 3)"
            />
            <MassField
              id="min-capacity"
              label="Minimum capacity Min"
              value={draft.minCapacity}
              issues={issuesForField(issues, instrumentField('minCapacityGrams'))}
              onChange={(minCapacity) => onDraftChange({ ...draft, minCapacity })}
              placeholder="20"
            />
          </div>

          <div className="field-cell">
            <FieldLabel
              htmlFor="display-division"
              symbol="d"
              text="Display division"
              title="actual scale interval (T.3.2.2); e = d for this instrument type (Table 2)"
            />
            <MassField
              id="display-division"
              label="Display division d"
              value={draft.displayDivision}
              issues={issuesForField(issues, instrumentField('displayDivisionGrams'))}
              onChange={(displayDivision) => onDraftChange({ ...draft, displayDivision })}
              placeholder="1"
            />
          </div>
        </div>

        <SectionHead
          level={3}
          category="entered"
          title="Partial weighing ranges"
          note={'e belongs to the partial range: e₁ < e₂ < … (§3.3.1). No instrument-wide e.'}
        />

        {/* tabindex="-1" so the “→ field” jump of a configuration-wide issue has somewhere to land. */}
        <div className="range-table" id="partial-ranges" tabIndex={-1}>
          <div className="range-head">
            <span>Range</span>
            <span className="head-derived" title="Min₁ = Min; Minᵢ = Maxᵢ₋₁ (§3.3.1)">
              Min <span className="column-note">derived</span>
            </span>
            <span>
              Max <span className="column-note">entered</span>
            </span>
            <span>
              e <span className="column-note">entered</span>
            </span>
            <span className="head-derived" title="nᵢ = Maxᵢ / eᵢ (§3.3.1)">
              n <span className="column-note">derived</span>
            </span>
            <span aria-hidden="true" />
          </div>

          {draft.ranges.length === 0 ? (
            <div className="range-empty">
              No partial weighing ranges. A multi-interval instrument is defined by at least one (§3.3.1).
            </div>
          ) : (
            draft.ranges.map((range, index) => (
              <PartialRangeRow
                key={range.id}
                index={index}
                range={range}
                issues={issues}
                lowerBound={lowerBoundAt(index)}
                isLast={index === draft.ranges.length - 1}
                onChange={(next) => updateRange(index, next)}
                onRemove={() => removeRange(index)}
              />
            ))
          )}
        </div>

        <IssueMessages issues={issuesForField(issues, instrumentField('ranges'))} idPrefix="range-list" />

        <button type="button" className="button button-ghost add-range" onClick={addRange}>
          + Add range
        </button>
      </div>

      <div className="pane-actions">
        <button type="submit" className="button button-primary">
          Validate configuration
        </button>
        <button type="button" className="button button-ghost" onClick={onReset}>
          Reset to R-76 example
        </button>
        <span className="actions-note">Checks · Table 3, Table 4, §3.3.1–§3.3.3, §3.4.3, §4.2.2.1</span>
      </div>
    </form>
  )
}
