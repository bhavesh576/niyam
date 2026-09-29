// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'

/**
 * Interaction test for the Phase 3 screen area: R-76 DIGITAL WEIGHING TEST.
 *
 * It walks the screen the way a tester does — open the area, check the instrument under test, check
 * the pre-filled observation of the §3.3.3 transition, press Evaluate, read the ranges, the
 * calculation and the verdict — and then breaks one input at a time to see that the screen refuses
 * to calculate instead of guessing. Values are read from named table rows so that a number shown in
 * the ranges table cannot be confused with the same number in the calculation or the trace.
 */

const TEST_AREA = 'Digital weighing test'
const CONFIGURATION_AREA = 'Instrument configuration'
const RESULT_AREA = 'Test result and report'

describe('the three work areas', () => {
  afterEach(cleanup)

  it('opens on the instrument configuration, with the test and the result area one click away', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Instrument Configuration' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Digital Weighing Test' })).toBeNull()

    const nav = screen.getByRole('navigation', { name: 'Work areas' })
    expect(within(nav).getAllByRole('button').map((button) => button.textContent)).toEqual([
      CONFIGURATION_AREA,
      TEST_AREA,
      RESULT_AREA,
    ])
    expect(within(nav).getByRole('button', { name: CONFIGURATION_AREA }).getAttribute('aria-current')).toBe('true')
  })

  it('switches to the test screen and back without losing the validated configuration', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    expect(screen.getByText('Configuration valid')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    expect(screen.getByRole('heading', { name: 'Digital Weighing Test' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Instrument Configuration' })).toBeNull()
    // The test screen evaluates the instrument that was just validated, not a fresh empty form: the
    // strip at the top of the screen carries the validated range model, and nothing else.
    expect(screen.getByText('Instrument under test')).toBeTruthy()
    expect(screen.getByText('Class III — multi-interval')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: CONFIGURATION_AREA }))
    expect(screen.getByText('Configuration valid')).toBeTruthy()
    expect(screen.getByText('Range Probe')).toBeTruthy()
  })

  it('asks for a validated instrument before it evaluates anything', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))

    expect(screen.getByText(/No validated instrument yet/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Evaluate' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open the instrument configuration' }))
    expect(screen.getByRole('heading', { name: 'Instrument Configuration' })).toBeTruthy()
  })

  it('keeps the configuration area free of any verdict', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))

    expect(screen.queryAllByText('PASS')).toEqual([])
    expect(screen.queryAllByText('FAIL')).toEqual([])
    expect(screen.queryByRole('status', { name: 'Verdict' })).toBeNull()
    expect(screen.queryByText(/A\.4\.4\.3 calculation/)).toBeNull()
  })
})

