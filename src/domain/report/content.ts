import type { RuleReference } from '../validation/types'

/**
 * The fixed wording of the report.
 *
 * Every sentence here is one of two things, and nothing else:
 *
 * 1. a statement about what this prototype does or does not do — written so that it cannot be read
 *    as a claim of legal status; or
 * 2. text taken from OIML R 76-1:2006, transcribed in `docs/r76-verified-extracts.md` with its
 *    printed page number.
 *
 * Values never appear here: anything that depends on the instrument or the observation is composed
 * in `buildReport.ts` from the Phase 3 result.
 */

/** Section headings of the report document, in the order they are printed. */
/**
 * Six sections, in the order a test report is read: what was tested, what was observed, what the
 * instrument resolved it to, what was calculated, whether it complies, and what all of that rests on.
 * The letters are part of the wording — the screen and the document name the same sections.
 */
export const REPORT_SECTIONS = {
  instrument: 'A. Instrument identification',
  observation: 'B. Test observation',
  context: 'C. Resolved metrological context',
  calculation: 'D. Calculation',
  compliance: 'E. Compliance',
  reference: 'F. Technical reference',
} as const

export const REPORT_TITLE = 'R-76 Weighing Performance Evaluation — Prototype'

export const REPORT_DOCUMENT_KIND = 'Weighing-performance evaluation record · one test point · prototype output'

/**
 * Printed on screen and on every printed page. The report must never be mistakable for a
 * certificate: it records one evaluation this application performed.
 */
export const REPORT_STATUS_NOTICE =
  'Prototype output — not a certificate. This document is not an OIML certificate, not a government or statutory ' +
  'approval and not a legal metrology certificate. It records one weighing-performance evaluation performed by this ' +
  'application against limits and formulae transcribed from OIML R 76-1:2006 (E). Verification, and the issue of any ' +
  'certificate, remain the responsibility of the competent legal metrology authority.'

/** No instrument identity exists in the data model, so the report says what identifies it instead. */
export const REPORT_IDENTIFICATION_NOTE =
  'Instrument identification (make, model, serial number, verification mark, owner and location) is not recorded in ' +
  'this prototype. The instrument is identified here by its configuration, which is what the evaluation was performed ' +
  'against.'

export const REPORT_TEST_TYPE = 'Weighing test — evaluation of error at a changeover point'

export const REPORT_EVALUATION_TYPE = 'Initial verification'

export const REPORT_INDICATION_MODE =
  'Digital indication, no auxiliary indicating device — e = d (Table 2 with §3.4.1)'

export const REPORT_TEST_CONDITION =
  'Additional weights applied in steps of 1/10 eᵢ until the indication increased unambiguously by one scale interval ' +
  '(A.4.4.3). Gross load: no tare quantity is modelled, so no net-value correction (§3.5.3.3, §3.3.4) is applied.'

/** Where E₀ comes from — stated because the report would otherwise imply the software measured it. */
export const REPORT_ZERO_ERROR_PROVENANCE =
  'entered by the tester as the result of a separate determination at zero or at a load close to zero (A.4.2.3 with ' +
  'A.4.4.3); not derived here, not assumed to be zero and not tracked automatically'

/** Why one observation is a result: §3.6, quoted verbatim in the references of the report. */
export const REPORT_SINGLE_RESULT_BASIS =
  'The error of this single weighing result is compared, by itself, with the maximum permissible error for the given ' +
  'load. No series is averaged and no statistical treatment is applied.'

export const SINGLE_RESULT_REFERENCE: RuleReference = {
  document: 'OIML R 76-1:2006 (E)',
  clauses: ['3.6'],
  quote:
    'Regardless of what variation of results is permitted, the error of any single weighing result shall by itself not exceed the maximum permissible error for the given load.',
  status: 'verified',
}

/**
 * What this evaluation does not cover, printed with the result so the report cannot be read as a
 * complete R 76-2 test record. Each line names the clause it leaves out.
 */
export const REPORT_SCOPE_LIMITS: readonly string[] = [
  'Maximum permissible errors in service (§3.5.2, twice the initial-verification limit) — not applied.',
  'Repeatability (§3.6.1) and eccentric loading (§3.6.2) — not tested; both need several observations.',
  'The weighing test as a suite of test loads (A.4.4.1: at least 10, including Max and Min) — one test point only.',
  'Determination of the zero-setting accuracy (A.4.2.3.1, A.4.2.3.2, A.4.3) — E₀ is an input to this evaluation.',
  'Net load and tare (§3.3.4, §3.5.3.3), influence factors (§3.5.3.1, §3.9), discrimination (A.4.5) — not modelled.',
  'Measurement uncertainty and any grey zone — the limit is compared exactly as Table 6 prints it.',
  'Accuracy classes I, II and IIII, and multiple-range instruments — out of scope for this build.',
]

/** Heading and wording of the readiness gate (§8): no partial report is ever produced. */
export const REPORT_NOT_READY_HEADLINE = 'REPORT NOT READY'

export const REPORT_NOT_READY_NO_EVALUATION =
  'No observation has been evaluated yet, so there is nothing to report. Evaluate an observation in the digital ' +
  'weighing test first.'

export const REPORT_NOT_READY_STALE_EVALUATION =
  'The evaluation was performed against a different instrument configuration, so it does not describe the instrument ' +
  'under test. Evaluate the observation again.'

export const REPORT_NOT_READY_INCOMPLETE =
  'The evaluation is not complete, so no report is generated. A report is never partially populated: every value it ' +
  'prints has to come from a completed calculation.'
