import { R76_DOCUMENT_TITLE } from '../constants/r76Tables'
import type { RuleReference } from '../validation/types'

/**
 * Provenance of every statement the Phase 3 evaluation makes.
 *
 * Same discipline as `validation/references.ts` and `resolution/references.ts`: each result carries
 * the reference it was produced under, so any number on screen can be checked against the
 * Recommendation without reading the implementation. Quotes are transcribed verbatim from
 * OIML R 76-1:2006 (E) and mirrored, with printed page numbers, in `docs/r76-verified-extracts.md`.
 *
 * The calculation implemented here is A.4.4.3 *Evaluation of error*, including its multi-interval
 * note. Nothing in this module is a paraphrase of a formula: the three formulae below are the ones
 * printed on p. 89 of the Recommendation.
 */

const DOC = R76_DOCUMENT_TITLE

export const EVALUATION_REFERENCES = {
  /** Why the changeover-point method applies to this instrument at all. */
  applicability: {
    document: DOC,
    clauses: ['A.4.4.3', '3.4.1', '3.5.3.2'],
    status: 'scope',
    quote:
      'A.4.4.3 Evaluation of error (A.4.1.6): "For instruments with digital indication and without a device for displaying the indication with a smaller scale interval (not greater than 1/5 e), the changeover points are to be used to determine the indication of the instrument, prior to rounding, as follows." 3.4.1: "A multi-interval instrument shall not be fitted with an auxiliary indicating device." 3.5.3.2: "The rounding error included in any digital indication shall be eliminated if the actual scale interval is greater than 0.2 e." For the instrument type of this build (digital, e = d, no auxiliary indicating device) d = e > 0.2 e, so the rounding error is eliminated by this method.',
  },

  /** The observation the calculation is built on: I, then ΔL added until the indication steps up. */
  changeoverProcedure: {
    document: DOC,
    clauses: ['A.4.4.3'],
    status: 'verified',
    quote:
      'At a certain load, L, the indicated value, I, is noted. Additional weights of say 1/10 e are successively added until the indication of the instrument is increased unambiguously by one scale interval (I + e).',
  },

  /** P, E and Ec — the three formulae, verbatim (printed p. 89). */
  changeoverFormulae: {
    document: DOC,
    clauses: ['A.4.4.3'],
    status: 'verified',
    quote:
      'The additional load ΔL added to the load receptor gives the indication P, prior to rounding by using the following formula: P = I + ½ e – ΔL. The error prior to rounding is: E = P – L = I + ½ e – ΔL – L. The corrected error prior to rounding is: Ec = E – E0 ≤ mpe, where E0 is the error calculated at zero or at a load close to zero (e.g. 10 e).',
  },

  /**
   * Which interval the `½ e` term takes on a multi-interval instrument — the rule that makes this
   * calculation range-aware instead of using one global e.
   */
  multiIntervalHalfInterval: {
    document: DOC,
    clauses: ['A.4.4.3 note', '3.3.3'],
    status: 'verified',
    quote:
      'Note: The above description and formulae are also valid for multi-interval instruments. Where the load, L, and the indication, I, are in different partial weighing ranges: the additional weights ΔL are to be in steps of 1/10 ei, in the equation "E = P – L = ..." above, the term "½ e" is to be ½ ei or ½ ei+1 according to the partial weighing range in which the indication (I + e) appears. 3.3.3: "e is to be taken according to the load applied".',
  },

  /** E₀ is an input determined elsewhere, not a value this build derives. */
  zeroError: {
    document: DOC,
    clauses: ['A.4.4.3', 'A.4.2.3', 'A.4.2.3.1', 'A.4.2.3.2'],
    status: 'verified',
    quote:
      'A.4.4.3: "where E0 is the error calculated at zero or at a load close to zero (e.g. 10 e)", and its worked example: "If the changeover point at zero as calculated above was E0 = + 0.5 g, the corrected error is: Ec = + 1 – (+ 0.5) = + 0.5 g". A.4.2.3.1: "The error at zero is calculated according to the description in A.4.4.3." A.4.2.3.2: "It is assumed that the error at zero load would be equal to the error at the load in question." The determination of E₀ itself (zero-setting accuracy, zero-tracking) is NOT implemented: the tester enters the value.',
  },

  /**
   * The limit Ec is compared with, and why the comparison is two-sided.
   *
   * A.4.4.3 writes "Ec = E – E0 ≤ mpe" while Table 6 prints the limits as "± 0.5 e", "± 1.0 e",
   * "± 1.5 e" and states that the absolute value is "the value of the maximum permissible error
   * without the positive or negative sign" — so the limit is ± the resolved absolute value and the
   * test is |Ec| ≤ mpe, inclusive at the limit.
   */
  verdictComparison: {
    document: DOC,
    clauses: ['A.4.4.3', '3.5.1', 'Table 6 note'],
    status: 'derived',
    quote:
      'A.4.4.3: "Ec = E – E0 ≤ mpe". 3.5.1: "The maximum permissible errors for increasing or decreasing loads are given in Table 6." Table 6 note: "The absolute value of the maximum permissible error is 0.5 e, 1.0 e or 1.5 e, i.e. it is the value of the maximum permissible error without the positive or negative sign." Table 6 prints the limits as ± 0.5 e / ± 1.0 e / ± 1.5 e, so the error must stay within ± the absolute value: |Ec| ≤ mpe, with equality inside the limit.',
  },

  /** The mpe belongs to the partial weighing range of the LOAD — never to I, never to a global e. */
  mpeFromLoadRange: {
    document: DOC,
    clauses: ['3.5.1', 'Table 6', '3.3.3 example'],
    status: 'verified',
    quote:
      'Table 6, class III, initial verification: ± 0.5 e for 0 ≤ m ≤ 500; ± 1.0 e for 500 < m ≤ 2 000; ± 1.5 e for 2 000 < m ≤ 10 000, with m the load expressed in verification scale intervals. Table 6 note: "For multi-interval instruments, refer to 3.3 (including the example)." 3.3.3 example: "for m > 500 g to 2 000 g  mpe = ± 1 e1 = ± 1 g". Resolved by the Phase 2 mpe resolver (src/domain/resolution/mpeResolver.ts) — not re-implemented here.',
  },

  /** ΔL is additional load placed on the load receptor; a negative value is not an observation. */
  additionalLoadInput: {
    document: DOC,
    clauses: ['A.4.4.3', 'A.4.4.3 note'],
    status: 'structural',
    quote:
      'A.4.4.3: "Additional weights of say 1/10 e are successively added until the indication of the instrument is increased unambiguously by one scale interval (I + e)"; note: "the additional weights ΔL are to be in steps of 1/10 ei". Weights are added, so ΔL ≥ 0. No upper bound on ΔL and no requirement that ΔL be an exact multiple of 1/10 eᵢ is stated — "say 1/10 e" describes the weights used, so neither is enforced here.',
  },

  /** Requirements verified to exist but deliberately not part of this evaluation. */
  notApplied: {
    document: DOC,
    clauses: ['3.5.2', '3.5.3.1', '3.5.3.3', '3.6.1', '3.6.2'],
    status: 'scope',
    quote:
      'Not applied here: the mpe in service ("The maximum permissible errors in service shall be twice the maximum permissible errors on initial verification", 3.5.2); influence factors and normal test conditions (3.5.3.1); net values and tare (3.5.3.3, 3.3.4); repeatability (3.6.1) and eccentric loading (3.6.2). See src/domain/pendingRules.ts.',
  },
} satisfies Record<string, RuleReference>

export type EvaluationReferenceKey = keyof typeof EVALUATION_REFERENCES

/** The references of one evaluation, in calculation order. */
export const EVALUATION_REFERENCE_ORDER = [
  EVALUATION_REFERENCES.applicability,
  EVALUATION_REFERENCES.changeoverProcedure,
  EVALUATION_REFERENCES.multiIntervalHalfInterval,
  EVALUATION_REFERENCES.changeoverFormulae,
  EVALUATION_REFERENCES.zeroError,
  EVALUATION_REFERENCES.mpeFromLoadRange,
  EVALUATION_REFERENCES.verdictComparison,
] as const satisfies readonly RuleReference[]
