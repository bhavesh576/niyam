import type { AccuracyClass, Grams, InstrumentType } from '../models/instrument'
import type { NormalizedInstrument } from '../models/normalizedInstrument'
import type { CalculationLine, PerformedEvaluation, TraceStep } from '../evaluation/types'

/**
 * Types of the Phase 4 report layer.
 *
 * The report is a **mapping** of the Phase 3 evaluation result, never a second calculation: every
 * number in a `WeighingReport` is a value that `evaluateDigitalWeighingObservation` already
 * produced, carried here together with the text the report prints for it. Nothing in this layer
 * resolves a range, looks up a Table 6 bracket or subtracts one mass from another.
 *
 * ```text
 * Phase 3 EvaluationResult  →  WeighingReport (this model)  →  result view / report document / print
 * ```
 *
 * The model holds an array of test points so a later phase can report a weighing test as a series
 * (A.4.4.1) without reshaping it; this build fills that array with the single observation the
 * application evaluates.
 */

/** The only two legal outcomes. No grey zone, no conditional verdict, no confidence value. */
export type ReportVerdict = 'PASS' | 'FAIL'

/**
 * One value taken from the evaluation result, with the ways the report prints it.
 *
 * `grams` is the Phase 3 value itself (identity-comparable with the result object in tests), so a
 * report can never drift from the calculation it reports on.
 */
export interface ReportedMass {
  /** The value in grams, exactly as the evaluation produced it. */
  grams: Grams
  /** Full form with unit, e.g. `1999.6 g`; signed where R-76 signs it, e.g. `−0.4 g`. */
  text: string
  /** Compact form for the result table, where the column head carries the unit, e.g. `1999.6`. */
  tableText: string
}

/** A partial weighing range as resolved for one quantity. */
export interface ReportedRange {
  /** Range number, 1-based, as resolved. */
  rangeNumber: number
  /** Full label, e.g. `Range 1 (20 g → 2 kg)`. */
  text: string
  /** Compact label for the result table, e.g. `1`. */
  tableText: string
}

/** A verification scale interval as resolved for one quantity — `e_L` or `e*`. */
export interface ReportedInterval {
  grams: Grams
  /** The symbol of the partial weighing range it came from, e.g. `e₁`, `e₂`. */
  symbol: string
  /** Full label, e.g. `e₂ = 2 g`. */
  text: string
  /** Compact label for the result table, e.g. `2`. */
  tableText: string
}

/** One partial weighing range of the instrument, as the normalized range model holds it. */
export interface ReportInstrumentRange {
  rangeNumber: number
  /** Minᵢ — lower bound of this partial weighing range. */
  lowerBoundText: string
  /** Maxᵢ — upper bound of this partial weighing range. */
  upperBoundText: string
  /** eᵢ, e.g. `e₁ = 1 g`. */
  intervalText: string
  /** nᵢ = Maxᵢ / eᵢ as the normalized model records it, e.g. `n₁ = 1,980`. */
  intervalsText: string
}

/** Section A — instrument identification. */
export interface ReportInstrument {
  /**
   * The identifier this prototype can give: the configuration itself. No make, model or serial
   * number is part of the data model, and none is invented here.
   */
  identifier: string
  /** States plainly which identification is not recorded, instead of leaving a blank field. */
  identificationNote: string
  accuracyClass: AccuracyClass
  /** `Class III`. */
  accuracyClassText: string
  instrumentType: InstrumentType
  /** `Class III — multi-interval`. */
  classAndTypeText: string
  /** Min → Max and d, as one line. */
  capacitiesText: string
  displayDivisionText: string
  partialRangeCount: number
  ranges: readonly ReportInstrumentRange[]
}

/** Section B — test information. */
export interface ReportTestInformation {
  /** What was done, e.g. `Weighing test — evaluation of error at a changeover point`. */
  testType: string
  /** `Initial verification` — the only evaluation type this build applies. */
  evaluationType: string
  /** How the instrument indicates, and why `e = d`. */
  indicationMode: string
  /** The condition the observation was taken under, as A.4.4.3 describes it. */
  testCondition: string
  /** The five observed quantities in one line, in grams. */
  observationText: string
  /** Where E₀ comes from — a separate determination entered by the tester, not a derived value. */
  zeroErrorProvenance: string
  /** Confirmation that I → I_next really is one scale interval of the range (I + e) appears in. */
  changeoverText: string | null
  testPointCount: number
}

