import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '../App'
import { ConfigurationPage } from './ConfigurationPage'
import { validateConfiguration } from '../domain/validation/validateConfiguration'
import { toInstrumentConfig } from '../domain/models/draft'
import { createOfficialExampleDraft } from '../data/defaultConfiguration'

/**
 * Render smoke test.
 *
 * The domain logic is covered by its own unit tests; this file only proves that the screen the
 * user actually opens renders, that it starts from the R-76 example, and that the default
 * configuration on screen is the one the validator accepts. Rendered with `react-dom/server`, so
 * it needs no browser and no extra test dependency.
 */
describe('configuration screen', () => {
  it('renders the instrument configuration form', () => {
    const html = renderToStaticMarkup(<ConfigurationPage />)

    expect(html).toContain('Instrument Configuration')
    expect(html).toContain('Partial weighing ranges')
    expect(html).toContain('Range 1')
    expect(html).toContain('Range 2')
    expect(html).toContain('Range 3')
    expect(html).toContain('+ Add range')
    expect(html).toContain('Validate configuration')
    // The result panel only appears after a validation run.
    expect(html).not.toContain('Configuration valid')
    expect(html).not.toContain('Configuration invalid')
  })

  it('starts from the official R-76 example, pre-filled on the form', () => {
    const html = renderToStaticMarkup(<ConfigurationPage />)

    // Capacities in kg, intervals in g, exactly as printed in §3.3.3.
    expect(html).toContain('value="2"')
    expect(html).toContain('value="5"')
    expect(html).toContain('value="15"')
    expect(html).toContain('value="1"')
    expect(html).toContain('value="10"')
    expect(html).toContain('value="20"')
    // The derived n values are shown beside each range while typing.
    expect(html).toContain('n₁ = 2,000')
    expect(html).toContain('n₂ = 2,500')
    expect(html).toContain('n₃ = 1,500')
  })

  it('shows the accuracy class and instrument type of this phase as the selected values', () => {
    const html = renderToStaticMarkup(<ConfigurationPage />)

    expect(html).toContain('Class III — Medium accuracy')
    expect(html).toContain('Multi-interval instrument')
    expect(html).toContain('not evaluated in this build')
  })

  it('renders the application shell around the page', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('NIYAM')
    expect(html).toContain('OIML R 76-1:2006')
    expect(html).toContain('Instrument Configuration')
    // The application must not present itself as issuing legal certificates.
    expect(html).toContain('does not issue legal certificates')
  })

  it('accepts the configuration the screen starts from', () => {
    const result = validateConfiguration(toInstrumentConfig(createOfficialExampleDraft()))

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})
