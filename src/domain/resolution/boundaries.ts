import type { Grams } from '../models/instrument'
import type { NormalizedInstrument, NormalizedPartialRange } from '../models/normalizedInstrument'
import { describeMpeCoefficient, table6RowsFor } from '../constants/r76Tables'
import { addGrams, formatMass, scaleGrams, subtractGrams } from '../../utils/mass'
import {
  approximatelyGreaterThan,
  approximatelyLessOrEqual,
  approximatelyLessThan,
} from '../../utils/numeric'
import { formatCount, subscript } from '../../utils/text'
import type { RuleReference } from '../validation/types'
import { RESOLUTION_REFERENCES } from './references'
import { resolveTestCondition } from './resolveTestCondition'
import type { MpeResolutionResult, TestConditionResolution } from './types'

/**
 * Boundary probes — the loads at which a multi-interval instrument changes its applicable `e` or
 * its Table 6 bracket, made explicit instead of left for the user to discover.
 *
 * For every boundary this module produces three test loads: **just below**, **exactly at** and
 * **just above**, each fully resolved (partial weighing range, applicable e, m = L / e, Table 6
 * bracket, absolute mpe). Four kinds of boundary are probed:
 *
 * ```text
 * Min                       below = Min − e₁ (or 0 g) · at = Min      · above = Min + e₁
 * partial range boundary    below = Maxᵢ − eᵢ        · at = Maxᵢ     · above = Maxᵢ + eᵢ₊₁
 * Table 6 bracket boundary  below = L − eᵢ           · at = L = m·eᵢ · above = L + eᵢ
 * Max                       below = Max − e_r        · at = Max      · above = Max + e_r
 * ```
 *
 * The offsets are one verification scale interval because that is the smallest step the instrument
 * can indicate. They are a presentation choice and **not** an R-76 requirement — R-76 does not
 * prescribe test loads (see the `boundaryProbes` reference in `references.ts`).
 *
 * Nothing is filtered out to keep the table tidy: a probe point that lands below Min or above Max
 * is shown with the status the resolver gave it, so an unusable load is visible rather than hidden.
 */

export type ProbePosition = 'below' | 'at' | 'above'

export const PROBE_POSITIONS: readonly ProbePosition[] = ['below', 'at', 'above']

export type BoundaryProbeKind =
  /** Min — below it, weighing results may be subject to an excessive relative error (T.3.1.2). */
  | 'instrument-minimum'
  /** Maxᵢ of a non-last partial weighing range — the range changeover. */
  | 'partial-range-boundary'
  /** Max = Max_r — the end of the weighing range. */
  | 'instrument-maximum'
  /** A load at which m = L / eᵢ crosses a Table 6 bracket boundary. */
  | 'table6-bracket-boundary'

export interface BoundaryProbePoint {
  position: ProbePosition
  /** The probe test load, in grams. */
  loadGrams: Grams
  /** Full resolution of that load (ranges + MPE), exactly as the panel resolves a typed load. */
  resolution: TestConditionResolution
}

export interface BoundaryProbe {
  kind: BoundaryProbeKind
  /** The boundary value itself, in grams. */
  boundaryGrams: Grams
  /** Short label, e.g. `Max₁ = 2 kg`. */
  label: string
  /** How the three probe loads were placed and what they resolve to. */
  detail: string
  /** Always three points, in the order below / at / above. */
  points: BoundaryProbePoint[]
  /** `true` when the applicable e differs between the `below` and the `above` probe point. */
  intervalChanges: boolean
  /** `true` when the Table 6 bracket differs between the `below` and the `above` probe point. */
  bracketChanges: boolean
  sourceReference: RuleReference
}

/**
 * Provenance of the probe placement itself. The three-point scheme is a presentation choice, not
 * an R-76 requirement, and the panel says so next to the table.
 */
export const BOUNDARY_PROBE_REFERENCE: RuleReference = RESOLUTION_REFERENCES.boundaryProbes

/** All boundary probes of an instrument, ordered by increasing load. */
export function boundaryProbes(instrument: NormalizedInstrument): BoundaryProbe[] {
  const probes: BoundaryProbe[] = []

  const minimum = instrumentMinimumProbe(instrument)
  if (minimum) probes.push(minimum)

  for (const range of instrument.ranges) {
    if (!range.isLast) {
      const changeover = partialRangeBoundaryProbe(instrument, range)
      if (changeover) probes.push(changeover)
    }
    probes.push(...table6BracketProbes(instrument, range))
  }

  const maximum = instrumentMaximumProbe(instrument)
  if (maximum) probes.push(maximum)

  return probes.sort((a, b) => a.boundaryGrams - b.boundaryGrams)
}

