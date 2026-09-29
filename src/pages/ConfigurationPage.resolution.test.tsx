// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'

/**
 * Interaction test for the Phase 2 screen area: a validated configuration -> the test load
 * resolution panel -> ranges, applicable intervals, m = L / e, the Table 6 bracket and the mpe ->
 * the boundary table with all probe loads.
 *
 * Assertions read the rendered text of a specific table row (addressed through its row header) so
 * that a value shown in the resolution table cannot be confused with the same value appearing in
 * the boundary table.
 */
describe('test load resolution panel', () => {
  afterEach(cleanup)

  function validate() {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    expect(screen.getByText('Configuration valid')).toBeTruthy()
  }

  function loadInput(): HTMLInputElement {
    return screen.getByRole('textbox', { name: /^L — Test load/ }) as HTMLInputElement
  }

  function loadUnit(): HTMLSelectElement {
    return screen.getByRole('combobox', { name: 'Unit for Test load L' }) as HTMLSelectElement
  }

  function nextIndicationInput(): HTMLInputElement {
    return screen.getByRole('textbox', { name: /^I_next — Next indication/ }) as HTMLInputElement
  }

  it('appears only once the configuration has been validated', () => {
    render(<App />)
    expect(screen.queryByText('Range Probe')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    expect(screen.getByText('Range Probe')).toBeTruthy()
  })

  it('disappears again when the configuration becomes invalid', () => {
    validate()
    expect(screen.getByText('Range Probe')).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox', { name: /^Min — Minimum capacity/ }), {
      target: { value: '5' },
    })

    expect(screen.getByText('Configuration invalid')).toBeTruthy()
    expect(screen.queryByText('Range Probe')).toBeNull()
  })

  it('states that it resolves limits only and gives no verdict', () => {
    validate()

    expect(
      screen.getByText(
        /No error of indication is calculated and no verdict is given in this panel/,
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/PASS/i)).toBeNull()
    expect(screen.queryByText(/FAIL/i)).toBeNull()
  })

  it('resolves the pre-filled test load L = Max₁ = 2 kg of the R-76 example', () => {
    validate()

    expect(loadInput().value).toBe('2')
    expect(resolutionValue(/^Test load L/)).toBe('2 kg')

    expect(resolutionValue(/Partial weighing range of L/)).toBe('Range 1 (20 g → 2 kg)')
    expect(resolutionValue(/Applicable verification scale interval/)).toBe('e₁ = 1 g')
    expect(resolutionValue(/^m = L \/ e/)).toBe('m = L / e₁ = 2,000')
    expect(resolutionValue(/Table 6 bracket/)).toBe('500 < m ≤ 2 000 → ± 1.0 e')
    expect(resolutionValue(/Maximum permissible error/)).toBe('± 1 g (± 1.0 e₁)')
  })

  it('resolves the indication and the next indication into their own ranges, with e* from I_next', () => {
    validate()

    expect(resolutionValue(/^Indication I/)).toContain('Range 1 (20 g → 2 kg)')
    expect(resolutionValue(/^Indication I/)).toContain('e₁ = 1 g')
    expect(resolutionValue(/^Next indication I_next/)).toContain('Range 2 (2 kg → 5 kg)')
    expect(resolutionValue(/^Next indication I_next/)).toContain('e₂ = 2 g')

    const intervals = resolutionValue(/^e_L and e\*/)
    expect(intervals).toContain('e_L = 1 g')
    expect(intervals).toContain('e* = 2 g')
    expect(intervals).toContain('resolved from I_next alone')
    expect(intervals).toContain('differs from e_L')
  })

  it('flags the load that sits exactly on a range boundary instead of hiding it', () => {
    validate()

    const notes = screen.getAllByText(/sits exactly on Max₁/)
    expect(notes.length).toBeGreaterThan(0)
    expect(notes[0].textContent).toContain('2 000 g → ± 1 e₁')
  })

  it('resolves a load typed in the third partial weighing range', () => {
    validate()

    fireEvent.change(loadInput(), { target: { value: '10' } }) // 10 kg, unit stays kg

    expect(resolutionValue(/^Test load L/)).toContain('10 kg')
    expect(resolutionValue(/Partial weighing range of L/)).toBe('Range 3 (5 kg → 15 kg)')
    expect(resolutionValue(/Applicable verification scale interval/)).toBe('e₃ = 10 g')
    expect(resolutionValue(/^m = L \/ e/)).toBe('m = L / e₃ = 1,000')
    expect(resolutionValue(/Table 6 bracket/)).toBe('500 < m ≤ 2 000 → ± 1.0 e')
    expect(resolutionValue(/Maximum permissible error/)).toBe('± 10 g (± 1.0 e₃)')
  })

  it('resolves the same load entered in grams identically', () => {
    validate()

    fireEvent.change(loadUnit(), { target: { value: 'g' } })
    fireEvent.change(loadInput(), { target: { value: '10000' } })

    expect(resolutionValue(/Partial weighing range of L/)).toBe('Range 3 (5 kg → 15 kg)')
    expect(resolutionValue(/Applicable verification scale interval/)).toBe('e₃ = 10 g')
    expect(resolutionValue(/Maximum permissible error/)).toBe('± 10 g (± 1.0 e₃)')
  })

  it('reports a load below Min without falling back to e₁', () => {
    validate()

    fireEvent.change(loadUnit(), { target: { value: 'g' } })
    fireEvent.change(loadInput(), { target: { value: '10' } })

    expect(resolutionValue(/Partial weighing range of L/)).toBe('below the weighing range (10 g)')
    expect(resolutionValue(/Applicable verification scale interval/)).toContain('no applicable e')
    expect(resolutionValue(/Applicable verification scale interval/)).not.toContain('e₁')
    expect(resolutionValue(/^m = L \/ e/)).toBe('—')
    expect(resolutionValue(/Maximum permissible error/)).toContain('no mpe')

    const notes = screen.getAllByText(/is below Min/)
    expect(notes.length).toBeGreaterThan(0)
    expect(notes[0].textContent).toContain('T.3.1.2')
    expect(notes[0].textContent).toContain('at or near zero, load e = e₁')
  })

  it('reports a load above Max', () => {
    validate()

    fireEvent.change(loadInput(), { target: { value: '20' } }) // 20 kg > Max = 15 kg

    expect(resolutionValue(/Partial weighing range of L/)).toBe('above the weighing range (20 kg)')
    expect(resolutionValue(/Maximum permissible error/)).toContain('no mpe')
  })

  it('reports a cleared test load as missing rather than as zero', () => {
    validate()

    fireEvent.change(loadInput(), { target: { value: '' } })

    expect(resolutionValue(/^Test load L/)).toContain('not entered')
    // The cell is the only place that says the field is required (rendered in upper case by CSS).
    expect(resolutionValue(/^Test load L/)).toContain('required')
    expect(resolutionValue(/Maximum permissible error/)).toContain('no test load L entered')
    expect(screen.getAllByText(/Enter a test load L/).length).toBeGreaterThan(0)
  })

  it('follows I_next into another partial weighing range and updates e*', () => {
    validate()

    fireEvent.change(nextIndicationInput(), { target: { value: '6000' } })

    expect(resolutionValue(/^Next indication I_next/)).toContain('Range 3 (5 kg → 15 kg)')
    expect(resolutionValue(/^e_L and e\*/)).toContain('e* = 10 g')
    // The load has not moved, so e_L and the mpe stay as they were.
    expect(resolutionValue(/Applicable verification scale interval/)).toBe('e₁ = 1 g')
    expect(resolutionValue(/Maximum permissible error/)).toBe('± 1 g (± 1.0 e₁)')
  })
})

