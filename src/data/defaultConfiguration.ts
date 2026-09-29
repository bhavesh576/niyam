import type { InstrumentConfig } from '../domain/models/instrument'
import type { InstrumentDraft } from '../domain/models/draft'
import { createMassDraft } from '../domain/models/draft'
import { createTestObservationDraft, withObservationField } from '../domain/models/observation'
import type { TestObservationDraft } from '../domain/models/observation'
import type { TestConditionDraft } from '../domain/models/testCondition'
import { createTestConditionDraft } from '../domain/models/testCondition'

/**
 * Default instrument: the multi-interval example printed in OIML R 76-1:2006, §3.3.3 (p. 28).
 *
 * > Maximum capacity, Max = 2 / 5 / 15 kg, class III
 * > Verification scale interval, e = 1 / 2 / 10 g
 * > This instrument has one Max and one weighing range from Min = 20 g to Max = 15 kg.
 * > The partial weighing ranges are:
 * >   Min = 20 g, Max₁ = 2 kg, e₁ = 1 g, n₁ = 2 000
 * >   Min₂ = 2 kg, Max₂ = 5 kg, e₂ = 2 g, n₂ = 2 500
 * >   Min₃ = 5 kg, Max₃ = Max = 15 kg, e₃ = 10 g, n₃ = 1 500
 *
 * `d` is not stated in the example. It is set to e₁ = 1 g here, which follows from Table 2
 * (e = d for an instrument without an auxiliary indicating device) and reproduces the example's
 * Min = 20 g through §3.4.3 (Min ≥ 20 d). See docs/r76-verified-extracts.md.
 *
 * Both exports below describe the SAME instrument: the configuration in grams (used by the domain
 * and by the tests) and the form draft as it is typed on screen (kg for capacities, g for
 * intervals). The unit-conversion test asserts that they are equivalent.
 */

export const OFFICIAL_EXAMPLE_RANGE_IDS = ['example-range-1', 'example-range-2', 'example-range-3'] as const

export const OFFICIAL_EXAMPLE_CONFIG: InstrumentConfig = {
  instrumentType: 'multi-interval',
  accuracyClass: 'III',
  minCapacityGrams: 20,
  displayDivisionGrams: 1,
  ranges: [
    { id: OFFICIAL_EXAMPLE_RANGE_IDS[0], maxCapacityGrams: 2_000, verificationIntervalGrams: 1 },
    { id: OFFICIAL_EXAMPLE_RANGE_IDS[1], maxCapacityGrams: 5_000, verificationIntervalGrams: 2 },
    { id: OFFICIAL_EXAMPLE_RANGE_IDS[2], maxCapacityGrams: 15_000, verificationIntervalGrams: 10 },
  ],
}

/** The same instrument as the configuration screen would hold it. */
export function createOfficialExampleDraft(): InstrumentDraft {
  return {
    instrumentType: 'multi-interval',
    accuracyClass: 'III',
    minCapacity: { raw: '20', unit: 'g' },
    displayDivision: { raw: '1', unit: 'g' },
    ranges: [
      {
        id: OFFICIAL_EXAMPLE_RANGE_IDS[0],
        maxCapacity: { raw: '2', unit: 'kg' },
        verificationInterval: { raw: '1', unit: 'g' },
      },
      {
        id: OFFICIAL_EXAMPLE_RANGE_IDS[1],
        maxCapacity: { raw: '5', unit: 'kg' },
        verificationInterval: { raw: '2', unit: 'g' },
      },
      {
        id: OFFICIAL_EXAMPLE_RANGE_IDS[2],
        maxCapacity: { raw: '15', unit: 'kg' },
        verificationInterval: { raw: '10', unit: 'g' },
      },
    ],
  }
}

/**
 * Expected normalized range model of the official example, taken verbatim from §3.3.3.
 * Used by the range-model test so that the published example is the reference, not our arithmetic.
 */
export const OFFICIAL_EXAMPLE_NORMALIZED = {
  minCapacityGrams: 20,
  maxCapacityGrams: 15_000,
  ranges: [
    { lowerBoundGrams: 20, upperBoundGrams: 2_000, verificationIntervalGrams: 1, verificationIntervals: 2_000 },
    { lowerBoundGrams: 2_000, upperBoundGrams: 5_000, verificationIntervalGrams: 2, verificationIntervals: 2_500 },
    { lowerBoundGrams: 5_000, upperBoundGrams: 15_000, verificationIntervalGrams: 10, verificationIntervals: 1_500 },
  ],
} as const