/** One test point: observation, resolved context, calculation and compliance. */
export interface ReportTestPoint {
  /** `Test point 1`. */
  label: string
  observation: {
    /** L — test load. */
    load: ReportedMass
    /** I — indication at that load. */
    indication: ReportedMass
    /** ΔL — additional load at the changeover. */
    additionalLoad: ReportedMass
    /** I_next — the indication (I + e). */
    nextIndication: ReportedMass
    /** E₀ — zero error, signed. */
    zeroError: ReportedMass
  }
  context: {
    /** range_L — partial weighing range of the load. */
    loadRange: ReportedRange
    /** range_I — partial weighing range of the indication. */
    indicationRange: ReportedRange
    /** range_I_next — partial weighing range of the next indication. */
    nextIndicationRange: ReportedRange
    /** e_L — interval of the load's range; the mpe belongs to it. */
    loadInterval: ReportedInterval
    /** e* — interval of the range in which (I + e) appears; the ½ e term belongs to it. */
    changeoverInterval: ReportedInterval
    /** Whether I and I_next are indications their ranges can display. */
    indicationConsistency: string
    nextIndicationConsistency: string
    /**
     * Section 7 transparency, load side: `L → range_L → e_L → m → Table 6 bracket → mpe`.
     * Assembled from labels the resolvers already produced.
     */
    limitChain: string
    /** Section 7 transparency, indication side: `I → range_I`, `I_next → range_I_next → e*`. */
    changeoverChain: string
    /** The range-aware statements Phase 2 attaches to this resolution (e.g. a boundary note). */
    notes: readonly string[]
  }
  calculation: {
    /** ½ e* — printed because the substitution is otherwise not reproducible from the table. */
    halfChangeoverInterval: ReportedMass
    /** P = I + ½ e* − ΔL. */
    p: ReportedMass
    /** E = P − L, signed. */
    e: ReportedMass
    /** Ec = E − E₀, signed. */
    ec: ReportedMass
    /** The four substitution lines, exactly as the evaluation prints them. */
    lines: readonly CalculationLine[]
    /** The ten deterministic steps of the calculation, exactly as the evaluation produced them. */
    trace: readonly TraceStep[]
  }
  compliance: {
    /** m = L / e_L. */
    intervalCount: number
    intervalCountText: string
    /** The Table 6 cell as printed, e.g. `500 < m ≤ 2 000`. */
    bracketText: string
    /** Coefficient of e for that bracket with the interval it multiplies, e.g. `± 1.0 e₁`. */
    coefficientText: string
    /** The absolute maximum permissible error, e.g. `± 1 g`. */
    mpe: ReportedMass
    /** The whole limit statement on one line. */
    mpeStatement: string
    /** |Ec| — what the limit is compared with. */
    absoluteCorrectedError: ReportedMass
    /** mpe − |Ec|: margin inside the limit, or excess outside it. */
    margin: ReportedMass
    /** The comparison as one sentence, e.g. `|Ec| = 0.9 g ≤ mpe = 1 g — margin 0.1 g`. */
    comparisonText: string
    verdict: ReportVerdict
  }
}

/** Section D — result. */
export interface ReportResult {
  /** Overall verdict: FAIL when any test point failed, PASS only when every point passed. */
  verdict: ReportVerdict
  /** The comparison behind the verdict, for the single test point this build reports. */
  statement: string
  /** Why one observation is a result at all — §3.6, quoted in the references. */
  basis: string
  /**
   * What this evaluation does not cover, printed next to the result so the document cannot be read
   * as a complete R 76-2 test record. Fixed wording from `content.ts`.
   */
  scopeLimits: readonly string[]
  testPointCount: number
  passedCount: number
  failedCount: number
}

/** Section E — technical reference: only clauses the calculation actually rests on. */
export interface ReportReference {
  /** `OIML R 76-1:2006 (E) — A.4.4.3`. */
  citation: string
  /** The verbatim quote behind it, when the reference carries one. */
  quote: string | null
  /** `derived from the clauses above`, `limitation of this build …`, or `null` for a plain quote. */
  statusText: string | null
}

/** The report document, ready to render on screen and to print. */
export interface WeighingReport {
  /** `R-76 Weighing Performance Evaluation — Prototype`. */
  title: string
  /** What this document is, in one line. */
  documentKind: string
  /**
   * The prototype notice: this is not an OIML certificate, not a government or statutory approval
   * and not a legal metrology certificate. Always printed, on screen and in the PDF.
   */
  statusNotice: string
  generatedAt: Date
  /** Local date and time as printed, e.g. `2026-09-29 19:41`. */
  generatedAtText: string
  instrument: ReportInstrument
  test: ReportTestInformation
  testPoints: readonly ReportTestPoint[]
  result: ReportResult
  references: readonly ReportReference[]
}

// ---------------------------------------------------------------------------------------------
// Report readiness (§8) — the consistency check performed before a report is generated
// ---------------------------------------------------------------------------------------------

/** The six things that must be in place before a report may be generated. */
export type ReportCheckId =
  | 'input-data'
  | 'configuration'
  | 'calculation'
  | 'range-resolution'
  | 'mpe'
  | 'result'

export interface ReportReadinessCheck {
  id: ReportCheckId
  /** As named in the specification: `Input data`, `Configuration`, `Calculation`, … */
  label: string
  ok: boolean
  /** What was found, with the values it was read from. */
  detail: string
}

export interface ReportReady {
  status: 'ready'
  checks: readonly ReportReadinessCheck[]
  report: WeighingReport
}

export interface ReportNotReady {
  status: 'not-ready'
  checks: readonly ReportReadinessCheck[]
  /** `REPORT NOT READY` — the heading the screen shows. */
  headline: string
  /** Why no report is generated, in one sentence. */
  summary: string
  /** Every failed check, as `Label — detail`. */
  reasons: readonly string[]
}

export type ReportOutcome = ReportReady | ReportNotReady

/** What the report builder needs: the instrument, the evaluation, and when it was generated. */
export interface ReportInput {
  /** The validated instrument under test, or `null` while no configuration has been accepted. */
  instrument: NormalizedInstrument | null
  /** The evaluation the report is built from, or `null` while nothing has been evaluated. */
  evaluation: PerformedEvaluation | null
  /** Passed in so the builder stays pure and tests can fix the timestamp. */
  generatedAt: Date
}