describe('boundary table', () => {
  afterEach(cleanup)

  function validate() {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
  }

  it('shows both range changeovers with all three probe positions around 2 kg and 5 kg', () => {
    validate()

    expect(within(probeTable()).getByText('Max₁ = 2 kg (range 1 → range 2)')).toBeTruthy()
    expect(within(probeTable()).getByText('Max₂ = 5 kg (range 2 → range 3)')).toBeTruthy()

    for (const load of ['1.999 kg', '2 kg', '2.002 kg', '4.998 kg', '5 kg', '5.01 kg']) {
      expect(probeCells(load).length).toBeGreaterThan(0)
    }
  })

  it('shows the Table 6 bracket edges inside the partial weighing ranges', () => {
    validate()

    expect(within(probeTable()).getByText('Table 6: m = 500 in range 1 → L = 500 g')).toBeTruthy()
    expect(within(probeTable()).getByText('Table 6: m = 2,000 in range 2 → L = 4 kg')).toBeTruthy()

    for (const load of ['499 g', '500 g', '501 g', '3.998 kg', '4 kg', '4.002 kg']) {
      expect(probeCells(load).length).toBeGreaterThan(0)
    }
  })

  it('shows Min and Max, including the probe loads that fall outside the weighing range', () => {
    validate()

    expect(within(probeTable()).getByText('Min = 20 g')).toBeTruthy()
    expect(within(probeTable()).getByText('Max = Max₃ = 15 kg')).toBeTruthy()
    expect(probeCells('19 g').length).toBeGreaterThan(0)
    expect(probeCells('15.01 kg').length).toBeGreaterThan(0)
    expect(probeCells(/below the weighing range \(19 g\)/).length).toBeGreaterThan(0)
    expect(probeCells(/above the weighing range \(15.01 kg\)/).length).toBeGreaterThan(0)
    expect(probeCells('no applicable e').length).toBeGreaterThan(0)
  })

  it('shows what changes across a changeover', () => {
    validate()

    expect(probeCells(/e changes: e₁ = 1 g → e₂ = 2 g/).length).toBeGreaterThan(0)
    expect(probeCells(/Table 6 bracket changes/).length).toBeGreaterThan(0)
  })

  it('copies a probe load into the test load field and re-resolves it', () => {
    validate()

    fireEvent.click(screen.getByRole('button', { name: 'Use 5.01 kg as the test load' }))

    const loadInput = screen.getByRole('textbox', { name: /^L — Test load/ }) as HTMLInputElement
    expect(loadInput.value).toBe('5010')
    const unit = screen.getByRole('combobox', { name: 'Unit for Test load L' }) as HTMLSelectElement
    expect(unit.value).toBe('g')
    expect(resolutionValue(/Partial weighing range of L/)).toBe('Range 3 (5 kg → 15 kg)')
    expect(resolutionValue(/Applicable verification scale interval/)).toBe('e₃ = 10 g')
    expect(resolutionValue(/^m = L \/ e/)).toBe('m = L / e₃ = 501')
    expect(resolutionValue(/Maximum permissible error/)).toBe('± 10 g (± 1.0 e₃)')
  })
})

