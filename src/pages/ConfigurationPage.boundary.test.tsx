// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'

/**
 * Phase 5 §14 — the second range changeover of the official example, on screen.
 *
 * The unit tests in `src/domain/report/boundaryMatrix.test.ts` fix the six boundary positions of the
 * §3.3.3 example (below, at and above Max₁ = 2 kg and Max₂ = 5 kg) and prove the report model carries
 * the same values the evaluation produced. These two tests close the loop at the display layer for the
 * position the other page tests do not cover: a load exactly on Max₂ = 5 kg, where the indication
 * crosses into partial weighing range 3 while the load stays in range 2 — so range_L = range_I = 2,
 * range_I_next = 3, e_L = e₂ = 2 g, e* = e₃ = 10 g and the mpe stays ± 1.5 e₂ = ± 3 g.
 *
 * The observation: L = 5 000 g, I = 5 000 g, ΔL = 3 g, I_next = 5 010 g, E₀ = 0 g
 *   P = I + ½ e* − ΔL = 5 000 + 5 − 3 = 5 002 g
 *   E = P − L = +2 g ; Ec = E − E₀ = +2 g ; |Ec| = 2 g ≤ mpe = 3 g → PASS
 */

const TEST_AREA = 'Digital weighing test'
const RESULT_AREA = 'Test result and report'

/** The caption of the result table, used as its accessible name. */
const RESULT_TABLE = /L, I, ΔL and I_next are the observation/

/** The fifteen columns of the result table for this observation, in grams. */
const MAX2_ROW: Record<string, string> = {
  L: '5000',
  I: '5000',
  ΔL: '3',
  I_next: '5010',
  range_L: '2',
  range_I: '2',
  range_I_next: '3',
  e_L: '2',
  'e*': '10',
  P: '5002',
  E: '+2',
  'E₀': '0',
  'Ec': '+2',
  MPE: '± 3',
  Result: 'PASS',
}

describe('boundary display — a load exactly on Max₂ = 5 kg', () => {
  afterEach(cleanup)

  /** Validates the §3.3.3 example, opens the test area and enters the observation in grams. */
  function evaluateAtMax2() {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    expect(screen.getByText('Configuration valid')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))

    // [name of the unit select, accessible name of the value field, value in grams]
    const fields: readonly [string, RegExp, string][] = [
      ['Test load L', /^L — Test load/, '5000'],
      ['Indication I', /^I — Indication/, '5000'],
      ['Additional load ΔL', /^ΔL — Additional load/, '3'],
      ['Next indication I_next', /^I_next — Next indication/, '5010'],
      ['Zero error E₀', /^E₀ — Zero error/, '0'],
    ]
    for (const [label, name, value] of fields) {
      // The unit is set before the value, so no field is rescaled on the way in.
      fireEvent.change(screen.getByRole('combobox', { name: `Unit for ${label}` }), {
        target: { value: 'g' },
      })
      fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } })
    }

    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
  }

  /**
   * The value of one row of the resolved range context, addressed through its row header. The context
   * is printed as two tables — the load side and the indication side — so the row is looked up in
   * whichever of the two carries it.
   */
  function limitRow(header: string): string {
    const tables = screen.getAllByRole('table', { name: /side of the resolution/ })
    for (const table of tables) {
      const row = within(table).queryByRole('rowheader', { name: header })
      if (row !== null) return row.nextElementSibling?.textContent ?? ''
    }
    throw new Error(`no resolution row ${header}`)
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
    return Object.fromEntries(
      headers.map((header, index) => [header.textContent ?? '', cells[index]?.textContent ?? '']),
    )
  }

  it('shows the load side and the indication side of the changeover apart', () => {
    evaluateAtMax2()

    // Load side: L = Max₂ still belongs to partial weighing range 2, so the limit stays ± 1.5 e₂.
    expect(limitRow('range_L')).toContain('Range 2 (2 kg → 5 kg)')
    expect(limitRow('e_L')).toContain('e₂ = 2 g')
    expect(limitRow('m = L / e_L')).toContain('2,500')
    expect(limitRow('Table 6')).toContain('2 000 < m ≤ 10 000')
    expect(limitRow('MPE')).toContain('± 3 g')

    // Indication side: I is still in range 2, I_next has crossed into range 3, and e* follows it.
    expect(limitRow('range_I')).toContain('Range 2 (2 kg → 5 kg)')
    expect(limitRow('range_I_next')).toContain('Range 3 (5 kg → 15 kg)')
    expect(limitRow('e*')).toContain('e₃ = 10 g')

    // The calculation and the verdict of A.4.4.3 for this observation.
    const calculation = screen.getByRole('table', { name: /A\.4\.4\.3 calculation/ })
    expect(within(calculation).getByText('= 5002 g')).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Verdict' }).textContent).toContain('PASS')
  })

  it('prints the same observation in the result view and in the generated report', () => {
    evaluateAtMax2()
    fireEvent.click(screen.getByRole('button', { name: RESULT_AREA }))

    const resultArea = screen.getByRole('region', { name: 'Test Result and Report' })
    // The result screen's table, and the same table on the document the pane shows beside it.
    const before = screen.getAllByRole('table', { name: RESULT_TABLE })
    expect(before).toHaveLength(2)
    expect(rowOf(before[0]!)).toEqual(MAX2_ROW)
    expect(rowOf(before[1]!)).toEqual(MAX2_ROW)

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }))
    const document = screen.getByRole('article')
    const tables = screen.getAllByRole('table', { name: RESULT_TABLE })
    expect(tables).toHaveLength(2)

    // One source of truth: the document's row is the result view's row, cell for cell.
    expect(rowOf(tables[1]!)).toEqual(rowOf(tables[0]!))
    expect(rowOf(tables[1]!)).toEqual(MAX2_ROW)

    // And the document's prose names the same ranges and intervals as the table does.
    expect(within(document).getAllByText(/Range 2 \(2 kg → 5 kg\)/).length).toBeGreaterThan(0)
    expect(within(document).getAllByText(/Range 3 \(5 kg → 15 kg\)/).length).toBeGreaterThan(0)
    expect(within(document).getAllByText(/e_L = e₂ = 2 g/).length).toBeGreaterThan(0)
    expect(within(document).getAllByText(/e\* = e₃ = 10 g/).length).toBeGreaterThan(0)
    expect(within(resultArea).getAllByText(/PASS/).length).toBeGreaterThan(0)
  })
})
