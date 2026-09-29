// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'

/**
 * Phase 4 end-to-end: configuration → validate → digital weighing test → evaluate → result →
 * trace → generate report → print.
 *
 * The point of these tests is the chain, not the components: the values the report prints are
 * compared with the values the result view shows, and every incomplete input is followed all the way
 * through to a blocked report. A report that disagreed with the screen, or that appeared with a hole
 * in it, would fail here even if every unit test passed.
 */

const CONFIGURATION_AREA = 'Instrument configuration'
const TEST_AREA = 'Digital weighing test'
const RESULT_AREA = 'Test result and report'

/** The caption of the result table, used as its accessible name. */
const RESULT_TABLE = /L, I, ΔL and I_next are the observation/

const TRANSITION_ROW: Record<string, string> = {
  L: '2000',
  I: '2000',
  ΔL: '1.4',
  I_next: '2002',
  range_L: '1',
  range_I: '1',
  range_I_next: '2',
  e_L: '1',
  'e*': '2',
  P: '1999.6',
  E: '−0.4',
  'E₀': '+0.5',
  'Ec': '−0.9',
  MPE: '± 1',
  Result: 'PASS',
}

/** Throws instead of asserting, so a helper never hides which element was missing. */
function only<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`no ${what}`)
  return value
}

/** Renders the app and validates the §3.3.3 example configuration. */
function validateConfiguration() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
  expect(screen.getByText('Configuration valid')).toBeTruthy()
}

/** Validates, evaluates the pre-filled transition observation, and opens the result area. */
function evaluateAndOpenResult(): HTMLElement {
  validateConfiguration()
  fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
  fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
  return openResultArea()
}

function openResultArea(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: RESULT_AREA }))
  return screen.getByRole('region', { name: 'Test Result and Report' })
}

function observationField(name: RegExp): HTMLInputElement {
  return screen.getByRole('textbox', { name }) as HTMLInputElement
}

/** Every result table on screen: the result view’s, and the document’s once one is generated. */
function resultTables(): HTMLElement[] {
  return screen.queryAllByRole('table', { name: RESULT_TABLE })
}

/** The document in the pane on the right, or `null` while the six gates are not satisfied. */
function reportDocument(): HTMLElement | null {
  return screen.queryByRole('article')
}

/**
 * The result screen: the left pane of the result area. The pane on the right holds the document,
 * which prints the trace and the calculation from the same model — so a rule about what the *screen*
 * shows has to be asked of this pane, not of the area, or the paper answers for it.
 */
function screenPane(area: HTMLElement): HTMLElement {
  return only(area.querySelector<HTMLElement>('.pane-result-main'), 'result screen pane')
}

/** The fifteen columns of a result table, addressed by their column header. */
function rowOf(table: HTMLElement): Record<string, string> {
  const headers = within(table)
    .getAllByRole('columnheader')
    .filter((header) => !header.className.includes('result-group'))
  const cells = within(table).getAllByRole('cell')
  if (headers.length !== cells.length) {
    throw new Error(`${headers.length} column headers but ${cells.length} cells`)
  }
  return Object.fromEntries(headers.map((header, index) => [header.textContent ?? '', cells[index]?.textContent ?? '']))
}

/** True when the text is on screen at least once — several of these strings appear both in a
 * readiness gate and in the list of reasons, and both places are meant to carry them. */
function hasText(container: HTMLElement, match: string | RegExp): boolean {
  return within(container).queryAllByText(match).length > 0
}

/** The value of one `dt`/`dd` pair of the report’s fact lists. */
function fact(container: HTMLElement, label: string): string {
  return within(container).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent ?? ''
}

function generateButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Generate report' }) as HTMLButtonElement
}

function generateReport() {
  fireEvent.click(generateButton())
}

/** The clauses section E lists, and nothing else on the page. */
function referenceText(document: HTMLElement): string {
  return (
    within(document)
      .getAllByRole('listitem')
      .filter((item) => item.className.includes('report-reference'))
      .map((item) => item.textContent ?? '')
      .join(' | ')
  )
}

