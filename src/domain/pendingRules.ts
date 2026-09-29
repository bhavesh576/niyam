/**
 * Rules deliberately NOT implemented in this build.
 *
 * This module exports data only — no behaviour — so nothing here can influence a validation or a
 * resolution result by accident. It exists for two reasons:
 *
 * 1. Requirements that are verified to exist in OIML R 76-1:2006 but belong to a later phase.
 * 2. Requirements whose exact numeric value could NOT be verified from the official document.
 *    Those are isolated here instead of being invented in the validator or in a resolver.
 *
 * If you are about to add a numeric limit anywhere under `src/domain`, check this list first:
 * either it is verified (then cite the clause in `validation/references.ts` or
 * `resolution/references.ts`), or it belongs here.
 *
 * Implemented since this list was first written, and removed from it:
 *
 * - the maximum permissible errors on initial verification (§3.5.1, Table 6) —
 *   `src/domain/resolution/mpeResolver.ts`;
 * - the errors of indication of A.4.4.3 (P, E, E₀, Ec and the verdict |Ec| ≤ mpe) —
 *   `src/domain/evaluation/`.
 *
 * What the evaluation deliberately does NOT do is listed below as well: repeatability, eccentric
 * loading, the determination of the zero-setting accuracy, the weighing-test suite of A.4.4.1 and any
 * treatment of measurement uncertainty.
 */

export type PendingRuleReason =
  /** Verified in R 76, planned for a later phase. */
  | 'later-phase'
  /** Verified in R 76, but not applicable to a class III multi-interval instrument. */
  | 'not-applicable-to-scope'
  /** The requirement could not be verified from the official document; must not be guessed. */
  | 'not-verified'

export interface PendingRule {
  id: string
  topic: string
  /** Clauses / tables involved, when known. */
  clauses: string[]
  reason: PendingRuleReason
  note: string
}

