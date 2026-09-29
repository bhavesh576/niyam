import type { Grams } from '../models/instrument'
import { describeMpeCoefficient, describeTable6Row } from '../constants/r76Tables'
import { formatMass, subtractGrams } from '../../utils/mass'
import { approximatelyEqual } from '../../utils/numeric'
import { formatCount, subscript } from '../../utils/text'
import type { BoundaryProbe, BoundaryProbePoint } from './boundaries'
import type { IndicationCheck, MpeResolutionResult, RangeResolution, TestConditionResolution } from './types'

/**
 * Wording for the resolved test condition.
 *
 * Pure functions over the resolution result — no React, no state. The panel renders these strings
 * next to the structured values, which keeps the sentences that quote R-76 in the domain layer
 * where the unit tests can assert them (the same split the validator uses for its messages).
 *
 * Every statement names the interval it used with its range subscript (`e₁`, `e₂`, …). Nothing is
 * ever labelled just `e`, because on a multi-interval instrument "the e" does not exist.
 */

const EM_DASH = '—'

/** Interval symbol of a resolved range, e.g. `e₂`. */
export function intervalSymbol(resolution: RangeResolution): string | null {
  return resolution.range ? `e${subscript(resolution.range.rangeNumber)}` : null
}

/** Short label of the partial weighing range a value was resolved into, for a table cell. */
export function rangeLabel(resolution: RangeResolution): string {
  const range = resolution.range
  if (resolution.status !== 'resolved' || range === null) return unresolvedRangeLabel(resolution)

  const bounds = `${formatMass(range.lowerBoundGrams)} → ${formatMass(range.upperBoundGrams)}`
  return `Range ${range.rangeNumber} (${bounds})`
}

/** Why no partial weighing range applies — shown instead of being left blank. */
export function unresolvedRangeLabel(resolution: RangeResolution): string {
  const value = resolution.valueGrams
  const entered = value === null || !Number.isFinite(value) ? 'no value' : formatMass(value)

  switch (resolution.status) {
    case 'resolved':
      return EM_DASH
    case 'not-a-value':
      return `not resolved (${entered})`
    case 'below-weighing-range':
      return `below the weighing range (${entered})`
    case 'above-weighing-range':
      return `above the weighing range (${entered})`
  }
}

/** `e₁ = 1 g`, or an explicit statement that no interval applies. */
export function applicableIntervalLabel(resolution: RangeResolution): string {
  const symbol = intervalSymbol(resolution)
  if (resolution.applicableIntervalGrams === null || symbol === null) {
    return `no applicable e ${EM_DASH} ${unresolvedRangeLabel(resolution)}`
  }
  return `${symbol} = ${formatMass(resolution.applicableIntervalGrams)}`
}

/** `m = L / e₁ = 2 000` — the load expressed in verification scale intervals of the load's range. */
export function intervalCountLabel(mpe: MpeResolutionResult, loadRange: RangeResolution): string {
  if (mpe.m === null) return EM_DASH
  const symbol = intervalSymbol(loadRange) ?? 'e'
  return `m = L / ${symbol} = ${formatCount(mpe.m)}`
}

/** The Table 6 bracket cell, e.g. `500 < m ≤ 2 000 → ± 1.0 e`. */
export function bracketLabel(mpe: MpeResolutionResult): string {
  return mpe.bracket === null ? EM_DASH : describeTable6Row(mpe.bracket)
}

/**
 * The mpe cell: the absolute limit in grams plus the coefficient form of Table 6, e.g.
 * `± 1 g (± 1.0 e₁)`. When nothing could be resolved the reason is stated instead of a blank.
 */
export function mpeLabel(mpe: MpeResolutionResult, loadRange: RangeResolution): string {
  if (mpe.status !== 'resolved' || mpe.absoluteMpeGrams === null || mpe.coefficient === null) {
    return mpeStatusLabel(mpe, loadRange)
  }
  const symbol = intervalSymbol(loadRange) ?? 'e'
  return `± ${formatMass(mpe.absoluteMpeGrams)} (${describeMpeCoefficient(mpe.coefficient).replace(' e', ` ${symbol}`)})`
}

