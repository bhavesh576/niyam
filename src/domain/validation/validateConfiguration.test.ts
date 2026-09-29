import { describe, expect, it } from 'vitest'
import { validateConfiguration } from './validateConfiguration'
import { RULE_IDS } from './references'
import { PENDING_RULES } from '../pendingRules'
import { fieldKey, instrumentField, rangeField } from './fieldPath'
import type { InstrumentConfig } from '../models/instrument'
import { toInstrumentConfig, convertMassDraftUnit, massDraftToGrams } from '../models/draft'
import {
  OFFICIAL_EXAMPLE_CONFIG,
  createOfficialExampleDraft,
} from '../../data/defaultConfiguration'
import { fixture, officialExampleFixture } from '../../testing/fixtures'
import { issuesAtField, issuesWithRule, messageText, ruleIds } from '../../testing/assertions'

/**
 * Unit tests for the Phase 1 configuration validator.
 *
 * Every expected number below comes from OIML R 76-1:2006 (E) — quoted in
 * `docs/r76-verified-extracts.md`. The valid baseline is the multi-interval example printed in
 * §3.3.3 (Max = 2 / 5 / 15 kg, e = 1 / 2 / 10 g, class III, Min = 20 g, n = 2 000 / 2 500 / 1 500).
 */

const EXAMPLE_RANGES = [
  { max: 2_000, e: 1 },
  { max: 5_000, e: 2 },
  { max: 15_000, e: 10 },
]

