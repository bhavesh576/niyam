import type { FieldPath } from '../domain/validation/types'

/**
 * The DOM id of the input a validation issue belongs to.
 *
 * Presentation only: the domain gives a {@link FieldPath}, and this maps it onto the ids the
 * configuration form actually renders, so an issue in the summary list can take the user to the field
 * it is about. `null` means the issue belongs to the range table as a whole rather than to one input.
 */
export function fieldElementId(field: FieldPath): string | null {
  if (field.kind === 'range') {
    return field.prop === 'maxCapacityGrams' ? `range-${field.index}-max` : `range-${field.index}-e`
  }

  switch (field.prop) {
    case 'instrumentType':
      return 'instrument-type'
    case 'accuracyClass':
      return 'accuracy-class'
    case 'minCapacityGrams':
      return 'min-capacity'
    case 'displayDivisionGrams':
      return 'display-division'
    case 'ranges':
      return 'partial-ranges'
  }
}

/**
 * Moves focus to the field an issue is about, or to the range table when the issue is about the set
 * of ranges. Does nothing when the element is not on screen — the summary is never the only way to
 * reach a field, so a missing target is not an error worth reporting.
 */
export function revealField(field: FieldPath): void {
  const id = fieldElementId(field)
  if (id === null) return

  const element = document.getElementById(id)
  if (element === null) return

  // Both calls are guarded: a headless environment implements neither, and the jump is a convenience
  // on top of a summary that already names the field — it must never be the reason something throws.
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ block: 'center' })
  }
  if (typeof element.focus === 'function') {
    // The range table is not focusable by default; its container carries tabindex="-1" so the jump
    // still lands somewhere a keyboard user can continue from.
    element.focus({ preventScroll: true })
  }
}
