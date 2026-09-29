// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../App'

/**
 * Interaction test for the completion condition of this phase:
 * open the application -> enter a multi-interval class III instrument -> add partial ranges ->
 * validate the configuration -> see clear validation results beside the affected fields.
 *
 * Note on the assertions below: every message is rendered twice by design — once beside the field
 * it belongs to and once in the result panel — so message lookups expect two occurrences.
 */
describe('configuration workflow', () => {
  afterEach(cleanup)

  function minInput(): HTMLInputElement {
    return screen.getByRole('textbox', { name: /^Min — Minimum capacity/ }) as HTMLInputElement
  }

  it('shows no result before the configuration has been validated', () => {
    render(<App />)

    expect(screen.queryByText('Configuration valid')).toBeNull()
    expect(screen.queryByText('Configuration invalid')).toBeNull()
    expect(screen.getByRole('button', { name: 'Validate configuration' })).toBeTruthy()
  })

  it('validates the pre-filled R-76 example and shows the normalized range model', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))

    expect(screen.getByText('Configuration valid')).toBeTruthy()
    expect(screen.getByText('0 errors · 0 warnings')).toBeTruthy()
    // The published §3.3.3 partial weighing ranges, as normalized by the domain layer.
    expect(screen.getByText('20 g → 2 kg')).toBeTruthy()
    expect(screen.getByText('2 kg → 5 kg')).toBeTruthy()
    expect(screen.getByText('5 kg → 15 kg')).toBeTruthy()
    expect(screen.getByText('exempt (§3.3.3)')).toBeTruthy()
    expect(
      screen.getByText(
        'Min = Min₁ = 20 g · Max = Max₃ = 15 kg · d = e₁ = 1 g · accuracy class III · multi-interval instrument.',
      ),
    ).toBeTruthy()
  })

  it('reports an invalid Min beside the Min field and marks the input as invalid', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    expect(screen.getByText('Configuration valid')).toBeTruthy()

    const input = minInput()
    fireEvent.change(input, { target: { value: '5' } })

    // The result stays live after the first validation run.
    expect(screen.getByText('Configuration invalid')).toBeTruthy()
    expect(screen.getAllByText(/Min = 5 g is below the minimum capacity required for accuracy class III/)).toHaveLength(2)
    expect(screen.getAllByText(/Min ≥ 20 d = 20 × 1 g = 20 g/)).toHaveLength(2)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    // The result panel addresses the same message to its field.
    expect(screen.getByText('Minimum capacity (Min)')).toBeTruthy()
    expect(screen.getByText('1 error · 0 warnings')).toBeTruthy()
  })

  it('reports a Table 4 violation next to the Max field of the offending partial range', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))

    fireEvent.change(screen.getByRole('textbox', { name: 'Range 1 maximum capacity Max₁' }), {
      target: { value: '0.5' },
    })

    expect(screen.getByText('Configuration invalid')).toBeTruthy()
    expect(screen.getAllByText(/Max₁ \/ e₂ = 500 g \/ 2 g = 250 must be at least 500/)).toHaveLength(2)
    expect(screen.getAllByText('OIML R 76-1:2006 (E) — §3.3.3, Table 4')).toHaveLength(2)
    expect(screen.getByText('Range 1 — Max')).toBeTruthy()
  })

  it('adds a partial range and reports the values that are still missing in it', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    expect(screen.queryByText('Range 4')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '+ Add range' }))
    expect(screen.getByText('Range 4')).toBeTruthy()

    // The new range is empty, so validation asks for its Max and e explicitly.
    expect(screen.getAllByText('Range 4: Max₄ is required.')).toHaveLength(2)
    expect(screen.getAllByText('Range 4: e₄ is required.')).toHaveLength(2)
    expect(screen.getByText('Configuration invalid')).toBeTruthy()
    expect(screen.getByText('2 errors · 0 warnings')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove range 4' }))
    expect(screen.queryByText('Range 4')).toBeNull()
    expect(screen.getByText('Configuration valid')).toBeTruthy()
  })

  it('keeps the same mass when the unit of a field is switched from kg to g', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))

    const maxInput = screen.getByRole('textbox', { name: 'Range 1 maximum capacity Max₁' }) as HTMLInputElement
    expect(maxInput.value).toBe('2')

    fireEvent.change(screen.getByLabelText('Unit for Range 1 maximum capacity Max₁'), { target: { value: 'g' } })

    expect(maxInput.value).toBe('2000')
    expect(screen.getByText('Configuration valid')).toBeTruthy()
    expect(screen.getByText('n₁ = 2,000')).toBeTruthy()
  })

  it('restores the R-76 example and clears the result panel on reset', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    fireEvent.change(minInput(), { target: { value: '5' } })
    expect(screen.getByText('Configuration invalid')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reset to R-76 example' }))

    expect(screen.queryByText('Configuration invalid')).toBeNull()
    expect(screen.queryByText('Configuration valid')).toBeNull()
    expect(minInput().value).toBe('20')
  })

  it('rejects unparsable input with a "required" message instead of a limit message', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))

    fireEvent.change(screen.getByRole('textbox', { name: 'Range 2 verification scale interval e₂' }), {
      target: { value: '2,O' },
    })

    expect(screen.getAllByText('Range 2: e₂ is required.')).toHaveLength(2)
    expect(screen.queryAllByText(/does not fall in any verification scale interval band/)).toHaveLength(0)
  })

  it('shows a structural warning without invalidating the configuration', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))

    fireEvent.change(screen.getByRole('textbox', { name: 'Range 1 maximum capacity Max₁' }), {
      target: { value: '2.0005' },
    })

    expect(screen.getByText('Configuration valid')).toBeTruthy()
    expect(screen.getByText('0 errors · 1 warning')).toBeTruthy()
    expect(screen.getAllByText(/is not a whole number of e₁ = 1 g/)).toHaveLength(2)
    expect(
      screen.getAllByText(/configuration consistency check — not an R-76 numeric requirement/),
    ).toHaveLength(2)
  })
})
