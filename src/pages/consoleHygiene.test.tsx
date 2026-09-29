// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../App'

/**
 * Phase 5 §19 — the interface must be quiet.
 *
 * React reports every real problem it can see through `console.error` (bad keys, unknown props,
 * updates outside an act scope, invalid nesting) and most of what it warns about through
 * `console.warn`. None of that may reach the console of a laboratory user: it is the one channel the
 * interface has for saying "something here is wrong", and a message in it is either a defect or noise
 * that hides one.
 *
 * The states below are the ones the review walked through by hand: a fresh configuration, a rejected
 * one, an accepted one with the resolution panel and its boundary probes open, the digital weighing
 * test evaluated, blocked and with a refused next indication, and the result area with and without a
 * generated document.
 */

const TEST_AREA = 'Digital weighing test'
const RESULT_AREA = 'Test result and report'

describe('no console output while the application is used', () => {
  let errors: unknown[][] = []
  let warnings: unknown[][] = []

  beforeEach(() => {
    errors = []
    warnings = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args)
    })
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warnings.push(args)
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function expectQuiet(label: string) {
    expect(errors, `${label}: console.error — ${JSON.stringify(errors[0] ?? null)}`).toHaveLength(0)
    expect(warnings, `${label}: console.warn — ${JSON.stringify(warnings[0] ?? null)}`).toHaveLength(0)
  }

  function validate() {
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
  }

  it('stays quiet through configuration, validation, resolution and the boundary probes', () => {
    render(<App />)
    expectQuiet('fresh configuration')

    fireEvent.change(screen.getByRole('textbox', { name: /^Min — Minimum capacity/ }), {
      target: { value: '5' },
    })
    validate()
    expectQuiet('rejected configuration')

    fireEvent.click(screen.getByRole('button', { name: 'Reset to R-76 example' }))
    validate()
    expect(screen.getByText('Configuration valid')).toBeTruthy()
    expectQuiet('validated configuration, resolution panel and boundary probes')

    fireEvent.change(screen.getByRole('textbox', { name: /^I_next — Next indication/ }), {
      target: { value: '2002' },
    })
    expectQuiet('resolution panel with a changeover')

    // Adding and removing a partial weighing range, which re-keys the range rows.
    fireEvent.click(screen.getByRole('button', { name: '+ Add range' }))
    expectQuiet('fourth partial weighing range added')
    fireEvent.click(screen.getByRole('button', { name: 'Remove range 4' }))
    expectQuiet('fourth partial weighing range removed')
  })

  it('stays quiet through the digital weighing test — evaluated, blocked and refused', () => {
    render(<App />)
    validate()
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    expectQuiet('test area, pre-filled observation')

    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    expect(screen.getByRole('status', { name: 'Verdict' }).textContent).toContain('PASS')
    expectQuiet('test area, evaluated')

    fireEvent.change(screen.getByRole('combobox', { name: 'Unit for Zero error E₀' }), {
      target: { value: 'g' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^E₀ — Zero error/ }), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    expectQuiet('test area, blocked evaluation')

    fireEvent.change(screen.getByRole('textbox', { name: /^I_next — Next indication/ }), {
      target: { value: '2005' },
    })
    expectQuiet('test area, refused next indication')

    fireEvent.click(screen.getByRole('button', { name: 'Reset to transition example' }))
    expectQuiet('test area, observation restored')
  })

  it('stays quiet through the result area, the report and the area switches', () => {
    render(<App />)
    validate()
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    fireEvent.click(screen.getByRole('button', { name: RESULT_AREA }))
    expectQuiet('result area, no document yet')

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }))
    expect(screen.getByRole('article')).toBeTruthy()
    expectQuiet('result area, document generated')

    // Leaving the area drops the generated document; coming back re-renders the summary.
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.click(screen.getByRole('button', { name: RESULT_AREA }))
    expectQuiet('result area, reopened')

    // A blocked report: the gate refuses and the reasons are printed instead of a document.
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Unit for Zero error E₀' }), {
      target: { value: 'g' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^E₀ — Zero error/ }), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    fireEvent.click(screen.getByRole('button', { name: RESULT_AREA }))
    expect(screen.getByRole('heading', { name: 'REPORT NOT READY' })).toBeTruthy()
    expectQuiet('result area, report not ready')
  })
})