describe('the result and report area', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('is one click from the test area, and starts with no result and no report', () => {
    validateConfiguration()
    const area = openResultArea()

    expect(within(area).getByText('REPORT NOT READY')).toBeTruthy()
    expect(within(area).getByText(/No observation has been evaluated yet/)).toBeTruthy()
    expect(generateButton().disabled).toBe(true)
    expect(reportDocument()).toBeNull()
    expect(screen.queryAllByText('PASS')).toEqual([])
    expect(screen.queryAllByText('FAIL')).toEqual([])
    expect(resultTables()).toEqual([])

    // The six gates are visible before anything is generated, with the five that need an evaluation open.
    const gates = within(area)
      .getAllByRole('listitem')
      .filter((item) => item.className.includes('readiness-check'))
    expect(gates.map((gate) => within(gate).getByText(/^(Input data|Configuration|Calculation|Range resolution|MPE|Result)$/).textContent)).toEqual([
      'Input data',
      'Configuration',
      'Calculation',
      'Range resolution',
      'MPE',
      'Result',
    ])
    expect(gates.filter((gate) => gate.className.includes('satisfied'))).toHaveLength(1)
    expect(gates.filter((gate) => gate.className.includes('missing'))).toHaveLength(5)
  })

  it('asks for a validated configuration before it can report anything', () => {
    render(<App />)
    const area = openResultArea()

    expect(within(area).getByText('REPORT NOT READY')).toBeTruthy()
    expect(hasText(area, /no validated instrument configuration/)).toBe(true)
    expect(generateButton().disabled).toBe(true)
    expect(reportDocument()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open the instrument configuration' }))
    expect(screen.getByRole('heading', { name: 'Instrument Configuration' })).toBeTruthy()
  })

  it('shows the result of the transition observation in four groups, with one verdict', () => {
    const area = evaluateAndOpenResult()

    expect(within(area).getByRole('status').textContent).toBe('PASS|Ec| = 0.9 g ≤ mpe = 1 g — margin 0.1 g')
    // Instrument · Observation · Resolved · Compliance. The calculation itself is not a fifth group
    // here: its four substitution lines and its ten steps are on the test screen and in section D of
    // the document, and this screen answers what the result is.
    expect(within(area).getByText('Instrument', { selector: '.detail-heading' })).toBeTruthy()
    expect(within(area).getByText('Observation', { selector: '.detail-heading' })).toBeTruthy()
    expect(within(area).getByText('Resolved', { selector: '.detail-heading' })).toBeTruthy()
    expect(within(area).getByText('Compliance', { selector: '.detail-heading' })).toBeTruthy()
    expect(within(area).queryAllByText('Calculation (A.4.4.3)', { selector: '.detail-heading' })).toEqual([])

    // The resolved context of the transition. `Range 1 …` is shown for range_L and for range_I, and
    // again among the instrument's partial weighing ranges, so it is counted rather than singled out.
    const pane = screenPane(area)
    expect(within(pane).queryAllByText('Range 1 (20 g → 2 kg)', { selector: 'dd' }).length).toBeGreaterThan(1)
    expect(within(pane).getByText('Range 2 (2 kg → 5 kg)', { selector: 'dd' })).toBeTruthy()
    expect(within(pane).getByText('e_L = e₁ = 1 g', { selector: 'dd' })).toBeTruthy()
    expect(within(pane).getByText('e* = e₂ = 2 g', { selector: 'dd' })).toBeTruthy()

    // The ten steps of the trace are not a section of this screen — they are on the test screen and on
    // the paper beside it, printed from the same model, so no step can be worded twice in two places.
    const stepsOnScreen = within(pane)
      .queryAllByRole('listitem')
      .filter((item) => item.className.includes('trace-step'))
    expect(stepsOnScreen).toHaveLength(0)
  })

  it('prints the fifteen columns of the result table with the values of the evaluation', () => {
    evaluateAndOpenResult()

    // One table on the result screen, and the same table on the paper beside it: two tables, one set
    // of values, because both are printed from the one report model.
    expect(resultTables()).toHaveLength(2)
    expect(rowOf(only(resultTables()[0], 'result table'))).toEqual(TRANSITION_ROW)
    expect(rowOf(only(resultTables()[1], 'document table'))).toEqual(TRANSITION_ROW)
  })

  it('shows the document beside the result as soon as the six gates are satisfied', () => {
    const area = evaluateAndOpenResult()

    // Nothing to click past: the gates are satisfied, so the pane on the right holds the document.
    expect(generateButton().disabled).toBe(false)
    expect(reportDocument()).not.toBeNull()
    expect(within(area).queryAllByText('Report appears here when all six gates are satisfied.')).toEqual([])

    // It is the document `Generate report` stamps, not a summary of it: the same fifteen columns.
    expect(rowOf(only(resultTables()[1], 'document table'))).toEqual(rowOf(only(resultTables()[0], 'result table')))
    expect(within(only(reportDocument(), 'report document')).getAllByText('PASS').length).toBeGreaterThan(0)

    // And it goes away with the evaluation it was built from: a stale result shows the empty sheet.
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.change(observationField(/^ΔL — Additional load/), { target: { value: '1.5' } })
    const stale = openResultArea()
    expect(reportDocument()).toBeNull()
    expect(within(stale).getByText('Report appears here when all six gates are satisfied.')).toBeTruthy()
  })

  it('generates the report document, and the document prints what the screen showed', () => {
    evaluateAndOpenResult()
    const screenRow = rowOf(only(resultTables()[0], 'result table'))
    generateReport()

    const document = only(reportDocument(), 'report document')

    // Title, header lines and the six sections.
    expect(within(document).getByRole('heading', { level: 2 }).textContent).toBe(
      'R-76 Weighing Performance Evaluation — Prototype',
    )
    expect(fact(document, 'Accuracy Class')).toBe('Class III')
    expect(fact(document, 'Evaluation Type')).toBe('Initial verification')
    expect(fact(document, 'Instrument')).toContain('Max = 2 kg / 5 kg / 15 kg')
    expect(fact(document, 'Test performed')).toBe('Weighing test — evaluation of error at a changeover point')
    expect(fact(document, 'Observation')).toBe('L = 2000 g · I = 2000 g · ΔL = 1.4 g · I_next = 2002 g · E₀ = +0.5 g')
    expect(fact(document, 'Generated')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    for (const heading of [
      'A. Instrument identification',
      'B. Test observation',
      'C. Resolved metrological context',
      'D. Calculation',
      'E. Compliance',
      'F. Technical reference',
    ]) {
      expect(within(document).getByRole('heading', { name: heading })).toBeTruthy()
    }

    // The document’s own result table is the result view’s table, value for value.
    expect(resultTables()).toHaveLength(2)
    expect(rowOf(only(resultTables()[1], 'document table'))).toEqual(screenRow)
    expect(rowOf(only(resultTables()[1], 'document table'))).toEqual(TRANSITION_ROW)

    // Section A carries the ranges and their intervals; section D the calculation and the trace.
    expect(document.textContent).toContain('Min₂ = 2 kg')
    expect(document.textContent).toContain('e₂ = 2 g')
    expect(document.textContent).toContain('n₃ = 1,500')
    expect(
      within(document)
        .getAllByRole('listitem')
        .filter((item) => item.className.includes('trace-step')),
    ).toHaveLength(10)

    // Section E: the verdict, its comparison, and what the evaluation does not cover.
    expect(document.textContent).toContain('|Ec| = 0.9 g ≤ mpe = 1 g — margin 0.1 g')
    expect(document.textContent).toContain('Repeatability (§3.6.1) and eccentric loading (§3.6.2)')

    // Section F: the clauses used, with the §3.6 quote behind the single-result comparison.
    expect(document.textContent).toContain('A.4.4.3')
    expect(document.textContent).toContain('Table 6')
    expect(document.textContent).toContain(
      'the error of any single weighing result shall by itself not exceed the maximum permissible error',
    )
    const references = referenceText(document)
    expect(references).toContain('A.4.4.3')
    expect(references).toContain('Table 6')
    expect(references).toContain('§3.6')
    // Clauses this build does not apply are disclosed in section D, but never cited in section E.
    expect(references).not.toContain('3.5.2')
    expect(references).not.toContain('3.6.1')
    expect(references).not.toContain('3.6.2')
    expect(references).not.toContain('A.4.4.1')
  })

  it('says plainly that the document is not a certificate, and claims no authority', () => {
    evaluateAndOpenResult()
    generateReport()
    const text = only(reportDocument(), 'report document').textContent ?? ''

    expect(text).toContain('Prototype output — not a certificate')
    expect(text).toContain('not an OIML certificate')
    expect(text).toContain('not a government or statutory approval')
    expect(text).toContain('not a legal metrology certificate')
    expect(text).toContain('competent legal metrology authority')
    expect(text).toContain('is not recorded in this prototype')

    for (const claim of [
      'Certificate of',
      'Certified',
      'certified',
      'legally binding',
      'official certificate',
      'Government of India',
      'Smart India Hackathon',
      'SIH',
      'Taraazu',
    ]) {
      expect(text).not.toContain(claim)
    }
  })

  it('offers no third verdict: the document says PASS or FAIL and nothing between them', () => {
    evaluateAndOpenResult()
    generateReport()
    const document = only(reportDocument(), 'report document')
    const text = (document.textContent ?? '').toUpperCase()

    // Every verdict the document shows is one of the two legal words.
    const words = within(document)
      .getAllByText(/^(PASS|FAIL)$/, { selector: '.verdict-word' })
      .map((element) => element.textContent)
    expect(words.length).toBeGreaterThan(0)
    expect(words.every((word) => word === 'PASS' || word === 'FAIL')).toBe(true)

    for (const thirdState of [
      'CONDITIONAL',
      'MARGINAL',
      'QUALIFIED',
      'TENTATIVE',
      'PROVISIONAL',
      'CONFIDENCE',
      'PROBABLE',
      'ACCEPTABLE WITH',
    ]) {
      expect(text).not.toContain(thirdState)
    }

    // “Grey zone” and “uncertainty” occur only where the report discloses that it does not model
    // them — never as an outcome of this evaluation.
    const disclosures = within(document).queryAllByText(/grey zone|uncertainty/i)
    expect(disclosures.length).toBeGreaterThan(0)
    expect(disclosures.every((element) => element.className.includes('resolution-note'))).toBe(true)
  })

  it('sends the document alone to the browser’s print dialog', () => {
    if (typeof window.print !== 'function') {
      vi.stubGlobal('print', () => {})
    }
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})

    evaluateAndOpenResult()
    expect(screen.queryByRole('button', { name: 'Print / save as PDF' })).toBeNull()

    generateReport()
    fireEvent.click(screen.getByRole('button', { name: 'Print / save as PDF' }))
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('reports FAIL, on screen and in the document, when |Ec| is outside the limit', () => {
    validateConfiguration()
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.change(observationField(/^ΔL — Additional load/), { target: { value: '1.6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    openResultArea()

    expect(rowOf(only(resultTables()[0], 'result table')).Result).toBe('FAIL')
    expect(screen.getByRole('status').textContent).toContain('FAIL')

    generateReport()
    const document = only(reportDocument(), 'report document')
    expect(rowOf(only(resultTables()[1], 'document table')).Result).toBe('FAIL')
    expect(document.textContent).toContain('1.1 g > mpe = 1 g')
    expect(document.textContent).toContain('excess 0.1 g')
  })

  it('reports PASS at the limit itself, with no rounding and no margin invented', () => {
    validateConfiguration()
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.change(observationField(/^ΔL — Additional load/), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    openResultArea()
    generateReport()

    const document = only(reportDocument(), 'report document')
    expect(rowOf(only(resultTables()[1], 'document table'))).toEqual({ ...TRANSITION_ROW, ΔL: '1.5', P: '1999.5', E: '−0.5', 'Ec': '−1' })
    expect(document.textContent).toContain('|Ec| = 1 g ≤ mpe = 1 g — margin 0 g (exactly at the limit, which is inside it)')
  })

  it('blocks the report when E₀ is missing, from the test area all the way to the document', () => {
    validateConfiguration()
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.change(observationField(/^E₀ — Zero error/), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))

    // The test area itself refuses: no verdict, and the reason named.
    expect(screen.queryByRole('status', { name: 'Verdict' })).toBeNull()
    expect(screen.queryAllByText(/Cannot evaluate: E0 is required/).length).toBeGreaterThan(0)

    const area = openResultArea()
    expect(within(area).getByText('REPORT NOT READY')).toBeTruthy()
    expect(within(area).getByText(/The evaluation is not complete, so no report is generated/)).toBeTruthy()
    expect(hasText(area, /Incomplete — E₀ is missing\./)).toBe(true)
    expect(hasText(area, /E0 is required/)).toBe(true)
    expect(generateButton().disabled).toBe(true)
    expect(reportDocument()).toBeNull()
    expect(resultTables()).toEqual([])
    expect(within(area).queryAllByText('PASS')).toEqual([])
    expect(within(area).queryAllByText('FAIL')).toEqual([])
    // Nothing half-filled: the document’s sections do not exist at all.
    expect(screen.queryByRole('heading', { name: 'A. Instrument identification' })).toBeNull()
  })

  it('blocks the report when I_next is not an indication the instrument can display', () => {
    validateConfiguration()
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.change(observationField(/^I_next — Next indication/), { target: { value: '2005' } })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    expect(screen.queryByRole('status', { name: 'Verdict' })).toBeNull()

    const area = openResultArea()
    expect(within(area).getByText('REPORT NOT READY')).toBeTruthy()
    expect(hasText(area, /Invalid next indication/)).toBe(true)
    expect(hasText(area, /range_I_next \/ e\* was not resolved/)).toBe(true)
    expect(generateButton().disabled).toBe(true)
    expect(reportDocument()).toBeNull()
    expect(resultTables()).toEqual([])
  })

  it('blocks the report when I_next is displayable but is not one scale interval above I', () => {
    validateConfiguration()
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.change(observationField(/^I_next — Next indication/), { target: { value: '2004' } })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))

    const area = openResultArea()
    expect(within(area).getByText('REPORT NOT READY')).toBeTruthy()
    expect(hasText(area, /one scale interval/)).toBe(true)
    expect(reportDocument()).toBeNull()
  })

  it('drops a generated document when the observation changes, and regenerates it from the new one', () => {
    evaluateAndOpenResult()
    generateReport()
    expect(reportDocument()).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.change(observationField(/^ΔL — Additional load/), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: RESULT_AREA }))

    // The document belonged to the previous evaluation: it is gone, and the area says why.
    expect(reportDocument()).toBeNull()
    expect(screen.getByText('REPORT NOT READY')).toBeTruthy()
    expect(screen.getByText(/No observation has been evaluated yet/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    fireEvent.click(screen.getByRole('button', { name: RESULT_AREA }))
    // A new evaluation is a new result: the document stamped from the old one is gone, and what the
    // pane shows is built from the new evaluation — ΔL 1.5, not the 1.4 it was generated from.
    expect(rowOf(only(resultTables()[0], 'result table')).ΔL).toBe('1.5')
    expect(rowOf(only(resultTables()[1], 'document table')).ΔL).toBe('1.5')

    generateReport()
    expect(rowOf(only(resultTables()[1], 'document table')).ΔL).toBe('1.5')
  })

  it('drops a generated document when the instrument is edited, because the evaluation is stale', () => {
    evaluateAndOpenResult()
    generateReport()
    expect(reportDocument()).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: CONFIGURATION_AREA }))
    fireEvent.change(observationField(/^Range 1 maximum capacity Max₁/), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    expect(screen.getByText('Configuration valid')).toBeTruthy()

    const area = openResultArea()
    expect(reportDocument()).toBeNull()
    expect(within(area).getByText('REPORT NOT READY')).toBeTruthy()
    expect(hasText(area, /performed against a different instrument configuration/)).toBe(true)
    expect(generateButton().disabled).toBe(true)
  })

  it('keeps the result and the report of one evaluation across the three areas', () => {
    evaluateAndOpenResult()
    generateReport()

    fireEvent.click(screen.getByRole('button', { name: CONFIGURATION_AREA }))
    expect(screen.getByText('Configuration valid')).toBeTruthy()
    expect(reportDocument()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    expect(screen.getByRole('heading', { name: 'Digital Weighing Test' })).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Verdict' }).textContent).toContain('PASS')

    fireEvent.click(screen.getByRole('button', { name: RESULT_AREA }))
    expect(rowOf(only(resultTables()[0], 'result table'))).toEqual(TRANSITION_ROW)
  })
})
