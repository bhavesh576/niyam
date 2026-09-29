import { describe, expect, it } from 'vitest'
import { fineIntervalInstrument, officialExampleInstrument, singleRangeBracketInstrument } from '../../testing/fixtures'
import { addGrams, subtractGrams } from '../../utils/mass'
import { allProbePoints, BOUNDARY_PROBE_REFERENCE, boundaryProbes, probeLoadAt } from './boundaries'
import type { BoundaryProbe } from './boundaries'

/**
 * Boundary probes: every range changeover and every Table 6 bracket edge of an instrument, each
 * probed just below / exactly at / just above.
 *
 * These tests are the "boundary cases must be visibly shown, never hidden" requirement in test
 * form: a boundary that the probe table did not contain, or a probe point whose resolution was
 * quietly absorbed into the neighbouring range, fails here.
 */

const EXAMPLE = officialExampleInstrument()
const SINGLE_RANGE = singleRangeBracketInstrument()
const FINE_INTERVAL = fineIntervalInstrument()

function loadsOf(probe: BoundaryProbe): number[] {
  return probe.points.map((point) => point.loadGrams)
}

function probeAt(probes: readonly BoundaryProbe[], boundaryGrams: number): BoundaryProbe {
  const probe = probes.find((candidate) => candidate.boundaryGrams === boundaryGrams)
  if (!probe) throw new Error(`no probe at ${boundaryGrams} g; found: ${probes.map((p) => p.boundaryGrams).join(', ')}`)
  return probe
}

describe('boundaryProbes — the official §3.3.3 example', () => {
  const probes = boundaryProbes(EXAMPLE)

  it('probes Min, both range changeovers, both reachable Table 6 bracket edges and Max, in load order', () => {
    expect(probes.map((probe) => probe.boundaryGrams)).toEqual([20, 500, 2_000, 4_000, 5_000, 15_000])
    expect(probes.map((probe) => probe.kind)).toEqual([
      'instrument-minimum',
      'table6-bracket-boundary',
      'partial-range-boundary',
      'table6-bracket-boundary',
      'partial-range-boundary',
      'instrument-maximum',
    ])
  })

  it('gives every probe exactly three points, below / at / above', () => {
    for (const probe of probes) {
      expect(probe.points).toHaveLength(3)
      expect(probe.points.map((point) => point.position)).toEqual(['below', 'at', 'above'])
      expect(probeLoadAt(probe, 'at')).toBe(probe.boundaryGrams)
      expect(probe.label.length).toBeGreaterThan(5)
      expect(probe.detail.length).toBeGreaterThan(20)
    }
  })

  it('places the probe loads one verification scale interval either side of Max₁ = 2 kg', () => {
    const probe = probeAt(probes, 2_000)

    expect(loadsOf(probe)).toEqual([1_999, 2_000, 2_002]) // −e₁, Max₁, +e₂
    expect(probe.points[0].resolution.ranges.range_L.range?.rangeNumber).toBe(1)
    expect(probe.points[1].resolution.ranges.range_L.range?.rangeNumber).toBe(1)
    expect(probe.points[2].resolution.ranges.range_L.range?.rangeNumber).toBe(2)
    expect(probe.points.map((point) => point.resolution.ranges.e_L)).toEqual([1, 1, 2])
    expect(probe.points.map((point) => point.resolution.mpe.absoluteMpeGrams)).toEqual([1, 1, 2])
    expect(probe.intervalChanges).toBe(true)
    expect(probe.bracketChanges).toBe(false)
  })

  it('places the probe loads one verification scale interval either side of Max₂ = 5 kg', () => {
    const probe = probeAt(probes, 5_000)

    expect(loadsOf(probe)).toEqual([4_998, 5_000, 5_010]) // −e₂, Max₂, +e₃
    expect(probe.points.map((point) => point.resolution.ranges.range_L.range?.rangeNumber)).toEqual([2, 2, 3])
    expect(probe.points.map((point) => point.resolution.ranges.e_L)).toEqual([2, 2, 10])
    expect(probe.points.map((point) => point.resolution.mpe.m)).toEqual([2_499, 2_500, 501])
    expect(probe.points.map((point) => point.resolution.mpe.coefficient)).toEqual([1.5, 1.5, 1.0])
    expect(probe.points.map((point) => point.resolution.mpe.absoluteMpeGrams)).toEqual([3, 3, 10])
    expect(probe.intervalChanges).toBe(true)
    expect(probe.bracketChanges).toBe(true)
  })

  it('shows the Table 6 bracket edge at m = 500 inside partial weighing range 1', () => {
    const probe = probeAt(probes, 500)

    expect(probe.kind).toBe('table6-bracket-boundary')
    expect(loadsOf(probe)).toEqual([499, 500, 501])
    expect(probe.points.map((point) => point.resolution.mpe.coefficient)).toEqual([0.5, 0.5, 1.0])
    expect(probe.points.map((point) => point.resolution.mpe.absoluteMpeGrams)).toEqual([0.5, 0.5, 1])
    // A bracket edge inside one range changes the bracket but not the interval.
    expect(probe.intervalChanges).toBe(false)
    expect(probe.bracketChanges).toBe(true)
  })

  it('shows the Table 6 bracket edge at m = 2 000 inside partial weighing range 2 (L = 4 kg)', () => {
    const probe = probeAt(probes, 4_000)

    expect(loadsOf(probe)).toEqual([3_998, 4_000, 4_002])
    expect(probe.points.every((point) => point.resolution.ranges.range_L.range?.rangeNumber === 2)).toBe(true)
    expect(probe.points.every((point) => point.resolution.ranges.e_L === 2)).toBe(true)
    expect(probe.points.map((point) => point.resolution.mpe.coefficient)).toEqual([1.0, 1.0, 1.5])
    expect(probe.points.map((point) => point.resolution.mpe.absoluteMpeGrams)).toEqual([2, 2, 3])
  })

  it('shows that Min itself is testable but a load below Min is not', () => {
    const probe = probeAt(probes, 20)

    expect(loadsOf(probe)).toEqual([19, 20, 21])
    expect(probe.points[0].resolution.ranges.range_L.status).toBe('below-weighing-range')
    expect(probe.points[0].resolution.mpe.status).toBe('load-outside-weighing-range')
    expect(probe.points[0].resolution.mpe.absoluteMpeGrams).toBeNull()
    expect(probe.points[0].resolution.mpe.verificationIntervalGrams).toBeNull()
    expect(probe.points[1].resolution.ranges.range_L.range?.atLowerBound).toBe(true)
    expect(probe.points[1].resolution.mpe.absoluteMpeGrams).toBe(0.5)
    expect(probe.points[2].resolution.mpe.absoluteMpeGrams).toBe(0.5)
  })

  it('shows that Max itself is testable but a load above Max is not', () => {
    const probe = probeAt(probes, 15_000)

    expect(loadsOf(probe)).toEqual([14_990, 15_000, 15_010])
    expect(probe.points[1].resolution.mpe.absoluteMpeGrams).toBe(10)
    expect(probe.points[2].resolution.ranges.range_L.status).toBe('above-weighing-range')
    expect(probe.points[2].resolution.mpe.absoluteMpeGrams).toBeNull()
  })

  it('resolves every probe point with the interval of its own range', () => {
    for (const point of allProbePoints(probes)) {
      const { ranges, mpe } = point.resolution
      expect(mpe.verificationIntervalGrams).toEqual(ranges.e_L)
      if (mpe.status === 'resolved' && mpe.coefficient !== null) {
        expect(mpe.absoluteMpeGrams).not.toBeNull()
        expect(ranges.range_L.status).toBe('resolved')
      }
    }
  })

  it('uses exact mass arithmetic for the probe loads', () => {
    expect(subtractGrams(5_000, 2)).toBe(4_998)
    expect(addGrams(5_000, 10)).toBe(5_010)
    expect(addGrams(2_000, 2)).toBe(2_002)
    expect(subtractGrams(0.3, 0.1)).toBe(0.2)

    for (const point of allProbePoints(probes)) {
      expect(Number.isSafeInteger(Math.round(point.loadGrams * 1e6))).toBe(true)
      expect(point.loadGrams).toBe(Math.round(point.loadGrams * 1e6) / 1e6)
    }
  })

  it('labels the probe placement as a presentation choice, not as an R-76 requirement', () => {
    expect(BOUNDARY_PROBE_REFERENCE.status).toBe('structural')
    expect(BOUNDARY_PROBE_REFERENCE.clauses).toContain('3.5.1')
    // The individual probes still cite the clause that makes the boundary a boundary.
    expect(probeAt(probes, 2_000).sourceReference.clauses).toContain('3.3.1')
    expect(probeAt(probes, 500).sourceReference.clauses).toContain('Table 6')
    expect(probeAt(probes, 20).sourceReference.clauses).toContain('T.3.1.4')
  })
})