/** Plain-language reason why no mpe was resolved. */
export function mpeStatusLabel(mpe: MpeResolutionResult, loadRange: RangeResolution): string {
  switch (mpe.status) {
    case 'resolved':
      return mpe.absoluteMpeGrams === null ? EM_DASH : `± ${formatMass(mpe.absoluteMpeGrams)}`
    case 'no-load-value':
      return `no mpe ${EM_DASH} no test load L entered`
    case 'load-outside-weighing-range':
      return `no mpe ${EM_DASH} L is ${unresolvedRangeLabel(loadRange)}, so no partial weighing range and no e applies`
    case 'outside-table-6':
      return `no mpe ${EM_DASH} m = ${mpe.m === null ? 'not defined' : formatCount(mpe.m)} is outside every bracket Table 6 states for class ${mpe.accuracyClass}`
  }
}

/**
 * Whether an indication can actually be displayed in the partial weighing range it resolved into —
 * one short line for the resolution table. The long explanation lives with the field message.
 */
export function consistencyLabel(check: IndicationCheck): string {
  const rangeNumber = check.resolvedRangeNumber
  const interval = check.indicationIntervalGrams

  switch (check.status) {
    case 'not-entered':
      return 'not entered'
    case 'not-resolved':
      return 'no indication check — no partial weighing range applies to this value'
    case 'consistent':
    case 'not-displayable': {
      const symbol =
        rangeNumber === null || interval === null
          ? 'the applicable interval'
          : `e${subscript(rangeNumber)} = ${formatMass(interval)}`
      const step = check.status === 'consistent' ? 'displayable' : 'not displayable'
      const relation = check.status === 'consistent' ? 'multiple of' : 'not a multiple of'
      return `${step} — ${relation} ${symbol}`
    }
  }
}

/**
 * Confirms, when the two indications show it, that the changeover observation of A.4.4.3 is what
 * was entered: the indication increased unambiguously by one scale interval, and the interval is
 * the one of the partial weighing range in which (I + e) appears.
 *
 * Stated only when both indications are displayable, they lie in different partial weighing ranges,
 * and their difference is exactly e*. Nothing is inferred when those facts are absent — a next
 * indication is an observation, not a convention.
 */
export function changeoverConfirmation(resolution: TestConditionResolution): string | null {
  const { ranges, check_I, check_I_next } = resolution

  if (check_I.status !== 'consistent' || check_I_next.status !== 'consistent') return null
  if (check_I.valueGrams === null || check_I_next.valueGrams === null) return null
  if (check_I.resolvedRangeNumber === null || check_I_next.resolvedRangeNumber === null) return null
  if (check_I.resolvedRangeNumber === check_I_next.resolvedRangeNumber) return null
  if (ranges.e_star === null) return null

  const step = subtractGrams(check_I_next.valueGrams, check_I.valueGrams)
  if (!approximatelyEqual(step, ranges.e_star)) return null

  const next = check_I_next.resolvedRangeNumber
  return (
    `I_next − I = ${formatMass(step, 'g')} = e${subscript(next)}: the indication increased unambiguously by one scale ` +
    `interval, and the interval that applies is the one of the partial weighing range in which (I + e) appears — the ` +
    `changeover observation of A.4.4.3 (additional weights of 1/10 eᵢ added "until the indication of the instrument is ` +
    `increased unambiguously by one scale interval (I + e)").`
  )
}

/** One sentence per probe point, e.g. `1 999 g → range 1, e₁ = 1 g, m = 1 999, ± 1 g`. */
export function probePointLabel(point: BoundaryProbePoint): string {
  const { ranges, mpe } = point.resolution
  const parts = [
    formatMass(point.loadGrams),
    ranges.range_L.status === 'resolved' && ranges.range_L.range
      ? `range ${ranges.range_L.range.rangeNumber}, ${applicableIntervalLabel(ranges.range_L)}`
      : unresolvedRangeLabel(ranges.range_L),
    mpe.m === null ? 'm not defined' : `m = ${formatCount(mpe.m)}`,
    mpe.status === 'resolved' && mpe.absoluteMpeGrams !== null
      ? `mpe ± ${formatMass(mpe.absoluteMpeGrams)}`
      : 'no mpe',
  ]
  return parts.join(' · ')
}

