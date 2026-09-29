import { R76_DOCUMENT_TITLE } from '../constants/r76Tables'
import type { RuleReference } from '../validation/types'

/**
 * Provenance of every statement the Phase 2 resolvers make.
 *
 * Same discipline as `src/domain/validation/references.ts`: each result object carries the
 * reference it was produced under, so a reviewer can check any number on screen against the
 * Recommendation without reading the implementation. Verbatim quotes are transcribed from
 * OIML R 76-1:2006 (E) and mirrored, with printed page numbers, in
 * `docs/r76-verified-extracts.md`.
 */

const DOC = R76_DOCUMENT_TITLE

export const RESOLUTION_REFERENCES = {
  /** Which partial weighing range a value belongs to. */
  partialRangeMembership: {
    document: DOC,
    clauses: ['3.3.1', '3.3.3 example'],
    status: 'derived',
    quote:
      '3.3.1: "its minimum capacity, Min_i = Max_(i-1) (for i = 1, the minimum capacity is Min_1 = Min)". 3.3.3 example: "for m > 500 g to 2 000 g  mpe = ± 1 e1 = ± 1 g" and "for m > 2 000 g to 4 000 g  mpe = ± 1 e2 = ± 2 g" — a partial weighing range is (Max_(i-1), Max_i], so a value equal to Max_i still belongs to range i.',
  },

  /** Why e is resolved per quantity instead of being taken from the instrument. */
  intervalPerLoad: {
    document: DOC,
    clauses: ['3.3.3', '3.3.1'],
    status: 'verified',
    quote:
      'Whenever the variation of the indication due to certain influence factors is limited to a fraction or multiple of e, this means, in a multi-interval instrument, that e is to be taken according to the load applied; particularly at or near zero, load e = e1.',
  },

  /** Loads and indications outside Min → Max. */
  weighingRangeLimit: {
    document: DOC,
    clauses: ['T.3.1.2', 'T.3.1.4', '3.4.3'],
    status: 'derived',
    quote:
      'T.3.1.4: "Weighing range: range between the minimum and maximum capacities." T.3.1.2: "Minimum capacity (Min): value of the load below which the weighing results may be subject to an excessive relative error." A value outside the weighing range belongs to no partial weighing range, so no e and no Table 6 bracket applies to it.',
  },

  /** The Table 6 brackets themselves. */
  table6InitialVerification: {
    document: DOC,
    clauses: ['3.5.1', 'Table 6'],
    status: 'verified',
    quote:
      'Table 6 — For loads, m, expressed in verification scale intervals, e. Maximum permissible errors on initial verification, class III: ± 0.5 e for 0 ≤ m ≤ 500; ± 1.0 e for 500 < m ≤ 2 000; ± 1.5 e for 2 000 < m ≤ 10 000. Note: "The absolute value of the maximum permissible error is 0.5 e, 1.0 e or 1.5 e, i.e. it is the value of the maximum permissible error without the positive or negative sign."',
  },

  /** Which e the Table 6 coefficient multiplies on a multi-interval instrument. */
  table6MultiInterval: {
    document: DOC,
    clauses: ['3.5.1', 'Table 6', '3.3.3 example'],
    status: 'verified',
    quote:
      'Table 6 note: "For multi-interval instruments, refer to 3.3 (including the example)." The example gives, for Max = 2 / 5 / 15 kg with e = 1 / 2 / 10 g: "for m > 2 000 g to 4 000 g  mpe = ± 1 e2 = ± 2 g" and "for m > 4 000 g to 5 000 g  mpe = ± 1.5 e2 = ± 3 g" — i.e. m = L / e_i and the limit is the coefficient times that same e_i.',
  },

  /**
   * Which values an indicating device can actually show — the rule behind the rejection of an
   * indication that is not a multiple of the scale interval of the range it appears in.
   */
  indicationScaleInterval: {
    document: DOC,
    clauses: ['T.3.2.2', 'T.3.2.6', 'Table 2', '3.4.1', '4.2.2.2'],
    status: 'derived',
    quote:
      'T.3.2.2: "Actual scale interval, d — value, expressed in units of mass of: ... the difference between two consecutive indicated values, for digital indication." T.3.2.6: "Multi-interval instrument — instrument having one weighing range which is divided into partial weighing ranges each with different scale intervals, with the partial weighing range determined automatically according to the load applied, both on increasing and decreasing loads." Table 2: "Graduated, without auxiliary indicating device — e = d", with 3.4.1: "A multi-interval instrument shall not be fitted with an auxiliary indicating device." 4.2.2.2 prints the "Allowed indications" of a multi-interval instrument with automatic changeover per partial weighing range: Max1 = 150 kg, e1 = 50 g -> xxx.050 kg; Max2 = 300 kg, e2 = 100 g -> xxx.100 kg.',
  },

  /** What a "next indication" means at a changeover — the observed changeover of A.4.4.3. */
  changeoverObservation: {
    document: DOC,
    clauses: ['A.4.4.3', 'A.4.4.3 note'],
    status: 'verified',
    quote:
      'A.4.4.3: "At a certain load, L, the indicated value, I, is noted. Additional weights of say 1/10 e are successively added until the indication of the instrument is increased unambiguously by one scale interval (I + e)." Note: "The above description and formulae are also valid for multi-interval instruments. Where the load, L, and the indication, I, are in different partial weighing ranges: the additional weights dL are to be in steps of 1/10 ei, in the equation E = P - L = ... above, the term 1/2 e is to be 1/2 ei or 1/2 ei+1 according to the partial weighing range in which the indication (I + e) appears." Only the meaning of the next indication is used here; the formulae P = I + 1/2 e - dL, E = P - L and Ec = E - E0 are NOT implemented in this phase.',
  },

  /** Verified but NOT implemented: how far an indication may go. Recorded so it is not invented. */
  limitsOfIndication: {
    document: DOC,
    clauses: ['4.2.3'],
    status: 'verified',
    quote:
      'There shall be no indication above Max + 9 e. ... For multi-interval instruments there shall be no indication using ei above Maxi = ni x ei for the lower partial weighing range(s), i. NOT implemented in this phase: an indication above Max is reported as outside the weighing range, which is stricter than 4.2.3 — see src/domain/pendingRules.ts.',
  },

  /** Not applied here, recorded so nobody adds it by accident. */
  mpeInService: {
    document: DOC,
    clauses: ['3.5.2'],
    status: 'verified',
    quote:
      'The maximum permissible errors in service shall be twice the maximum permissible errors on initial verification (see 8.4.2). NOT implemented in this phase — see src/domain/pendingRules.ts.',
  },

  /**
   * The boundary table is a demonstration aid, not a requirement: R-76 does not prescribe test
   * loads. Stated explicitly so the one-interval offsets used to place the probe points are never
   * mistaken for a legal rule.
   */
  boundaryProbes: {
    document: DOC,
    clauses: ['3.3.1', '3.3.3', '3.5.1'],
    status: 'structural',
    quote:
      'Probe points are placed one verification scale interval either side of a boundary (Max_i − e_i, Max_i, Max_i + e_(i+1); and m·e_i − e_i, m·e_i, m·e_i + e_i for a Table 6 bracket) so that the changeover is visible. The offsets are a presentation choice, not an R-76 requirement.',
  },
} satisfies Record<string, RuleReference>

export type ResolutionReferenceKey = keyof typeof RESOLUTION_REFERENCES