// ---------------------------------------------------------------------------------------------
// 1. Valid multi-interval configuration
// ---------------------------------------------------------------------------------------------
describe('valid multi-interval configuration', () => {
  it('accepts the official R 76 §3.3.3 example without errors or warnings', () => {
    const result = validateConfiguration(officialExampleFixture())

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.issues).toEqual([])
  })

  it('accepts the configuration as published in src/data/defaultConfiguration.ts', () => {
    const result = validateConfiguration(OFFICIAL_EXAMPLE_CONFIG)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts the same instrument as typed on the form (kg capacities, g intervals)', () => {
    const draft = createOfficialExampleDraft()
    const config = toInstrumentConfig(draft)

    // kg on screen -> grams internally, which is what the domain model must hold.
    expect(config).toEqual(OFFICIAL_EXAMPLE_CONFIG)
    expect(validateConfiguration(config).valid).toBe(true)
  })

  it('accepts a two-partial-range instrument', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 2_500, e: 1 },
          { max: 15_000, e: 5 },
        ],
      }),
    )

    // n₁ = 2 500, n₂ = 3 000 (both inside 100..10 000 / 500..10 000),
    // Max₁ / e₂ = 2 500 / 5 = 500 — exactly the Table 4 limit for class III.
    expect(result.valid).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('accepts partial ranges crossing from the 0.1 g ≤ e ≤ 2 g band into the 5 g ≤ e band', () => {
    const result = validateConfiguration(
      fixture({
        min: 40, // 20 d with d = e₁ = 2 g (§3.4.3 with Table 3)
        d: 2,
        ranges: [
          { max: 2_500, e: 2 }, // band 0.1 g ≤ e ≤ 2 g -> n₁ = 1 250, limits 100..10 000
          { max: 5_000, e: 5 }, // band 5 g ≤ e            -> n₂ = 1 000, limits 500..10 000
          { max: 15_000, e: 10 }, // band 5 g ≤ e           -> n₃ = 1 500, limits 500..10 000
        ],
      }),
    )

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('accepts n at the Table 3 maximum: n₂ = Max₂ / e₂ = 20 kg / 2 g = 10 000', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 2_000, e: 1 },
          { max: 20_000, e: 2 },
        ],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('accepts n at the Table 3 minimum of the 0.1 g ≤ e ≤ 2 g band: n₁ = 100', () => {
    const result = validateConfiguration(fixture({ min: 20, d: 1, ranges: [{ max: 100, e: 1 }] }))

    expect(result.valid).toBe(true)
    // Only the structural "single partial range" warning may appear.
    expect(ruleIds(result)).toEqual([RULE_IDS.singlePartialRange])
  })

  it('accepts n at the Table 3 minimum of the 5 g ≤ e band: n₁ = 2 500 g / 5 g = 500', () => {
    const result = validateConfiguration(fixture({ min: 100, d: 5, ranges: [{ max: 2_500, e: 5 }] }))

    expect(result.valid).toBe(true)
    expect(ruleIds(result)).toEqual([RULE_IDS.singlePartialRange])
  })

  it('accepts Min exactly at the §3.4.3 lower limit (Min = 20 d)', () => {
    const atLimit = validateConfiguration(fixture({ min: 20, d: 1, ranges: EXAMPLE_RANGES }))
    const aboveLimit = validateConfiguration(fixture({ min: 200, d: 1, ranges: EXAMPLE_RANGES }))

    expect(atLimit.valid).toBe(true)
    expect(aboveLimit.valid).toBe(true)
    expect(issuesWithRule(aboveLimit, RULE_IDS.minimumCapacity)).toEqual([])
  })

  it('accepts Table 4 exactly at the limit: Max₂ / e₃ = 5 000 g / 10 g = 500', () => {
    const result = validateConfiguration(officialExampleFixture())

    expect(issuesWithRule(result, RULE_IDS.partialRangeCapacityRatio)).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
// 2. Decreasing Max
// ---------------------------------------------------------------------------------------------
describe('decreasing Max', () => {
  it('rejects Max₂ below Max₁ and addresses the message to Range 2 Max', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 5_000, e: 1 },
          { max: 2_000, e: 2 },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(ruleIds(result)).toEqual([RULE_IDS.maximumCapacitiesIncrease])

    const [issue] = issuesWithRule(result, RULE_IDS.maximumCapacitiesIncrease)
    expect(issue.field).toEqual(rangeField(1, 'maxCapacityGrams'))
    expect(issue.severity).toBe('error')
    expect(issue.message).toContain('Max₂ = 2 kg')
    expect(issue.message).toContain('Max₁ = 5 kg')
    expect(issue.reference.status).toBe('verified')
    expect(issue.reference.clauses).toContain('3.3.1')
  })

  it('rejects equal Max values because Minᵢ = Maxᵢ₋₁ would give a range of zero width', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 5_000, e: 1 },
          { max: 5_000, e: 2 },
        ],
      }),
    )

    expect(ruleIds(result)).toEqual([RULE_IDS.maximumCapacitiesIncrease])
    expect(issuesWithRule(result, RULE_IDS.maximumCapacitiesIncrease)[0].detail).toContain('zero width')
  })

  it('reports every decreasing step, not only the first', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 9_000, e: 1 },
          { max: 8_000, e: 2 },
          { max: 7_000, e: 5 },
        ],
      }),
    )

    const issues = issuesWithRule(result, RULE_IDS.maximumCapacitiesIncrease)
    expect(issues.map((issue) => issue.field)).toEqual([
      rangeField(1, 'maxCapacityGrams'),
      rangeField(2, 'maxCapacityGrams'),
    ])
  })
})

// ---------------------------------------------------------------------------------------------
// 3. Non-increasing e
// ---------------------------------------------------------------------------------------------
describe('non-increasing e', () => {
  it('rejects equal verification scale intervals (e₂ = e₁)', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 2_000, e: 1 },
          { max: 5_000, e: 1 },
          { max: 15_000, e: 10 },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(ruleIds(result)).toEqual([RULE_IDS.verificationIntervalsIncrease])

    const [issue] = issuesWithRule(result, RULE_IDS.verificationIntervalsIncrease)
    expect(issue.field).toEqual(rangeField(1, 'verificationIntervalGrams'))
    expect(issue.message).toContain('e₂ = 1 g must be greater than e₁ = 1 g')
    expect(issue.reference.clauses).toContain('3.3.1')
  })

  it('rejects a decreasing verification scale interval (e₂ < e₁)', () => {
    const result = validateConfiguration(
      fixture({
        min: 40, // 20 d with d = e₁ = 2 g
        d: 2,
        ranges: [
          { max: 2_000, e: 2 },
          { max: 5_000, e: 1 },
          { max: 15_000, e: 10 },
        ],
      }),
    )

    expect(ruleIds(result)).toEqual([RULE_IDS.verificationIntervalsIncrease])
    expect(issuesWithRule(result, RULE_IDS.verificationIntervalsIncrease)[0].field).toEqual(
      rangeField(1, 'verificationIntervalGrams'),
    )
  })
})