/** What changes across a boundary — the point of showing the probe group at all. */
export function probeChangeLabel(probe: BoundaryProbe): string {
  const below = probe.points.find((point) => point.position === 'below')
  const above = probe.points.find((point) => point.position === 'above')
  if (!below || !above) return EM_DASH

  const changes: string[] = []

  if (probe.intervalChanges) {
    changes.push(
      `e changes: ${applicableIntervalLabel(below.resolution.ranges.range_L)} → ${applicableIntervalLabel(above.resolution.ranges.range_L)}`,
    )
  }
  if (probe.bracketChanges) {
    const from = below.resolution.mpe.coefficient
    const to = above.resolution.mpe.coefficient
    changes.push(
      `Table 6 bracket changes: ${from === null ? 'none' : describeMpeCoefficient(from)} → ${to === null ? 'none' : describeMpeCoefficient(to)}`,
    )
  }
  if (changes.length === 0) {
    const rangeBelow = below.resolution.ranges.range_L.range?.rangeNumber
    const rangeAbove = above.resolution.ranges.range_L.range?.rangeNumber
    if (rangeBelow === undefined || rangeAbove === undefined) {
      changes.push(
        `${unresolvedRangeLabel(below.resolution.ranges.range_L)} → ${unresolvedRangeLabel(above.resolution.ranges.range_L)}`,
      )
    } else {
      changes.push(`no change: range ${rangeBelow} and ${applicableIntervalLabel(above.resolution.ranges.range_L)} on both sides`)
    }
  }

  return changes.join(' · ')
}

/**
 * Notes that must be visible whenever a resolution touches a boundary or leaves a quantity
 * unresolved. Boundary cases are reported, never silently absorbed into a neighbouring range.
 */
