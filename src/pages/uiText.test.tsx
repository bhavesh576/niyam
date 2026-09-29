// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../App'

/**
 * Phase 5 §25 — nothing that belongs in source, and nothing that belongs in a draft, may reach the
 * screen.
 *
 * The strings checked here are the ones a laboratory user reads: field labels, hints, issue messages,
 * table cells, the calculation trace and the generated document. Markup artefacts (a stray backtick
 * left over from writing prose in a source comment), unfinished-work markers, demo wording and
 * unresolved values are all failures of the same kind — the interface promising less than it delivers.
 *
 * What is *not* a failure, and is deliberately allowed: honest statements of scope such as
 * "not evaluated in this build" or "not implemented in this build", and the word "Prototype" in the
 * report title, which is the specification's own wording.
 */

/** Words and artefacts that must not appear anywhere in the rendered interface. */
const FORBIDDEN: readonly RegExp[] = [
  /`/, // markdown or template artefact left in prose
  /\bTODO\b/i,
  /\bFIXME\b/i,
  /\bXXX\b/,
  /\bHACK\b/i,
  /\bmock(ed|ing)?\b/i,
  /\bdummy\b/i,
  /\bplaceholder\b/i,
  /\bsample data\b/i,
  /\blorem\b/i,
  /\bdemo\b/i,
  /\bhackathon\b/i,
  /\bSIH\b/,
  /\bSmart India\b/i,
  /\bcoming soon\b/i,
  /\bfuture feature/i,
  /\bwill be (added|implemented|available)\b/i,
  /\bnot yet implemented\b/i,
  /\[VERIFY/i,
  /\bdeveloper note/i,
  /\btemporar(y|ily)\b/i,
  /\bundefined\b/,
  /\bNaN\b/,
  /\[object Object\]/,
  /* Codepoints that render as a hollow box: neither shipped webfont carries them (the Inter and
     JetBrains Mono subsets cover Latin, Greek, Cyrillic and Vietnamese, not the tone letters) and
     common system fonts do not either — DejaVu Sans, the widest-coverage fallback there is, has no
     U+A700. The corrected error was written E\uA700 until this was measured, and it showed as a box
     next to every Ec on screen and on paper. It is now spelled with a plain c, which both webfonts
     carry, so the notation cannot fall back to a glyph that may not exist on the reader's machine. */
  /[\uA700-\uA71F]/, // Modifier Tone Letters
  /[\uE000-\uF8FF]/, // Private Use Area
  /\uFFFD/, // replacement character
]

const TEST_AREA = 'Digital weighing test'
const RESULT_AREA = 'Test result and report'

describe('user-facing text carries no source artefacts, drafts or unresolved values', () => {
  afterEach(cleanup)

  function expectClean(label: string) {
    const text = document.body.textContent ?? ''
    for (const pattern of FORBIDDEN) {
      const match = text.match(pattern)
      expect(match, `${label}: rendered text matches ${pattern} — "${match?.[0] ?? ''}"`).toBeNull()
    }
  }

  it('renders the configuration area clean, before and after a failed validation', () => {
    render(<App />)
    expectClean('configuration, fresh')

    fireEvent.change(screen.getByRole('textbox', { name: /^Min — Minimum capacity/ }), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    expect(screen.getByText('Configuration invalid')).toBeTruthy()
    expectClean('configuration, invalid')
  })

  it('renders the validated configuration, its resolution panel and the boundary probes clean', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    expect(screen.getByText('Configuration valid')).toBeTruthy()
    expectClean('configuration, valid')

    // A changeover: I = 2 000 g in range 1, I_next = 2 002 g in range 2, so e* = e₂.
    fireEvent.change(screen.getByRole('textbox', { name: /^I — Indication/ }), {
      target: { value: '2000' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^I_next — Next indication/ }), {
      target: { value: '2002' },
    })
    expect(screen.getByText('e* = 2 g')).toBeTruthy()
    expectClean('test load resolution, changeover into range 2')

    // A next indication outside the weighing range: the panel says what is missing, in words.
    fireEvent.change(screen.getByRole('textbox', { name: /^I_next — Next indication/ }), {
      target: { value: '2.002' },
    })
    expect(screen.getByText('e* = not resolved')).toBeTruthy()
    expectClean('test load resolution, next indication outside the weighing range')
  })

  it('renders the digital weighing test clean — evaluated, blocked and after a refused indication', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    expectClean('test, pre-filled observation')

    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    expect(screen.getByRole('status', { name: 'Verdict' }).textContent).toContain('PASS')
    expectClean('test, evaluated')

    // A blocked evaluation: E₀ removed, so nothing is calculated and the reasons are printed.
    fireEvent.change(screen.getByRole('combobox', { name: 'Unit for Zero error E₀' }), {
      target: { value: 'g' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^E₀ — Zero error/ }), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    expectClean('test, blocked')

    // A refused next indication: the value is reported, never corrected.
    fireEvent.change(screen.getByRole('textbox', { name: /^I_next — Next indication/ }), {
      target: { value: '2005' },
    })
    expectClean('test, refused next indication')
  })

  it('renders the result area and the generated document clean', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
    fireEvent.click(screen.getByRole('button', { name: TEST_AREA }))
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }))
    fireEvent.click(screen.getByRole('button', { name: RESULT_AREA }))
    expectClean('result, before the report is generated')

    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }))
    expect(screen.getByRole('article')).toBeTruthy()
    expectClean('result, with the generated document')
  })

  it('renders the blocked report clean when the evaluation cannot be completed', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate configuration' }))
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
    expectClean('result, report not ready')
  })
})