// ---------------------------------------------------------------------------------------------
// 4. Invalid e value
// ---------------------------------------------------------------------------------------------
describe('invalid e value', () => {
  it('rejects e = 3 g: wrong form (§4.2.2.1) and outside every class III band (Table 3)', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 2_000, e: 1 },
          { max: 5_000, e: 2 },
          { max: 15_000, e: 3 },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(ruleIds(result).sort()).toEqual([RULE_IDS.formVerificationInterval, RULE_IDS.table3IntervalBand].sort())

    const field = rangeField(2, 'verificationIntervalGrams')
    expect(issuesAtField(result, field)).toHaveLength(2)
    expect(messageText(result)).toContain('3 g')
    expect(messageText(result)).toContain('0.1 g ≤ e ≤ 2 g')
    expect(messageText(result)).toContain('5 g ≤ e')
  })

  it('rejects e = 2.5 g: mantissa 25 is not 1, 2 or 5', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 2_000, e: 1 },
          { max: 5_000, e: 2.5 },
          { max: 15_000, e: 10 },
        ],
      }),
    )

    expect(ruleIds(result)).toContain(RULE_IDS.formVerificationInterval)
    const [formIssue] = issuesWithRule(result, RULE_IDS.formVerificationInterval)
    expect(formIssue.field).toEqual(rangeField(1, 'verificationIntervalGrams'))
    expect(formIssue.message).toContain('2.5 g')
    expect(formIssue.detail).toContain('2 g')
    expect(formIssue.detail).toContain('5 g')
  })

  it('rejects e₁ = 0.05 g: correct 5 × 10⁻² form but below the class III band 0.1 g ≤ e', () => {
    const result = validateConfiguration(
      fixture({ min: 1, d: 0.05, ranges: [{ max: 2_000, e: 0.05 }] }),
    )

    expect(result.valid).toBe(false)
    expect(ruleIds(result)).toHaveLength(2)
    expect(ruleIds(result)).toContain(RULE_IDS.table3IntervalBand)
    expect(ruleIds(result)).toContain(RULE_IDS.singlePartialRange)
    expect(issuesWithRule(result, RULE_IDS.table3IntervalBand)[0].field).toEqual(
      rangeField(0, 'verificationIntervalGrams'),
    )
    // The interval has a legal form, so the form rule must not fire.
    expect(issuesWithRule(result, RULE_IDS.formVerificationInterval)).toEqual([])
  })

  it('rejects a display division d of the wrong form independently of the ranges', () => {
    const result = validateConfiguration(
      fixture({
        min: 60,
        d: 3,
        ranges: [
          { max: 2_000, e: 3 },
          { max: 5_000, e: 5 },
        ],
      }),
    )

    expect(ruleIds(result)).toContain(RULE_IDS.formDisplayDivision)
    expect(issuesWithRule(result, RULE_IDS.formDisplayDivision)[0].field).toEqual(
      instrumentField('displayDivisionGrams'),
    )
  })

  it('rejects d ≠ e₁, as Table 2 requires e = d without an auxiliary indicating device', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 0.5,
        ranges: EXAMPLE_RANGES,
      }),
    )

    const issues = issuesWithRule(result, RULE_IDS.table2DisplayDivisionEqualsFirstInterval)
    expect(issues).toHaveLength(1)
    expect(issues[0].field).toEqual(instrumentField('displayDivisionGrams'))
    expect(issues[0].message).toContain('d = 0.5 g must equal e₁ = 1 g')
    expect(issues[0].reference.status).toBe('derived')
  })
})