export function resolutionNotes(resolution: TestConditionResolution): string[] {
  const { ranges, mpe, check_I, check_I_next } = resolution
  const notes: string[] = []

  const loadRange = ranges.range_L.range

  switch (ranges.range_L.status) {
    case 'not-a-value':
      notes.push(
        'Enter a test load L. L is the only required quantity in this phase; I and I_next are optional and are used to resolve the partial weighing ranges they fall in.',
      )
      break
    case 'below-weighing-range':
      notes.push(
        `L = ${formatValue(ranges.range_L.valueGrams)} is below Min, so it lies outside the weighing range (T.3.1.4). T.3.1.2: Min is the "value of the load below which the weighing results may be subject to an excessive relative error". No partial weighing range contains L, therefore no e applies and Table 6 gives no limit for it. §3.3.3 states that "at or near zero, load e = e₁" — that fixes which interval applies near zero, it does not extend the weighing range below Min.`,
      )
      break
    case 'above-weighing-range':
      notes.push(
        `L = ${formatValue(ranges.range_L.valueGrams)} is above Max, so it lies outside the weighing range (T.3.1.4). No partial weighing range contains it, therefore no e applies and Table 6 gives no limit for it.`,
      )
      break
    case 'resolved':
      if (loadRange && ranges.range_L.range?.atUpperBound && !loadRange.isLast) {
        const next = loadRange.rangeNumber + 1
        notes.push(
          `L = ${formatValue(ranges.range_L.valueGrams)} sits exactly on Max${subscript(loadRange.rangeNumber)}, the upper bound of partial weighing range ${loadRange.rangeNumber}. ` +
            `The bound belongs to that range (§3.3.3 example: 2 000 g → ± 1 e₁, 2 001 g → ± 1 e₂), and a load one verification scale interval of range ${next} higher ` +
            `already falls in partial weighing range ${next}, where e${subscript(next)} applies.`,
        )
      }
      if (loadRange && ranges.range_L.range?.atUpperBound && loadRange.isLast) {
        notes.push(
          `L = ${formatValue(ranges.range_L.valueGrams)} sits exactly on Max = Max${subscript(loadRange.rangeNumber)}, the end of the weighing range.`,
        )
      }
      if (loadRange && ranges.range_L.range?.atLowerBound && loadRange.rangeNumber === 1) {
        notes.push(
          `L = ${formatValue(ranges.range_L.valueGrams)} sits exactly on Min, the lower limit of the weighing range (§3.4.3 with Table 3).`,
        )
      }
      break
  }

  if (mpe.status === 'outside-table-6' && mpe.m !== null) {
    notes.push(
      `m = L / e = ${formatCount(mpe.m)} falls outside every bracket Table 6 states for accuracy class ${mpe.accuracyClass}. This cannot happen for a configuration that satisfies Table 3 (n ≤ 10 000 for class III); it is reported rather than extrapolated.`,
    )
  }

  // Indication and next indication.
  const indication = ranges.range_I
  const next = ranges.range_I_next

  if (indication.status === 'resolved' && loadRange && indication.range && indication.range.rangeNumber !== loadRange.rangeNumber) {
    notes.push(
      `I = ${formatValue(indication.valueGrams)} falls in partial weighing range ${indication.range.rangeNumber} while L = ${formatValue(ranges.range_L.valueGrams)} falls in range ${loadRange.rangeNumber}. The applicable intervals differ: ${applicableIntervalLabel(indication)} for the indication, ${applicableIntervalLabel(ranges.range_L)} for the load.`,
    )
  }
  if (indication.status === 'below-weighing-range' || indication.status === 'above-weighing-range') {
    notes.push(`I = ${formatValue(indication.valueGrams)} is ${unresolvedRangeLabel(indication)} — no partial weighing range applies to it.`)
  }
  if (!check_I.accepted && indication.range) {
    notes.push(
      `I = ${formatValue(indication.valueGrams)} is rejected as an indication: partial weighing range ${indication.range.rangeNumber} displays values in steps of ` +
        `${applicableIntervalLabel(indication)}, and this value is not one of them. The value is not rounded, corrected or replaced. The mpe resolved above is ` +
        `unaffected — it comes from the partial weighing range of the test load L, never from an indication.`,
    )
  }
  if (!check_I_next.accepted && next.range) {
    notes.push(
      `I_next = ${formatValue(next.valueGrams)} is rejected as a next indication: it falls in partial weighing range ${next.range.rangeNumber}, whose scale interval is ` +
        `${applicableIntervalLabel(next)}, but it is not a value that range can display. e* is withheld rather than taken from an indication the instrument cannot show, ` +
        `and the entered value is not rounded, corrected or replaced. At a changeover the next indication is the observation (I + e) of A.4.4.3 — one scale interval of the ` +
        `partial weighing range in which it appears.`,
    )
  }

  const changeover = changeoverConfirmation(resolution)
  if (changeover !== null) {
    notes.push(changeover)
  }

  if (next.status === 'resolved' && next.range) {
    if (ranges.e_star !== null && ranges.e_L !== null && !approximatelyEqual(ranges.e_star, ranges.e_L)) {
      notes.push(
        `I_next = ${formatValue(next.valueGrams)} falls in partial weighing range ${next.range.rangeNumber}, so e* = e${subscript(next.range.rangeNumber)} = ${formatMass(ranges.e_star)} while e_L = ${formatMass(ranges.e_L)}. A range changeover lies between L and I_next; e* is resolved from I_next and is never taken from e_L (§3.3.3: "e is to be taken according to the load applied").`,
      )
    } else if (ranges.e_star !== null && ranges.e_L !== null) {
      notes.push(
        `I_next = ${formatValue(next.valueGrams)} falls in partial weighing range ${next.range.rangeNumber}, the same range as L, so e* = e_L = ${formatMass(ranges.e_star)} here. e* is still resolved from I_next on its own: the two are equal because both quantities are in the same partial weighing range, not because one was copied from the other.`,
      )
    }
  } else if (next.status === 'below-weighing-range' || next.status === 'above-weighing-range') {
    notes.push(
      `I_next = ${formatValue(next.valueGrams)} is ${unresolvedRangeLabel(next)} — no partial weighing range applies to it, so no e* applies.`,
    )
  }

  return notes
}

function formatValue(grams: Grams | null): string {
  return grams === null || !Number.isFinite(grams) ? 'not entered' : formatMass(grams)
}