describe('R-76 digital weighing test', () => {
  afterEach(cleanup)

  /** Renders the app, validates the §3.3.3 example and opens the test area. */
  function openTest() {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    return screen.getByRole('region', { name: 'Digital Weighing Test' })
  }

  function evaluate() {
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
  }

  function observation(name: RegExp): HTMLInputElement {
    return screen.getByRole('textbox', { name }) as HTMLInputElement
  }

  const load = () => observation(/^L — Test load/)
  const indication = () => observation(/^I — Indication/)
  const additionalLoad = () => observation(/^ΔL — Additional load/)
  const nextIndication = () => observation(/^I_next — Next indication/)
  const zeroError = () => observation(/^E₀ — Zero error/)

  /** The value of one row of the load-side resolution table, addressed through its exact row header. */
  function loadRow(header: string) {
    const table = screen.getByRole('table', { name: /Load side of the resolution/ })
    return within(table).getByRole('rowheader', { name: header }).nextElementSibling?.textContent ?? ''
  }

  /** The value of one row of the indication-side resolution table, addressed through its exact header. */
  function indicationRow(header: string) {
    const table = screen.getByRole('table', { name: /Indication side of the resolution/ })
    return within(table).getByRole('rowheader', { name: header }).nextElementSibling?.textContent ?? ''
  }

  function calculationRow(formula: string) {
    const table = screen.getByRole('table', { name: /A\.4\.4\.3 calculation/ })
    const cells = within(table).getAllByRole('cell')
    const row = within(table).getByRole('rowheader', { name: formula }).parentElement
    return { row: row?.textContent ?? '', cells }
  }

  /**
   * The verdict banner, addressed by its accessible name: the words PASS and FAIL also appear in the
   * calculation table, so the banner has to be read as the element it is.
   */
  /** The resolution tables, or `null` while nothing has been evaluated. */
  function limitRowQuery() {
    return screen.queryByRole('table', { name: /Load side of the resolution/ })
  }

  function verdict(): string | null {
    const banner = screen.queryByRole('status', { name: 'Verdict' })
    return banner === null ? null : banner.textContent
  }

  function traceSteps() {
    return screen.getAllByRole('listitem').filter((item) => item.className.includes('trace-step'))
  }

  it('names the instrument under test with its class, type and weighing range', () => {
    openTest()

    // The strip is read-only context, so it is not a table and not a list: before Evaluate there is
    // nothing on this screen that could be mistaken for a result.
    const strip = screen.getByText('Instrument under test').closest('.instrument-strip')
    if (strip === null) throw new Error('no instrument strip')

    expect(strip.textContent).toContain('Class III — multi-interval')
    expect(strip.textContent).toContain('Min 20 g → Max 15 kg')
    expect(strip.textContent).toContain('d = e₁ = 1 g')
    // One chip per partial weighing range, wrapping: number · span · interval, with nᵢ in its title.
    expect(strip.textContent).toContain('20 g → 2 kg')
    expect(strip.textContent).toContain('2 kg → 5 kg')
    expect(strip.textContent).toContain('5 kg → 15 kg')
    expect(strip.textContent).toContain('e₂ = 2 g')
    expect(screen.getByTitle('Range 2 · n₂ = 2,500')).toBeTruthy()
    expect(screen.queryByRole('table', { name: /Instrument under test/ })).toBeNull()
  })

  it('is pre-filled with the observation of the §3.3.3 transition, in the units it is read in', () => {
    openTest()

    expect(load().value).toBe('2')
    expect(indication().value).toBe('2000')
    expect(additionalLoad().value).toBe('1.4')
    expect(nextIndication().value).toBe('2002')
    expect(zeroError().value).toBe('0.5')

    expect((screen.getByRole('combobox', { name: 'Unit for Test load L' }) as HTMLSelectElement).value).toBe('kg')
    expect((screen.getByRole('combobox', { name: 'Unit for Additional load ΔL' }) as HTMLSelectElement).value).toBe('g')
    expect((screen.getByRole('combobox', { name: 'Unit for Zero error E₀' }) as HTMLSelectElement).value).toBe('g')
  })

  it('says that E₀ is entered by the tester and never derived here', () => {
    openTest()

    expect(
      screen.getByText(
        /required, signed — determined at zero or near zero by the same procedure \(A\.4\.2\.3\), never derived here/,
      ),
    ).toBeTruthy()
  })

  it('calculates nothing before Evaluate is pressed', () => {
    openTest()

    expect(screen.getByText(/No result yet\./)).toBeTruthy()
    expect(verdict()).toBeNull()
    expect(screen.queryByRole('table', { name: /A\.4\.4\.3 calculation/ })).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('shows all three ranges and both intervals for the transition observation', () => {
    openTest()
    evaluate()

    // One line with everything the transition turns on: two different ranges, two different intervals.
    expect(
      screen.getByText('range_L = range 1 · range_I = range 1 · range_I_next = range 2 · e_L = 1 g · e* = 2 g'),
    ).toBeTruthy()

    // Load side: the range the load falls in, its interval, m, the Table 6 bracket and the limit. The
    // rows are named with the symbols the calculation uses — range_L, e_L, m — and each row is looked
    // up by its exact header, because 'range_I' is a prefix of 'range_I_next'.
    expect(loadRow('range_L')).toBe('Range 1 (20 g → 2 kg)')
    expect(loadRow('e_L')).toBe('e₁ = 1 g')
    expect(loadRow('m = L / e_L')).toContain('2,000')
    expect(loadRow('Table 6')).toBe('500 < m ≤ 2 000 → ± 1.0 e')
    expect(loadRow('MPE')).toContain('± 1 g')
    // Which limit this is — initial verification, class III — is stated once, in the head of the
    // section both tables belong to, instead of being repeated inside the cell.
    expect(screen.getByText(/initial verification · class III/)).toBeTruthy()

    // Indication side: the two ranges the indications fall in, and the changeover interval e*.
    expect(indicationRow('range_I')).toContain('Range 1 (20 g → 2 kg)')
    expect(indicationRow('range_I_next')).toContain('Range 2 (2 kg → 5 kg)')
    expect(indicationRow('e*')).toBe('e₂ = 2 g')
    // The full sentence — e* is the interval of the range in which (I + e) appears — is the cell's
    // title, so the row stays one line of 22 px and the reason is still one hover away.
    expect(
      screen.getByTitle(
        'e* = e₂ = 2 g — the scale interval of partial weighing range 2, in which the indication (I + e) appears',
      ),
    ).toBeTruthy()

    // The point of the split: e_L and e* are two different intervals at a changeover, and the screen
    // keeps them apart instead of showing one “e”.
    expect(loadRow('e_L')).not.toBe(indicationRow('e*'))
    expect(screen.getByRole('table', { name: /Load side of the resolution/ })).toBeTruthy()
    expect(screen.getByRole('table', { name: /Indication side of the resolution/ })).toBeTruthy()
  })

  it('prints the calculation with the substitution A.4.4.3 uses, ½ e* and not ½ e_L', () => {
    openTest()
    evaluate()

    const p = calculationRow('P = I + ½e* − ΔL')
    expect(p.row).toContain('P = (2000 + 1 − 1.4) g')
    expect(p.row).toContain('= 1999.6 g')
    expect(p.row).not.toContain('1999.1') // what ½ e_L = 0.5 g would have given

    expect(calculationRow('E = P − L').row).toContain('E = (1999.6 − 2000) g')
    expect(calculationRow('E = P − L').row).toContain('= −0.4 g')
    expect(calculationRow('Ec = E − E₀').row).toContain('Ec = (−0.4 − (+0.5)) g')
    expect(calculationRow('Ec = E − E₀').row).toContain('= −0.9 g')
    expect(calculationRow('|Ec| ≤ mpe').row).toContain('|−0.9| g = 0.9 g ≤ 1 g')
    expect(calculationRow('|Ec| ≤ mpe').row).toContain('PASS')
  })

  it('gives the verdict with the comparison it made', () => {
    openTest()
    evaluate()

    expect(verdict()).toBe('PASS|Ec| = 0.9 g ≤ mpe = 1 g — margin 0.1 g')
    expect(screen.getByText(/The mpe in service \(§3\.5\.2, twice this limit\)/)).toBeTruthy()
    expect(screen.getByText(/no uncertainty band or grey zone is evaluated/)).toBeTruthy()
  })

  it('shows the ten steps of the calculation trace, in order', () => {
    openTest()
    evaluate()

    const steps = traceSteps()
    expect(steps).toHaveLength(10)
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining('Load range resolved'),
      expect.stringContaining('Load verification interval resolved'),
      expect.stringContaining('MPE resolved'),
      expect.stringContaining('Indication range resolved'),
      expect.stringContaining('Next indication range resolved'),
      expect.stringContaining('e* resolved'),
      expect.stringContaining('P calculated'),
      expect.stringContaining('E calculated'),
      expect.stringContaining('E₀ correction applied'),
      expect.stringContaining('Ec compared with MPE'),
    ])
    expect(steps[0].textContent).toContain('L = 2000 g → Range 1 (20 g → 2 kg)')
    expect(steps[5].textContent).toContain('e* = e₂ = 2 g')
    expect(steps[9].textContent).toContain('→ PASS')
    expect(steps[9].textContent).toContain('A.4.4.3, §3.5.1 Table 6')
    expect(screen.getByText(/10 of 10 steps completed/)).toBeTruthy()
  })

  it('reports FAIL when ΔL puts the corrected error outside the limit', () => {
    openTest()
    fireEvent.change(additionalLoad(), { target: { value: '1.6' } })
    evaluate()

    expect(verdict()).toBe('FAIL|Ec| = 1.1 g > mpe = 1 g — excess 0.1 g')
    expect(screen.queryAllByText('PASS')).toEqual([])
    expect(calculationRow('P = I + ½e* − ΔL').row).toContain('P = (2000 + 1 − 1.6) g')
    expect(traceSteps()[9].textContent).toContain('→ FAIL')
  })

  it('refuses to evaluate without I_next and shows where the trace stopped', () => {
    openTest()
    fireEvent.change(nextIndication(), { target: { value: '' } })
    evaluate()

    expect(screen.getByRole('heading', { name: 'Not evaluated' })).toBeTruthy()
    // The message appears beside the field and again in the trace, at the step that stopped.
    expect(screen.getAllByText('I_next is required for the digital changeover calculation.').length).toBeGreaterThan(1)
    expect(verdict()).toBeNull()
    expect(screen.queryAllByText('PASS')).toEqual([])
    expect(screen.queryAllByText('FAIL')).toEqual([])
    expect(screen.queryByRole('table', { name: /A\.4\.4\.3 calculation/ })).toBeNull()

    const steps = traceSteps()
    expect(steps).toHaveLength(10)
    expect(screen.getByText(/4 of 10 steps completed/)).toBeTruthy()
    expect(steps[4].className).toContain('incomplete')
    expect(steps[4].textContent).toContain('I_next is required for the digital changeover calculation.')
    expect(steps[6].textContent).toContain('not calculated — the evaluation was blocked before this step')
  })

  it('refuses a next indication the instrument cannot display, and does not correct it', () => {
    openTest()
    fireEvent.change(nextIndication(), { target: { value: '2001' } })
    evaluate()

    expect(screen.getByRole('heading', { name: 'Not evaluated' })).toBeTruthy()

    // The message beside the field and in the result panel is the Phase 2 rejection, unchanged.
    const messages = screen.getAllByText(/Invalid next indication/)
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0].textContent).toContain('e₂ = 2 g')
    expect(messages[0].textContent).toContain('2001 g is not a multiple of 2 g')

    // The detail under it names what was observed and what the instrument could display — and says
    // plainly that the entered value stands.
    const details = screen.getAllByText(/not rounded, corrected or replaced/)
    expect(details.length).toBeGreaterThan(0)
    expect(details[0].textContent).toContain('the observed next indication is I + e₂ = 2000 g + 2 g = 2002 g')
    expect(details[0].textContent).toContain('the nearest indications this instrument could display')

    // The value in the field is still the one that was typed.
    expect(nextIndication().value).toBe('2001')
    expect(verdict()).toBeNull()
    expect(limitRowQuery()).toBeNull()
  })

  it('refuses a negative ΔL without negating it', () => {
    openTest()
    fireEvent.change(additionalLoad(), { target: { value: '-1.4' } })
    evaluate()

    expect(screen.getByRole('heading', { name: 'Not evaluated' })).toBeTruthy()
    expect(screen.getAllByText(/is negative/)[0].textContent).toContain('the additional load cannot be below zero')
    expect(additionalLoad().value).toBe('-1.4')
    expect(traceSteps()[6].textContent).toContain('is negative')
  })

  it('refuses to evaluate without E₀, and evaluates with E₀ = 0', () => {
    openTest()
    fireEvent.change(zeroError(), { target: { value: '' } })
    evaluate()

    // Once beside the E₀ field, once in the trace at the step the correction belongs to.
    expect(screen.getAllByText('Cannot evaluate: E0 is required for corrected error Ec.').length).toBeGreaterThan(1)
    expect(verdict()).toBeNull()

    fireEvent.change(zeroError(), { target: { value: '0' } })
    evaluate()
    expect(verdict()).toContain('PASS')
    expect(calculationRow('Ec = E − E₀').row).toContain('= −0.4 g')
  })

  it('refuses a load outside the weighing range', () => {
    openTest()
    fireEvent.change(load(), { target: { value: '20' } }) // 20 kg > Max = 15 kg
    evaluate()

    expect(screen.getByRole('heading', { name: 'Not evaluated' })).toBeTruthy()
    expect(screen.getAllByText(/L is above the weighing range/)[0].textContent).toContain('20 kg')
    expect(verdict()).toBeNull()
  })

  it('drops the result as soon as a field is edited', () => {
    openTest()
    evaluate()
    expect(verdict()).toContain('PASS')

    fireEvent.change(additionalLoad(), { target: { value: '1.6' } })

    expect(verdict()).toBeNull()
    expect(screen.getByText(/No result yet\./)).toBeTruthy()
  })

  it('does not show a result that was calculated for a different instrument', () => {
    openTest()
    evaluate()
    expect(verdict()).toContain('PASS')

    // Change the instrument: Max₁ = 3 kg instead of 2 kg — still a valid class III configuration,
    // but 2 002 g now lies inside partial weighing range 1, where the changeover step must be 1 g.
    fireEvent.click(screen.getByRole('button', { name: CONFIGURATION_AREA }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Range 1 maximum capacity Max₁' }), {
      target: { value: '3' },
    })
    expect(screen.getByText('Configuration valid')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))

    // The PASS that belongs to the instrument as it was is not shown again.
    expect(screen.getByText(/The instrument under test has changed since this observation was evaluated/)).toBeTruthy()
    expect(verdict()).toBeNull()
    expect(screen.queryByRole('table', { name: /A\.4\.4\.3 calculation/ })).toBeNull()

    // Evaluating again evaluates against the instrument as it is now — with a different outcome.
    evaluate()
    expect(screen.getByRole('heading', { name: 'Not evaluated' })).toBeTruthy()
    expect(screen.getAllByText(/is not one scale interval/)[0].textContent).toContain('e* = 1 g')
  })

  it('restores the transition example with the reset button', () => {
    openTest()
    fireEvent.change(additionalLoad(), { target: { value: '1.6' } })
    fireEvent.change(zeroError(), { target: { value: '0.6' } })
    evaluate()
    // P = 1999.4 g, E = −0.6 g, Ec = −1.2 g → outside ± 1 g
    expect(verdict()).toBe('FAIL|Ec| = 1.2 g > mpe = 1 g — excess 0.2 g')

    fireEvent.click(screen.getByRole('button', { name: 'Reset to transition example' }))

    expect(additionalLoad().value).toBe('1.4')
    expect(zeroError().value).toBe('0.5')
    expect(verdict()).toBeNull()
    expect(screen.getByText(/No result yet\./)).toBeTruthy()
  })

  it('keeps the observation when the work area is changed and changed back', () => {
    openTest()
    fireEvent.change(additionalLoad(), { target: { value: '1.6' } })

    fireEvent.click(screen.getByRole('button', { name: CONFIGURATION_AREA }))
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))

    expect(additionalLoad().value).toBe('1.6')
  })

  it('lists the clauses the evaluation rests on', () => {
    openTest()
    evaluate()

    const region = screen.getByRole('region', { name: 'Digital Weighing Test' })
    const references = Array.from(region.querySelectorAll('.trace-reference')).map((node) => node.textContent ?? '')

    expect(references.length).toBeGreaterThan(4)
    expect(references.join(' | ')).toContain('OIML R 76-1:2006')
    expect(references.join(' | ')).toContain('A.4.4.3')
    expect(references.join(' | ')).toContain('Table 6')
    // Every clause the evaluation rests on is named on screen; the quoted text behind them is kept
    // in docs/r76-verified-extracts.md.
    expect(references.join(' | ')).toContain('§3.5.1')
    expect(references.join(' | ')).toContain('A.4.2.3')
  })
})