describe('boundaryProbes — single-range and fractional-interval instruments', () => {
  it('probes both Table 6 bracket edges of a single-range instrument without a range changeover', () => {
    const probes = boundaryProbes(SINGLE_RANGE)

    expect(probes.map((probe) => probe.boundaryGrams)).toEqual([20, 500, 2_000, 10_000])
    expect(probes.map((probe) => probe.kind)).toEqual([
      'instrument-minimum',
      'table6-bracket-boundary',
      'table6-bracket-boundary',
      'instrument-maximum',
    ])
    expect(probes.some((probe) => probe.kind === 'partial-range-boundary')).toBe(false)

    const at500 = probeAt(probes, 500)
    expect(loadsOf(at500)).toEqual([499, 500, 501])
    expect(at500.points.map((point) => point.resolution.mpe.coefficient)).toEqual([0.5, 0.5, 1.0])

    const at2000 = probeAt(probes, 2_000)
    expect(loadsOf(at2000)).toEqual([1_999, 2_000, 2_001])
    expect(at2000.points.map((point) => point.resolution.mpe.coefficient)).toEqual([1.0, 1.0, 1.5])
    expect(at2000.intervalChanges).toBe(false)
  })

  it('probes the bracket edges of a 0.1 g instrument at the fractional loads they imply', () => {
    const probes = boundaryProbes(FINE_INTERVAL)

    expect(probes.map((probe) => probe.boundaryGrams)).toEqual([2, 50, 200, 1_000])

    const at50 = probeAt(probes, 50)
    expect(loadsOf(at50)).toEqual([49.9, 50, 50.1])
    expect(at50.points.map((point) => point.resolution.mpe.absoluteMpeGrams)).toEqual([0.05, 0.05, 0.1])

    const at200 = probeAt(probes, 200)
    expect(loadsOf(at200)).toEqual([199.9, 200, 200.1])
    expect(at200.points.map((point) => point.resolution.mpe.absoluteMpeGrams)).toEqual([0.1, 0.1, 0.15])
  })

  it('does not duplicate a bracket edge that coincides with a range boundary', () => {
    // In the example, m = 2 000 of range 1 is exactly Max₁ = 2 kg: that boundary appears once, as
    // the range changeover probe, and not again as a Table 6 probe.
    const probes = boundaryProbes(EXAMPLE)
    const at2000 = probes.filter((probe) => probe.boundaryGrams === 2_000)

    expect(at2000).toHaveLength(1)
    expect(at2000[0].kind).toBe('partial-range-boundary')
  })
})
