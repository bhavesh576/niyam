import { R76_DOCUMENT_TITLE } from '../constants/r76Tables'
import type { RuleReference } from './types'

/**
 * Single registry of rule provenance.
 *
 * Every rule implemented by the validator points at one of these references, so a reviewer can
 * check any message against the Recommendation without reading the implementation. The verbatim
 * quotes below are transcribed from OIML R 76-1:2006 (E); see `docs/r76-verified-extracts.md`
 * for the full extracts with printed page numbers.
 *
 * Rule identifiers are stable strings: they are asserted in the unit tests and will be used by
 * later phases (report generation) to trace a result back to its requirement.
 */

export const RULE_IDS = {
  scopeInstrumentType: 'scope.instrument-type',
  scopeAccuracyClass: 'scope.accuracy-class',
  inputRangesRequired: 'input.ranges-required',
  inputValueRequired: 'input.value-required',
  inputValuePositive: 'input.value-positive',
  formDisplayDivision: 'r76.4.2.2.1.display-division-form',
  formVerificationInterval: 'r76.4.2.2.1.verification-interval-form',
  table2DisplayDivisionEqualsFirstInterval: 'r76.table2.d-equals-e1',
  table3IntervalBand: 'r76.table3.e-band',
  table3IntervalCountMinimum: 'r76.table3.n-minimum',
  table3IntervalCountMaximum: 'r76.table3.n-maximum',
  minimumCapacity: 'r76.3.4.3.min-capacity',
  maximumCapacitiesIncrease: 'r76.3.3.1.max-increasing',
  verificationIntervalsIncrease: 'r76.3.3.1.e-increasing',
  partialRangeCapacityRatio: 'r76.table4.partial-range-ratio',
  weighingRangeNotEmpty: 'structure.weighing-range-non-empty',
  integralIntervalCount: 'structure.n-integral',
  singlePartialRange: 'structure.single-partial-range',
} as const

export type RuleId = (typeof RULE_IDS)[keyof typeof RULE_IDS]

const DOC = R76_DOCUMENT_TITLE

export const REFERENCES = {
  scopePhase1: {
    document: DOC,
    clauses: ['3.1.1', 'Table 1', '3.3'],
    status: 'scope',
    quote: 'Phase 1 of this application evaluates multi-interval instruments of accuracy class III only.',
  },

  structureConfiguration: {
    document: DOC,
    clauses: ['T.3.1.1', 'T.3.1.2', 'T.3.1.4', 'T.3.2.2', 'T.3.2.3'],
    status: 'structural',
    quote: 'Internal consistency of the entered configuration; not an R-76 numeric requirement.',
  },

  scaleIntervalForm: {
    document: DOC,
    clauses: ['4.2.2.1'],
    status: 'verified',
    quote:
      'The scale interval for weighing results shall be in the form 1 x 10^k, 2 x 10^k or 5 x 10^k units in which the result is expressed, the index, k, being a positive or negative whole number or equal to zero.',
  },

  verificationIntervalForm: {
    document: DOC,
    clauses: ['4.2.2.1', '3.1.2', 'Table 2', '3.4.1'],
    status: 'derived',
    quote:
      'Table 2: "Graduated, without auxiliary indicating device — e = d"; 3.4.1: "A multi-interval instrument shall not be fitted with an auxiliary indicating device." Combined with the 1 x 10^k / 2 x 10^k / 5 x 10^k form required for the scale interval of weighing results (4.2.2.1).',
  },

  table2DisplayDivision: {
    document: DOC,
    clauses: ['3.1.2', 'Table 2', '3.4.1'],
    status: 'derived',
    quote:
      'Table 2: "Graduated, without auxiliary indicating device — e = d". 3.4.1: "A multi-interval instrument shall not be fitted with an auxiliary indicating device."',
  },

  table3Classification: {
    document: DOC,
    clauses: ['3.2', 'Table 3'],
    status: 'verified',
    quote:
      'Medium (III): 0.1 g <= e <= 2 g, n = Max/e minimum 100, maximum 10 000, Min (lower limit) 20 e;  5 g <= e, n minimum 500, maximum 10 000, Min 20 e.',
  },

  table3MultiInterval: {
    document: DOC,
    clauses: ['3.3.2', '3.2', 'Table 3'],
    status: 'verified',
    quote:
      '3.3.2 Accuracy class: e_i and n_i in each partial weighing range, and Min_1 shall comply with the requirements given in Table 3 according to the accuracy class of the instrument.',
  },

  partialRangeDefinition: {
    document: DOC,
    clauses: ['3.3.1'],
    status: 'verified',
    quote:
      'Each partial range (index i = 1, 2, ...) is defined by: its verification scale interval, e_i, e_(i+1) > e_i; its maximum capacity, Max_i; and its minimum capacity, Min_i = Max_(i-1) (for i = 1, the minimum capacity is Min_1 = Min). The number of verification scale intervals, n_i, for each partial range is equal to Max_i / e_i.',
  },

  table4PartialRangeCapacity: {
    document: DOC,
    clauses: ['3.3.3', 'Table 4'],
    status: 'verified',
    quote:
      '3.3.3: With the exception of the last partial weighing range, the requirements in Table 4 shall be complied with, according to the accuracy class of the instrument. Table 4 (Max_i / e_(i+1)): class III >= 500.',
  },

  minimumCapacity: {
    document: DOC,
    clauses: ['3.4.3', '3.2', 'Table 3'],
    status: 'derived',
    quote:
      '3.4.3: The minimum capacity of the instrument is determined in conformity with the requirements in Table 3. However, in the last column of this Table, the verification scale interval, e, is replaced by the actual scale interval, d.',
  },

  weighingRange: {
    document: DOC,
    clauses: ['T.3.1.4', '3.3.1'],
    status: 'structural',
    quote:
      'T.3.1.4 Weighing range: range between the minimum and maximum capacities. 3.3.1: Min_1 = Min and the first partial weighing range extends to Max_1.',
  },
} satisfies Record<string, RuleReference>