// ---------------------------------------------------------------------------------------------
// 5. Invalid n relationship (n = Max / e, Table 3 via §3.3.2)
// ---------------------------------------------------------------------------------------------
describe('invalid n relationship', () => {
  it('rejects n above the Table 3 maximum of 10 000', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 2_000, e: 1 },
          { max: 20_002, e: 2 }, // n₂ = 10 001
        ],
      }),
    )

    expect(ruleIds(result)).toEqual([RULE_IDS.table3IntervalCountMaximum])
    const [issue] = issuesWithRule(result, RULE_IDS.table3IntervalCountMaximum)
    expect(issue.field).toEqual(rangeField(1, 'maxCapacityGrams'))
    expect(issue.message).toContain('n₂ = Max₂ / e₂ = 20.002 kg / 2 g = 10,001')
    expect(issue.message).toContain('must not exceed 10,000')
    expect(issue.context?.verificationIntervals).toBe(10_001)
  })

  it('rejects n below the Table 3 minimum of 100 for the band 0.1 g ≤ e ≤ 2 g', () => {
    const result = validateConfiguration(fixture({ min: 20, d: 1, ranges: [{ max: 99, e: 1 }] }))

    expect(ruleIds(result)).toContain(RULE_IDS.table3IntervalCountMinimum)
    const [issue] = issuesWithRule(result, RULE_IDS.table3IntervalCountMinimum)
    expect(issue.field).toEqual(rangeField(0, 'maxCapacityGrams'))
    expect(issue.message).toContain('must be at least 100')
  })

  it('rejects n below the Table 3 minimum of 500 for the band 5 g ≤ e', () => {
    const result = validateConfiguration(fixture({ min: 100, d: 5, ranges: [{ max: 2_495, e: 5 }] }))

    // n₁ = 2 495 g / 5 g = 499 < 500
    expect(ruleIds(result)).toContain(RULE_IDS.table3IntervalCountMinimum)
    expect(issuesWithRule(result, RULE_IDS.table3IntervalCountMinimum)[0].message).toContain('499')
    expect(issuesWithRule(result, RULE_IDS.table3IntervalCountMinimum)[0].message).toContain('at least 500')
  })

  it('evaluates nᵢ = Maxᵢ / eᵢ per partial range, not from the instrument Max alone', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 500, e: 1 }, // n₁ = 500, allowed by Table 3 ...
          { max: 5_000, e: 2 }, // n₂ = 2 500
          { max: 15_000, e: 10 }, // n₃ = 1 500
        ],
      }),
    )

    // ... but Max₁ / e₂ = 250 breaks Table 4, which is a different rule.
    expect(issuesWithRule(result, RULE_IDS.table3IntervalCountMinimum)).toEqual([])
    expect(issuesWithRule(result, RULE_IDS.partialRangeCapacityRatio)).toHaveLength(1)
  })

  it('warns (without invalidating) when Max is not a whole number of e', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 2_000.5, e: 1 },
          { max: 5_000, e: 2 },
          { max: 15_000, e: 10 },
        ],
      }),
    )

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(ruleIds(result)).toEqual([RULE_IDS.integralIntervalCount])

    const [warning] = issuesWithRule(result, RULE_IDS.integralIntervalCount)
    expect(warning.severity).toBe('warning')
    // Explicitly not presented as an R-76 requirement: no such numeric rule exists in R 76-1:2006.
    expect(warning.reference.status).toBe('structural')
  })
})