export const PENDING_RULES: readonly PendingRule[] = [
  {
    id: 'r76.3.5.2.mpe-in-service',
    topic: 'Maximum permissible errors in service',
    clauses: ['3.5.2'],
    reason: 'later-phase',
    note:
      'Verified: "The maximum permissible errors in service shall be twice the maximum permissible errors on initial verification (see 8.4.2)." The initial-verification limits ARE implemented (src/domain/resolution/mpeResolver.ts); the doubling for in-service verification is not, and no UI path offers an in-service limit.',
  },
  {
    id: 'r76.4.2.3.limits-of-indication',
    topic: 'Limits of indication (no indication above Max + 9 e; no indication using eᵢ above Maxᵢ)',
    clauses: ['4.2.3'],
    reason: 'later-phase',
    note:
      'Verified: "There shall be no indication above Max + 9 e." and "For multi-interval instruments there shall be no indication using eᵢ above Maxᵢ = nᵢ × eᵢ for the lower partial weighing range(s), i." NOT implemented: this build reports any indication above Max as outside the weighing range, which is stricter than §4.2.3 (it does not allow the Max + 9 e band). Applying §4.2.3 to indications — while keeping loads outside Max rejected — belongs to the phase that evaluates indications rather than resolving ranges.',
  },
  {
    id: 'r76.3.3.4.tare-device',
    topic: 'Ranges of a multi-interval instrument apply to the net load',
    clauses: ['3.3.4'],
    reason: 'later-phase',
    note:
      'Verified: "Requirements concerning the ranges of a multi-interval instrument apply to the net load, for every possible value of the tare." The resolvers and the evaluation both take gross test loads only; a tare quantity is not part of the data model, so the observation of A.4.4.3 is evaluated for the load as applied.',
  },
  {
    id: 'r76.3.5.3.3.mpe-for-net-values',
    topic: 'Maximum permissible errors apply to net values',
    clauses: ['3.5.3.3'],
    reason: 'later-phase',
    note:
      'Verified: "The maximum permissible errors apply to the net value for every possible tare load, except preset tare values." Needs the tare model of 3.3.4 first.',
  },
  {
    id: 'r76.3.5.3.1.normal-test-conditions',
    topic: 'Errors determined under normal test conditions (influence factors kept constant)',
    clauses: ['3.5.3.1', '3.9'],
    reason: 'later-phase',
    note:
      'Verified: "Errors shall be determined under normal test conditions. When the effect of one factor is being evaluated, all other factors are to be kept relatively constant, at a value close to normal." A test-record model (temperature, supply, ...) does not exist yet.',
  },
  {
    id: 'r76.3.5.3.2.rounding-error-elimination',
    topic: 'Elimination of rounding error — satisfied structurally, no separate step',
    clauses: ['3.5.3.2', 'A.4.4.3', 'Table 2', '3.4.1'],
    reason: 'not-applicable-to-scope',
    note:
      'Verified: "The rounding error included in any digital indication shall be eliminated if the actual scale interval is greater than 0.2 e." The elimination itself IS implemented — it is what the changeover calculation of A.4.4.3 does (P = I + ½ e* − ΔL recovers the indication prior to rounding; see src/domain/evaluation/evaluateObservation.ts). No separate conditional step exists, because the condition is always met in scope: Table 2 gives e = d for an instrument without an auxiliary indicating device and §3.4.1 forbids such a device on a multi-interval instrument, so d = e > 0.2 e for every configuration this build accepts. An instrument with d ≤ 0.2 e (one fitted with an auxiliary indicating device) cannot be entered here.',
  },
  {
    id: 'r76.3.6.1.repeatability',
    topic: 'Repeatability — several weighings of the same load',
    clauses: ['3.6', '3.6.1', 'A.4.10'],
    reason: 'later-phase',
    note:
      'Verified: "The difference between the results of several weighings of the same load shall not be greater than the absolute value of the maximum permissible error of the instrument for that load." Needs a series of observations at one load; this build evaluates one observation at a time. §3.6 itself IS applied: the corrected error of a single weighing is compared, by itself, with the mpe for that load — no averaging and no statistical treatment.',
  },
  {
    id: 'r76.3.6.2.eccentric-loading',
    topic: 'Eccentric loading — different positions of a load',
    clauses: ['3.6.2', '3.6.2.1', '3.6.2.2', '3.6.2.3', '3.6.2.4', 'A.4.7'],
    reason: 'later-phase',
    note:
      'Verified: "The indications for different positions of a load shall meet the maximum permissible errors", with test loads of 1/3 (3.6.2.1), 1/(n − 1) for n > 4 points of support (3.6.2.2), 1/10 for receptors subject to minimal off-centre loading (3.6.2.3) and the usual rolling load not exceeding 0.8 times Max plus additive tare (3.6.2.4) of the sum of the maximum capacity and the maximum additive tare effect. Needs a load-position model and several observations per position.',
  },
  {
    id: 'r76.a4.2.3.zero-setting-accuracy',
    topic: 'Determination of the zero-setting accuracy — the measurement E₀ comes from',
    clauses: ['A.4.2.3', 'A.4.2.3.1', 'A.4.2.3.2', 'A.4.3'],
    reason: 'later-phase',
    note:
      'Verified: the accuracy of a non-automatic or semi-automatic zero-setting device is tested by loading to an indication as close as possible to a changeover point, initiating the zero-setting device and determining the additional load at which the indication changes from zero to one scale interval above zero; for automatic zero-setting or zero-tracking the indication is first brought out of the automatic range (e.g. by loading with 10 e). In both cases "the error at zero is calculated according to the description in A.4.4.3". That calculation IS implemented — it is the same evaluation, run at zero — but this build does not model a zero-setting device, a zero-tracking range or the sequence of observations the determination needs. E₀ is therefore an explicit input entered by the tester, labelled "Zero error E₀", and is never derived, defaulted to zero or tracked.',
  },
  {
    id: 'r76.a4.4.1.weighing-test-suite',
    topic: 'The weighing test as a suite of test loads, and the reports built from it',
    clauses: ['A.4.4.1', 'A.4.4.2', 'A.4.4.5', '8.3', '8.4'],
    reason: 'later-phase',
    note:
      'Verified: "Apply test loads from zero up to and including Max, and similarly remove the test loads back to zero. When determining the initial intrinsic error, at least 10 different test loads shall be selected, and for other weighing tests at least 5 shall be selected. The test loads selected shall include Max and Min (Min only if Min ≥ 100 mg) and values at or near those at which the maximum permissible error (mpe) changes." This build evaluates one observation of that sequence; it stores no series, selects no test loads, produces no report and issues no certificate.',
  },
  {
    id: 'r76.a4.4.3.determination-accuracy',
    topic: 'Uncertainty of the determination ("sufficient accuracy in view of the tolerance")',
    clauses: ['A.4.4.3', 'A.4.4.4', 'A.4.11.1'],
    reason: 'later-phase',
    note:
      'Verified: "In the tests A.4.2.3 and A.4.11.1, the error shall be determined with a sufficient accuracy in view of the tolerance in question", and for modules A.4.4.4 requires an uncertainty better than (1/5) pᵢ × e. No uncertainty model exists here: the corrected error is compared with the limit exactly as printed, with no uncertainty band, no grey zone and no in-doubt verdict. Values are handled as integer micrograms so the comparison itself introduces no rounding.',
  },
  {
    id: 'r76.table3.other-accuracy-classes',
    topic: 'Table 3 / Table 4 limits for classes I, II and IIII',
    clauses: ['3.2', 'Table 3', '3.3.3', 'Table 4'],
    reason: 'later-phase',
    note:
      'The values are recorded as verified reference data in src/domain/constants/r76Tables.ts, but the evaluator rejects these classes until their handling (in particular the class II dual e bands and the unbounded class I maximum n) is implemented and tested.',
  },
  {
    id: 'r76.3.2.multiple-range-instruments',
    topic: 'Multiple-range instruments',
    clauses: ['3.2 note', '4.10'],
    reason: 'later-phase',
    note:
      'A different model: several weighing ranges, each treated as an instrument with one range, each with its own Min, n and Max. Not represented by the Phase 1 normalized range model.',
  },
  {
    id: 'r76.3.4.2.auxiliary-indicating-device',
    topic: 'd < e ≤ 10 d and e = 10^k kg',
    clauses: ['3.4.1', '3.4.2', 'Tables 5a, 5b'],
    reason: 'not-applicable-to-scope',
    note:
      'Verified, but §3.4.2 governs instruments fitted with an auxiliary indicating device, and §3.4.1 states that a multi-interval instrument shall not be fitted with one (only classes I and II may have one). For the Phase 1 instrument type Table 2 therefore gives e = d, which is what the validator enforces. Do not apply d < e ≤ 10 d to a class III multi-interval configuration.',
  },
  {
    id: 'r76.3.2.grading-instruments',
    topic: 'Reduced minimum capacity Min = 5 e for grading instruments',
    clauses: ['3.2 note'],
    reason: 'later-phase',
    note:
      'Verified: Min is reduced to 5 e for instruments that determine a transport tariff or toll. Requires a "grading instrument" attribute in the data model before it can be applied.',
  },
  {
    id: 'r76.annexF.module-compatibility',
    topic: 'Load cell / indicator compatibility (n_LC, v_min, DR, U_min)',
    clauses: ['Annex F', 'F.1', 'F.2', 'F.3'],
    reason: 'later-phase',
    note:
      'Applies to separately tested modules. Out of scope for instrument configuration validation; needs OIML R 60 data.',
  },
  {
    id: 'r76.3.9.influence-factors',
    topic: 'Temperature, humidity, power supply, tilt and other influence factors',
    clauses: ['3.9'],
    reason: 'later-phase',
    note: 'Test-condition requirements, not configuration requirements.',
  },
  {
    id: 'r76.5.1.markings',
    topic: 'Mandatory markings (Max, Min, e, d if d ≠ e, class symbol, ...)',
    clauses: ['5.1', '5.1.25'],
    reason: 'later-phase',
    note: 'Relevant to the report/inspection phase; needs a marking checklist model.',
  },

  // ---------------------------------------------------------------------------------------
  // NOT VERIFIED — isolated on purpose. None of these is enforced anywhere in this codebase.
  // ---------------------------------------------------------------------------------------
  {
    id: 'unverified.max-is-multiple-of-e',
    topic: '"Max_i must be an exact multiple of e_i"',
    clauses: ['3.3.1'],
    reason: 'not-verified',
    note:
      '§3.3.1 defines nᵢ = Maxᵢ / eᵢ but the 2006 edition does not state that the quotient must be an integer. Implemented only as a structural WARNING (structure.n-integral) that is explicitly labelled as not being an R-76 requirement. If a national regulation (for example the Indian legal metrology rules) requires integrality, add it as a separate, clearly attributed rule set.',
  },
  {
    id: 'unverified.min-is-multiple-of-d',
    topic: '"Min must be an exact multiple of d"',
    clauses: ['3.4.3', 'Table 3'],
    reason: 'not-verified',
    note: 'No such requirement found in OIML R 76-1:2006. Not implemented, not even as a warning.',
  },
  {
    id: 'unverified.consecutive-interval-ratio',
    topic: '"e_(i+1) / e_i must not exceed 10" (or any other bound)',
    clauses: ['3.3.1'],
    reason: 'not-verified',
    note:
      '§3.3.1 requires only eᵢ₊₁ > eᵢ. No upper bound on the ratio between consecutive verification scale intervals was found. The official §3.3.3 example itself uses e₃ / e₂ = 5 and e₂ / e₁ = 2. Not implemented.',
  },
  {
    id: 'unverified.sum-of-n',
    topic: '"The sum of n_i over all partial ranges must not exceed n_max"',
    clauses: ['3.3.2', 'Table 3'],
    reason: 'not-verified',
    note:
      '§3.3.2 applies Table 3 to eᵢ and nᵢ of each partial weighing range individually; no aggregate limit was found. Not implemented.',
  },
  {
    id: 'unverified.table4-upper-bound',
    topic: 'Upper bound on Max_i / e_(i+1)',
    clauses: ['3.3.3', 'Table 4'],
    reason: 'not-verified',
    note: 'Table 4 states a minimum (≥) only. No maximum is stated. Not implemented.',
  },
  {
    id: 'unverified.class-iii-e-gap',
    topic: 'Class III verification scale intervals between 2 g and 5 g',
    clauses: ['3.2', 'Table 3'],
    reason: 'not-verified',
    note:
      'Table 3 has a class III row for 0.1 g ≤ e ≤ 2 g and one for 5 g ≤ e, with no row in between. The validator reports "e does not fall in any band of accuracy class III" and quotes both bands rather than inventing a value for the gap. (Note that the 1 / 2 / 5 × 10^k form of §4.2.2.1 leaves no representable value in that gap anyway.)',
  },
  {
    id: 'unverified.min-upper-bound',
    topic: 'Upper bound for Min (e.g. "Min must not exceed Max/n")',
    clauses: ['3.4.3', 'T.3.1.2'],
    reason: 'not-verified',
    note:
      'Table 3 gives Min as a lower limit only. The validator enforces Min ≥ 20 d (§3.4.3 with Table 3) and the structural requirement Min < Max₁ (an empty weighing range is not an instrument), and nothing beyond that.',
  },
]

/** Pending rules of one reason, for documentation screens and tests. */
export function pendingRulesByReason(reason: PendingRuleReason): readonly PendingRule[] {
  return PENDING_RULES.filter((rule) => rule.reason === reason)
}