/**
 * The two tables of the panel, addressed through their captions (which are their accessible
 * names). Scoping every lookup to one of them keeps a value shown in the resolution table from
 * being confused with the same value in the boundary table.
 */
function resolutionTable(): HTMLElement {
  return screen.getByRole('table', { name: /Chain applied to the test load/ })
}

function probeTable(): HTMLElement {
  return screen.getByRole('table', { name: /Boundary behaviour/ })
}

/** The value cell of one row of the resolution table, addressed by its row header. */
function resolutionValue(headerName: RegExp): string {
  const header = within(resolutionTable()).getByRole('rowheader', { name: headerName })
  const row = header.parentElement
  if (row === null) throw new Error(`no row for ${headerName}`)
  return row.querySelector('td')?.textContent ?? ''
}

/** Every cell of the boundary table that shows exactly `text`. */
function probeCells(text: string | RegExp): HTMLElement[] {
  return within(probeTable()).queryAllByText(text)
}

/**
 * Indication consistency on screen: an indication that the resolved partial weighing range cannot
 * display is rejected at its own field, e* is withheld, and the entered value is left exactly as it
 * was typed. The default example opens on the changeover of the R-76 class III example, where the
 * next indication is (I + e₂) = 2 002 g (A.4.4.3), not 2 001 g.
 */