/** Resolves one probe load the same way the panel resolves a typed load. */
export function probePoint(
  instrument: NormalizedInstrument,
  loadGrams: Grams,
  position: ProbePosition,
): BoundaryProbePoint {
  return {
    position,
    loadGrams,
    resolution: resolveTestCondition(instrument, {
      loadGrams,
      indicationGrams: null,
      nextIndicationGrams: null,
    }),
  }
}

/** The three probe loads of a group, by position. */
export function probeLoadAt(probe: BoundaryProbe, position: ProbePosition): Grams | null {
  return probe.points.find((point) => point.position === position)?.loadGrams ?? null
}

/**
 * Every probe point of every probe, flattened — used by the tests to assert that all six positions
 * around 2 kg and 5 kg are actually present and resolved.
 */
export function allProbePoints(probes: readonly BoundaryProbe[]): BoundaryProbePoint[] {
  return probes.flatMap((probe) => probe.points)
}

// ---------------------------------------------------------------------------------------------
// Probe groups
// ---------------------------------------------------------------------------------------------

function instrumentMinimumProbe(instrument: NormalizedInstrument): BoundaryProbe | null {
  const first = instrument.ranges[0]
  if (!first) return null

  const e = first.verificationIntervalGrams
  const min = instrument.minCapacityGrams
  const oneIntervalBelow = subtractGrams(min, e)
  // A negative load is not a physical probe point. Zero load is, and §3.3.3 states that at or near
  // zero the interval that applies is e₁ — which is exactly the case this probe shows.
  const belowLoad = approximatelyLessThan(oneIntervalBelow, 0) ? 0 : oneIntervalBelow
  const aboveLoad = addGrams(min, e)

  const points = pointsAt(instrument, belowLoad, min, aboveLoad)

  return buildProbe({
    kind: 'instrument-minimum',
    boundaryGrams: min,
    label: `Min = ${formatMass(min)}`,
    detail:
      `below = ${formatMass(belowLoad)} · at = Min = ${formatMass(min)} · above = Min + e₁ = ${formatMass(aboveLoad)}. ` +
      `At Min the limit is ${limitPhrase(points[1].resolution.mpe, 1)}; below Min no partial weighing range applies ` +
      '(T.3.1.2), so no e applies and Table 6 gives no limit.',
    points,
    sourceReference: RESOLUTION_REFERENCES.weighingRangeLimit,
  })
}

function partialRangeBoundaryProbe(
  instrument: NormalizedInstrument,
  range: NormalizedPartialRange,
): BoundaryProbe | null {
  const next = instrument.ranges[range.index + 1]
  if (!next) return null

  const boundary = range.upperBoundGrams
  const belowLoad = subtractGrams(boundary, range.verificationIntervalGrams)
  const aboveLoad = addGrams(boundary, next.verificationIntervalGrams)
  const points = pointsAt(instrument, belowLoad, boundary, aboveLoad)
  const i = range.rangeNumber

  return buildProbe({
    kind: 'partial-range-boundary',
    boundaryGrams: boundary,
    label: `Max${subscript(i)} = ${formatMass(boundary)} (range ${i} → range ${next.rangeNumber})`,
    detail:
      `below = Max${subscript(i)} − e${subscript(i)} = ${formatMass(belowLoad)} · at = Max${subscript(i)} = ${formatMass(boundary)} · ` +
      `above = Max${subscript(i)} + e${subscript(next.rangeNumber)} = ${formatMass(aboveLoad)}. ` +
      `A load equal to Max${subscript(i)} still belongs to partial weighing range ${i} (§3.3.3 example): the limit at ` +
      `${formatMass(boundary)} is ${limitPhrase(points[1].resolution.mpe, i)}, while one interval of range ${next.rangeNumber} higher, at ` +
      `${formatMass(aboveLoad)}, it is ${limitPhrase(points[2].resolution.mpe, next.rangeNumber)}.`,
    points,
    sourceReference: RESOLUTION_REFERENCES.partialRangeMembership,
  })
}

function instrumentMaximumProbe(instrument: NormalizedInstrument): BoundaryProbe | null {
  const last = instrument.ranges[instrument.ranges.length - 1]
  if (!last) return null

  const e = last.verificationIntervalGrams
  const max = instrument.maxCapacityGrams
  const belowLoad = subtractGrams(max, e)
  const aboveLoad = addGrams(max, e)
  const points = pointsAt(instrument, belowLoad, max, aboveLoad)
  const r = last.rangeNumber

  return buildProbe({
    kind: 'instrument-maximum',
    boundaryGrams: max,
    label: `Max = Max${subscript(r)} = ${formatMass(max)}`,
    detail:
      `below = Max − e${subscript(r)} = ${formatMass(belowLoad)} · at = Max = ${formatMass(max)} · above = Max + e${subscript(r)} = ${formatMass(aboveLoad)}. ` +
      `At Max the limit is ${limitPhrase(points[1].resolution.mpe, r)}; above Max the value is outside the weighing ` +
      'range (T.3.1.4), so no partial weighing range applies and Table 6 gives no limit.',
    points,
    sourceReference: RESOLUTION_REFERENCES.weighingRangeLimit,
  })
}