/**
 * Default test condition for the resolution panel: the load that sits exactly on Max₁ = 2 kg of the
 * §3.3.3 example, the indication at the same value, and the next indication as observed at the range
 * changeover.
 *
 * A.4.4.3 describes that observation: weights of 1/10 eᵢ are added "until the indication of the
 * instrument is increased unambiguously by one scale interval (I + e)", and its multi-interval note
 * takes the interval from "the partial weighing range in which the indication (I + e) appears". The
 * changeover here is into partial weighing range 2, whose scale interval is e₂ = 2 g, so the next
 * indication is I + e₂ = 2 000 g + 2 g = 2 002 g.
 *
 * It is deliberately NOT 2 001 g. That value falls inside partial weighing range 2 but is not a
 * multiple of e₂, and an indicating device that steps in 2 g cannot show it (§4.2.2.2 lists the
 * "Allowed indications" of each partial weighing range; T.3.2.2: d is the difference between two
 * consecutive indicated values). Entering it is rejected by the indication-consistency check.
 *
 * The panel therefore opens on a range changeover and shows the two intervals that matter side by
 * side: e_L = e₁ = 1 g for the load, e* = e₂ = 2 g for the next indication.
 */
export function createExampleTestConditionDraft(): TestConditionDraft {
  return createTestConditionDraft(
    createMassDraft('2', 'kg'),
    createMassDraft('2000', 'g'),
    createMassDraft('2002', 'g'),
  )
}

/**
 * Default observation for the Phase 3 digital weighing test: the changeover at Max₁ = 2 kg of the
 * §3.3.3 example, with every value justified by the Recommendation rather than chosen to look nice.
 *
 * ```text
 * L      = 2 kg      Max₁ — a partial-range boundary and a Table 6 bracket edge
 *                     (§3.3.3: "for m > 500 g to 2 000 g  mpe = ± 1 e₁ = ± 1 g")
 * I      = 2000 g    the indication at that load, displayable in partial weighing range 1 (e₁ = 1 g)
 * ΔL     = 1.4 g     additional load in steps of 1/10 e₁ = 0.1 g (A.4.4.3 note: "the additional
 *                     weights ΔL are to be in steps of 1/10 eᵢ") at which the indication stepped up
 * I_next = 2002 g    the observed changeover, I + e₂ — one scale interval of partial weighing
 *                     range 2, the range in which (I + e) appears (A.4.4.3 and its note)
 * E₀     = +0.5 g    the zero error R-76 uses in its own worked example (p. 89: "If the changeover
 *                     point at zero as calculated above was E₀ = + 0.5 g")
 * ```
 *
 * What it demonstrates on screen: `range_L` = 1 and `range_I` = 1 while `range_I_next` = 2, so
 * `e_L = e₁ = 1 g` and `e* = e₂ = 2 g` differ — the mpe comes from `e_L` (± 1.0 e₁ = ± 1 g) while
 * the ½ e term of `P = I + ½ e* − ΔL` comes from `e*` (½ × 2 g = 1 g). The calculation gives
 * P = 1 999.6 g, E = −0.4 g, Ec = −0.9 g, and |Ec| = 0.9 g ≤ 1 g → PASS.
 */
export function createExampleObservationDraft(): TestObservationDraft {
  return createTestObservationDraft(
    createMassDraft('2', 'kg'),
    createMassDraft('2000', 'g'),
    createMassDraft('1.4', 'g'),
    createMassDraft('2002', 'g'),
    createMassDraft('0.5', 'g'),
  )
}

/**
 * The same observation with a ΔL that puts the corrected error outside the limit, for checking that
 * the comparison really is two-sided: P = 1 999.4 g, E = −0.6 g, Ec = −1.1 g, |Ec| > 1 g → FAIL.
 * Not pre-filled anywhere; used by the tests of the evaluation engine and of the result panel.
 */
export function createFailingObservationDraft(): TestObservationDraft {
  return withObservationField(createExampleObservationDraft(), 'additionalLoad', createMassDraft('1.6', 'g'))
}