describe('indication consistency in the panel', () => {
  afterEach(cleanup)

  function validate() {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    expect(screen.getByText('Configuration valid')).toBeTruthy()
  }

  function indicationInput(): HTMLInputElement {
    return screen.getByRole('textbox', { name: /^I — Indication/ }) as HTMLInputElement
  }

  function nextIndicationInput(): HTMLInputElement {
    return screen.getByRole('textbox', { name: /^I_next — Next indication/ }) as HTMLInputElement
  }

  function valueOf(headerName: RegExp): string {
    const header = within(screen.getByRole('table', { name: /Chain applied to the test load/ })).getByRole(
      'rowheader',
      { name: headerName },
    )
    return header.parentElement?.querySelector('td')?.textContent ?? ''
  }

  it('opens on the changeover with a displayable next indication, I_next = I + e₂ = 2 002 g', () => {
    validate()

    expect(indicationInput().value).toBe('2000')
    expect(nextIndicationInput().value).toBe('2002')

    expect(valueOf(/^Indication I/)).toContain('Range 1 (20 g → 2 kg)')
    expect(valueOf(/^Indication I/)).toContain('displayable — multiple of e₁ = 1 g')
    expect(valueOf(/^Next indication I_next/)).toContain('Range 2 (2 kg → 5 kg)')
    expect(valueOf(/^Next indication I_next/)).toContain('displayable — multiple of e₂ = 2 g')
    expect(valueOf(/^e_L and e\*/)).toContain('e* = 2 g')

    const changeover = screen.getAllByText(/I_next − I = 2 g = e₂/)
    expect(changeover.length).toBeGreaterThan(0)
    expect(changeover[0].textContent).toContain('increased unambiguously by one scale interval')
    expect(changeover[0].textContent).toContain('A.4.4.3')

    expect(screen.queryByText(/Invalid next indication/)).toBeNull()
    expect(nextIndicationInput().getAttribute('aria-invalid')).toBeNull()
  })

  it('rejects I_next = 2 001 g at its field, because the resolved range displays in steps of e₂ = 2 g', () => {
    validate()

    fireEvent.change(nextIndicationInput(), { target: { value: '2001' } })

    // The value is left exactly as entered — never rounded to 2 000 g or 2 002 g.
    expect(nextIndicationInput().value).toBe('2001')
    expect(nextIndicationInput().getAttribute('aria-invalid')).toBe('true')

    const messages = screen.getAllByText(/Invalid next indication/)
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0].textContent).toContain('partial weighing range 2')
    expect(messages[0].textContent).toContain('e₂ = 2 g')
    expect(messages[0].textContent).toContain("the instrument's 2 g scale interval")
    expect(messages[0].textContent).toContain('2001 g is not a multiple of 2 g')

    // The explanation names the changeover observation and the nearest displayable indications.
    expect(screen.getAllByText(/I \+ e₂ = 2000 g \+ 2 g = 2002 g/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/not rounded, corrected or replaced/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/A\.4\.4\.3/).length).toBeGreaterThan(0)

    expect(valueOf(/^Next indication I_next/)).toContain('not displayable — not a multiple of e₂ = 2 g')
    expect(valueOf(/^e_L and e\*/)).toContain('e* = not resolved')
    expect(valueOf(/^e_L and e\*/)).toContain('withheld')
    expect(screen.getAllByText(/is rejected as a next indication/).length).toBeGreaterThan(0)

    // The load side is untouched: the mpe still comes from the partial weighing range of L.
    expect(valueOf(/Maximum permissible error/)).toBe('± 1 g (± 1.0 e₁)')
    expect(valueOf(/Applicable verification scale interval/)).toBe('e₁ = 1 g')
  })

  it('accepts the indication again as soon as it follows the 2 g scale interval', () => {
    validate()

    fireEvent.change(nextIndicationInput(), { target: { value: '2001' } })
    expect(screen.getAllByText(/Invalid next indication/).length).toBeGreaterThan(0)

    fireEvent.change(nextIndicationInput(), { target: { value: '2002' } })
    expect(screen.queryByText(/Invalid next indication/)).toBeNull()
    expect(nextIndicationInput().getAttribute('aria-invalid')).toBeNull()
    expect(valueOf(/^e_L and e\*/)).toContain('e* = 2 g')
  })

  it('rejects an indication I its own range cannot display, without touching the load mpe', () => {
    validate()

    fireEvent.change(indicationInput(), { target: { value: '2001' } })

    const messages = screen.getAllByText(/Invalid indication/)
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0].textContent).toContain('partial weighing range 2')
    expect(messages[0].textContent).toContain('e₂ = 2 g')
    expect(indicationInput().value).toBe('2001')
    expect(indicationInput().getAttribute('aria-invalid')).toBe('true')

    expect(valueOf(/Maximum permissible error/)).toBe('± 1 g (± 1.0 e₁)')
    expect(screen.queryByText(/Invalid next indication/)).toBeNull()
  })

  it('does not apply the indication rule to the test load', () => {
    validate()

    // 2 001 g is not a displayable indication of partial weighing range 2, but it is an ordinary
    // test load: its mpe resolves from e₂ and no indication message appears.
    const loadInput = screen.getByRole('textbox', { name: /^L — Test load/ }) as HTMLInputElement
    fireEvent.change(loadUnitFor(loadInput), { target: { value: 'g' } })
    fireEvent.change(loadInput, { target: { value: '2001' } })

    expect(loadInput.value).toBe('2001')
    expect(loadInput.getAttribute('aria-invalid')).toBeNull()
    expect(screen.queryByText(/Invalid /)).toBeNull()
    expect(valueOf(/Partial weighing range of L/)).toBe('Range 2 (2 kg → 5 kg)')
    expect(valueOf(/Applicable verification scale interval/)).toBe('e₂ = 2 g')
    expect(valueOf(/^m = L \/ e/)).toBe('m = L / e₂ = 1,000.5')
    expect(valueOf(/Maximum permissible error/)).toBe('± 2 g (± 1.0 e₂)')
  })
})

/** The unit selector that belongs to the field with the given input. */
function loadUnitFor(input: HTMLInputElement): HTMLSelectElement {
  const unit = input.closest('.field')?.querySelector('select.control-unit')
  return (unit ?? screen.getByRole('combobox', { name: 'Unit for Test load L' })) as HTMLSelectElement
}