/**
 * Table 6 bracket boundaries reachable strictly inside one partial weighing range.
 *
 * For a bracket boundary m the corresponding load is `L = m × eᵢ`. A probe is emitted only when all
 * three points stay inside partial weighing range i, so that the group shows a *bracket* changeover
 * and not a *range* changeover at the same time (range changeovers have their own group). A
 * boundary that coincides with Minᵢ or Maxᵢ is therefore skipped here.
 */
function table6BracketProbes(
  instrument: NormalizedInstrument,
  range: NormalizedPartialRange,
): BoundaryProbe[] {
  const e = range.verificationIntervalGrams
  const boundaries = table6RowsFor(instrument.accuracyClass)
    .flatMap((row) => [row.mLowerBoundExclusive, row.mUpperBoundInclusive])
    .filter((value): value is number => value !== null)
    // De-duplicate: the upper bound of one row is the lower bound of the next.
    .filter((value, position, all) => all.indexOf(value) === position)

  const probes: BoundaryProbe[] = []
  const i = range.rangeNumber

  for (const m of boundaries) {
    const boundaryLoad = scaleGrams(e, m)
    if (boundaryLoad === null) continue

    const belowLoad = subtractGrams(boundaryLoad, e)
    const aboveLoad = addGrams(boundaryLoad, e)

    const strictlyInsideRange =
      approximatelyGreaterThan(boundaryLoad, range.lowerBoundGrams) &&
      approximatelyLessThan(boundaryLoad, range.upperBoundGrams)
    const pointsStayInsideRange =
      approximatelyGreaterThan(belowLoad, range.lowerBoundGrams) &&
      approximatelyLessOrEqual(aboveLoad, range.upperBoundGrams)

    if (!strictlyInsideRange || !pointsStayInsideRange) continue

    const points = pointsAt(instrument, belowLoad, boundaryLoad, aboveLoad)
    const aboveM = points[2].resolution.mpe.m

    probes.push(
      buildProbe({
        kind: 'table6-bracket-boundary',
        boundaryGrams: boundaryLoad,
        label: `Table 6: m = ${formatCount(m)} in range ${i} → L = ${formatMass(boundaryLoad)}`,
        detail:
          `L = ${formatCount(m)} × e${subscript(i)} = ${formatMass(boundaryLoad)}, probed one verification scale interval either side ` +
          `(${formatMass(belowLoad)} / ${formatMass(boundaryLoad)} / ${formatMass(aboveLoad)}). ` +
          `The boundary load itself still belongs to the lower bracket: at m = ${formatCount(m)} the limit is ` +
          `${limitPhrase(points[1].resolution.mpe, i)}, while at m = ${aboveM === null ? '—' : formatCount(aboveM)} it is ` +
          `${limitPhrase(points[2].resolution.mpe, i)}.`,
        points,
        sourceReference: RESOLUTION_REFERENCES.table6InitialVerification,
      }),
    )
  }

  return probes
}

// ---------------------------------------------------------------------------------------------

function pointsAt(instrument: NormalizedInstrument, below: Grams, at: Grams, above: Grams): BoundaryProbePoint[] {
  return [
    probePoint(instrument, below, 'below'),
    probePoint(instrument, at, 'at'),
    probePoint(instrument, above, 'above'),
  ]
}

/** `± 1.0 e₂ = ± 2 g`, or an explicit statement that no limit applies. */
function limitPhrase(mpe: MpeResolutionResult, rangeNumber: number): string {
  if (mpe.coefficient === null || mpe.absoluteMpeGrams === null) return 'no Table 6 limit'
  const coefficient = describeMpeCoefficient(mpe.coefficient).replace(' e', ` e${subscript(rangeNumber)}`)
  return `${coefficient} = ± ${formatMass(mpe.absoluteMpeGrams)}`
}

function buildProbe(probe: Omit<BoundaryProbe, 'intervalChanges' | 'bracketChanges'>): BoundaryProbe {
  const below = probe.points.find((point) => point.position === 'below')
  const above = probe.points.find((point) => point.position === 'above')

  return {
    ...probe,
    intervalChanges:
      below !== undefined && above !== undefined && !intervalsEqual(below.resolution.ranges.e_L, above.resolution.ranges.e_L),
    bracketChanges:
      below !== undefined && above !== undefined && below.resolution.mpe.coefficient !== above.resolution.mpe.coefficient,
  }
}

/** Tolerant comparison for two applicable intervals that may both be `null`. */
function intervalsEqual(a: Grams | null, b: Grams | null): boolean {
  if (a === null || b === null) return a === b
  return approximatelyLessOrEqual(a, b) && approximatelyLessOrEqual(b, a)
}