// ---------------------------------------------------------------------------------------------
// 6. Invalid Min
// ---------------------------------------------------------------------------------------------
describe('invalid Min', () => {
  it('rejects Min below 20 d (§3.4.3 with Table 3)', () => {
    const result = validateConfiguration(
      fixture({ min: 10, d: 1, ranges: EXAMPLE_RANGES }),
    )

    expect(result.valid).toBe(false)
    expect(ruleIds(result)).toEqual([RULE_IDS.minimumCapacity])
    const [issue] = issuesWithRule(result, RULE_IDS.minimumCapacity)
    expect(issue.field).toEqual(instrumentField('minCapacityGrams'))
    expect(issue.message).toContain('Min = 10 g')
    expect(issue.message).toContain('Min ≥ 20 d = 20 × 1 g = 20 g')
    expect(issue.context?.requiredMinCapacityGrams).toBe(20)
  })

  it('scales the Min requirement with d: d = 5 g requires Min ≥ 100 g', () => {
    const result = validateConfiguration(
      fixture({ min: 50, d: 5, ranges: [{ max: 2_500, e: 5 }] }),
    )

    const [issue] = issuesWithRule(result, RULE_IDS.minimumCapacity)
    expect(issue.message).toContain('20 d = 20 × 5 g = 100 g')
  })

  it('rejects Min at or above Max₁ because the weighing range would be empty', () => {
    const result = validateConfiguration(
      fixture({ min: 3_000, d: 1, ranges: EXAMPLE_RANGES }),
    )

    expect(ruleIds(result)).toEqual([RULE_IDS.weighingRangeNotEmpty])
    const [issue] = issuesWithRule(result, RULE_IDS.weighingRangeNotEmpty)
    expect(issue.field).toEqual(instrumentField('minCapacityGrams'))
    expect(issue.message).toContain('Min = 3 kg must be below Max₁ = 2 kg')
    // Structural, not an R-76 numeric requirement.
    expect(issue.reference.status).toBe('structural')
  })

  it('rejects a missing Min', () => {
    const result = validateConfiguration(fixture({ min: null, d: 1, ranges: EXAMPLE_RANGES }))

    expect(ruleIds(result)).toEqual([RULE_IDS.inputValueRequired])
    expect(issuesWithRule(result, RULE_IDS.inputValueRequired)[0].field).toEqual(
      instrumentField('minCapacityGrams'),
    )
  })

  it('rejects Min = 0 and a negative Min as not greater than zero', () => {
    for (const min of [0, -20]) {
      const result = validateConfiguration(fixture({ min, d: 1, ranges: EXAMPLE_RANGES }))
      expect(ruleIds(result)).toEqual([RULE_IDS.inputValuePositive])
    }
  })

  it('rejects unparsable Min text with a "required" message rather than a limit message', () => {
    const draft = createOfficialExampleDraft()
    draft.minCapacity = { raw: '2O g', unit: 'g' } // letter O instead of zero

    expect(massDraftToGrams(draft.minCapacity)).toBeNull()
    expect(ruleIds(validateConfiguration(toInstrumentConfig(draft)))).toContain(RULE_IDS.inputValueRequired)
  })
})

// ---------------------------------------------------------------------------------------------
// 7. Invalid partial-range relationship (Table 4, §3.3.3)
// ---------------------------------------------------------------------------------------------
describe('invalid partial-range relationship', () => {
  it('rejects Max₁ / e₂ below the Table 4 limit of 500 for class III', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 500, e: 1 }, // Max₁ / e₂ = 500 / 2 = 250 < 500
          { max: 5_000, e: 2 },
          { max: 15_000, e: 10 },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(ruleIds(result)).toEqual([RULE_IDS.partialRangeCapacityRatio])
    const [issue] = issuesWithRule(result, RULE_IDS.partialRangeCapacityRatio)
    expect(issue.field).toEqual(rangeField(0, 'maxCapacityGrams'))
    expect(issue.message).toContain('Max₁ / e₂ = 500 g / 2 g = 250')
    expect(issue.message).toContain('at least 500')
    expect(issue.reference.clauses).toEqual(['3.3.3', 'Table 4'])
  })

  it('rejects a violation in the middle of the range sequence only', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 4_000, e: 1 }, // Max₁ / e₂ = 4 000 / 2 = 2 000 ✓
          { max: 4_500, e: 2 }, // Max₂ / e₃ = 4 500 / 10 = 450 < 500 ✗
          { max: 15_000, e: 10 },
        ],
      }),
    )

    const issues = issuesWithRule(result, RULE_IDS.partialRangeCapacityRatio)
    expect(issues).toHaveLength(1)
    expect(issues[0].field).toEqual(rangeField(1, 'maxCapacityGrams'))
    expect(issues[0].message).toContain('Max₂ / e₃ = 4.5 kg / 10 g = 450')
  })

  it('exempts the last partial weighing range from Table 4 (§3.3.3)', () => {
    const result = validateConfiguration(officialExampleFixture())
    const normalized = result.valid

    expect(normalized).toBe(true)
    // The example has three partial ranges; only i = 1 and i = 2 are checked, and both pass
    // (2 000/2 = 1 000 and 5 000/10 = 500). No issue may mention Max₃ / e₄.
    expect(messageText(result)).not.toContain('e₄')
    expect(issuesWithRule(result, RULE_IDS.partialRangeCapacityRatio)).toEqual([])
  })

  it('rejects an empty partial range list', () => {
    const result = validateConfiguration(fixture({ min: 20, d: 1, ranges: [] }))

    expect(result.valid).toBe(false)
    expect(ruleIds(result)).toEqual([RULE_IDS.inputRangesRequired])
    expect(issuesWithRule(result, RULE_IDS.inputRangesRequired)[0].field).toEqual(instrumentField('ranges'))
  })

  it('rejects a missing e in one partial range and reports the affected field only', () => {
    const result = validateConfiguration(
      fixture({
        min: 20,
        d: 1,
        ranges: [
          { max: 2_000, e: 1 },
          { max: 5_000, e: null },
          { max: 15_000, e: 10 },
        ],
      }),
    )

    expect(ruleIds(result)).toEqual([RULE_IDS.inputValueRequired])
    expect(issuesWithRule(result, RULE_IDS.inputValueRequired)[0].field).toEqual(
      rangeField(1, 'verificationIntervalGrams'),
    )
  })
})

// ---------------------------------------------------------------------------------------------
// 8. Unit conversion consistency
// ---------------------------------------------------------------------------------------------
describe('unit conversion consistency', () => {
  it('produces the same configuration and the same verdict whether entered in g or in kg', () => {
    const inKilograms = createOfficialExampleDraft()
    const inGrams = createOfficialExampleDraft()
    inGrams.minCapacity = { raw: '20', unit: 'g' }
    inGrams.ranges = inKilograms.ranges.map((range) => ({
      ...range,
      maxCapacity: { raw: String(Number(range.maxCapacity.raw) * 1_000), unit: 'g' },
    }))

    expect(toInstrumentConfig(inGrams)).toEqual(toInstrumentConfig(inKilograms))
    expect(validateConfiguration(toInstrumentConfig(inGrams))).toEqual(
      validateConfiguration(toInstrumentConfig(inKilograms)),
    )
  })

  it('keeps the mass constant when the display unit of a field is switched', () => {
    const draft = { raw: '2', unit: 'kg' as const }

    expect(massDraftToGrams(draft)).toBe(2_000)
    expect(convertMassDraftUnit(draft, 'g')).toEqual({ raw: '2000', unit: 'g' })
    expect(massDraftToGrams(convertMassDraftUnit(draft, 'g'))).toBe(2_000)
    expect(convertMassDraftUnit({ raw: '2500', unit: 'g' }, 'kg')).toEqual({ raw: '2.5', unit: 'kg' })
  })

  it('does not let kg -> g conversion introduce floating point residue', () => {
    // 1.005 kg is 1004.9999999999999 g in IEEE-754; the internal microgram arithmetic must
    // still see exactly 1 005 verification scale intervals of e₁ = 1 g.
    const config: InstrumentConfig = fixture({
      min: 20,
      d: 1,
      ranges: [
        { max: 1.005 * 1_000, e: 1 },
        { max: 5_000, e: 2 },
        { max: 15_000, e: 10 },
      ],
    })

    expect(config.ranges[0].maxCapacityGrams).not.toBe(1_005) // documents the raw float artefact
    const result = validateConfiguration(config)
    expect(result.valid).toBe(true)
    expect(result.warnings).toEqual([]) // no spurious "not a whole number of e" warning
  })

  it('validates identically for a value entered as 0.001 kg and as 1 g', () => {
    const viaKilograms = fixture({ min: 20, d: 0.001 * 1_000, ranges: [{ max: 0.1 * 1_000, e: 0.001 * 1_000 }] })
    const viaGrams = fixture({ min: 20, d: 1, ranges: [{ max: 100, e: 1 }] })

    expect(viaKilograms.displayDivisionGrams).toBe(1)
    expect(viaKilograms.ranges[0].maxCapacityGrams).toBeCloseTo(100, 9)
    expect(validateConfiguration(viaGrams).valid).toBe(true)
    expect(validateConfiguration(viaKilograms).valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------
// Scope guards and rule provenance
// ---------------------------------------------------------------------------------------------
describe('scope and provenance', () => {
  it('rejects an accuracy class outside this phase with a scope message, not a limit message', () => {
    const result = validateConfiguration(
      fixture({ min: 20, d: 1, accuracyClass: 'II', ranges: EXAMPLE_RANGES }),
    )

    const scopeIssues = issuesWithRule(result, RULE_IDS.scopeAccuracyClass)
    expect(scopeIssues).toHaveLength(1)
    expect(scopeIssues[0].reference.status).toBe('scope')
    expect(scopeIssues[0].field).toEqual(instrumentField('accuracyClass'))
  })

  it('rejects a multiple-range instrument type as out of scope for this phase', () => {
    const result = validateConfiguration(
      fixture({ min: 20, d: 1, instrumentType: 'multiple-range', ranges: EXAMPLE_RANGES }),
    )

    const scopeIssues = issuesWithRule(result, RULE_IDS.scopeInstrumentType)
    expect(scopeIssues).toHaveLength(1)
    expect(scopeIssues[0].reference.status).toBe('scope')
  })

  it('attaches a source reference with clauses and status to every issue it produces', () => {
    const broken = fixture({
      min: 5,
      d: 3,
      ranges: [
        { max: 2_000, e: 3 },
        { max: 1_000, e: 3 },
        { max: 40_000, e: 0.05 },
      ],
    })

    const result = validateConfiguration(broken)
    expect(result.errors.length).toBeGreaterThan(0)

    for (const issue of result.issues) {
      expect(issue.ruleId.length).toBeGreaterThan(0)
      expect(issue.message.length).toBeGreaterThan(10)
      expect(issue.reference.document).toBe('OIML R 76-1:2006 (E)')
      expect(issue.reference.clauses.length).toBeGreaterThan(0)
      expect(['verified', 'derived', 'structural', 'scope']).toContain(issue.reference.status)
      expect(['error', 'warning']).toContain(issue.severity)
    }
  })

  it('never reports a rule that is listed as not verified in pendingRules', () => {
    const unverifiedIds = PENDING_RULES.filter((rule) => rule.reason === 'not-verified').map((rule) => rule.id)
    expect(unverifiedIds.length).toBeGreaterThan(0)

    const configurations: InstrumentConfig[] = [
      officialExampleFixture(),
      fixture({ min: 5, d: 3, ranges: [{ max: 2_000, e: 3 }] }),
      fixture({ min: 20, d: 1, ranges: [{ max: 2_000.5, e: 1 }] }),
      fixture({ min: 3_000, d: 1, ranges: EXAMPLE_RANGES }),
      fixture({ min: 20, d: 1, accuracyClass: 'I', ranges: EXAMPLE_RANGES }),
    ]

    for (const config of configurations) {
      for (const issue of validateConfiguration(config).issues) {
        expect(unverifiedIds).not.toContain(issue.ruleId)
      }
    }
  })

  it('separates errors from warnings and reports valid only when there is no error', () => {
    const withWarningOnly = validateConfiguration(
      fixture({ min: 20, d: 1, ranges: [{ max: 2_000.5, e: 1 }] }),
    )
    expect(withWarningOnly.valid).toBe(true)
    expect(withWarningOnly.errors).toHaveLength(0)
    expect(withWarningOnly.warnings.length).toBeGreaterThan(0)
    expect(withWarningOnly.issues).toEqual([...withWarningOnly.errors, ...withWarningOnly.warnings])

    const withError = validateConfiguration(fixture({ min: 5, d: 1, ranges: EXAMPLE_RANGES }))
    expect(withError.valid).toBe(false)
    expect(withError.issues).toHaveLength(withError.errors.length + withError.warnings.length)
    for (const entry of [...withError.errors, ...withError.warnings]) {
      expect(withError.issues).toContain(entry)
    }
  })

  it('orders issues by the reading order of the form', () => {
    const result = validateConfiguration(
      fixture({
        min: 5, // Min error (instrument level)
        d: 1,
        ranges: [
          { max: 2_000, e: 1 },
          { max: 1_000, e: 2 }, // decreasing Max (range 2)
          { max: 15_000, e: 3 }, // invalid e form (range 3)
        ],
      }),
    )

    const order = result.errors.map((issue) => (issue.field === null ? null : fieldKey(issue.field)))
    const minKey = fieldKey(instrumentField('minCapacityGrams'))
    const range2MaxKey = fieldKey(rangeField(1, 'maxCapacityGrams'))
    const range3IntervalKey = fieldKey(rangeField(2, 'verificationIntervalGrams'))

    expect(order[0]).toBe(minKey)
    expect(order).toContain(range2MaxKey)
    expect(order).toContain(range3IntervalKey)
    expect(order.indexOf(range2MaxKey)).toBeLessThan(order.indexOf(range3IntervalKey))
  })
})
