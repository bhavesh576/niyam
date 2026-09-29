import { describe, expect, it } from 'vitest'

/**
 * The architectural test of Phase 4: the report layer contains no calculation.
 *
 * `buildReport.test.ts` proves the report carries the result's own numbers; this file proves it
 * could not have produced different ones. It reads the source of the layer and asserts what it is
 * allowed to depend on and what must never appear in it:
 *
 * - **no resolver, no engine, no validator** — a report that resolved a range, looked up a Table 6
 *   bracket or re-ran the evaluation would be a second source of truth, and the two would eventually
 *   disagree;
 * - **no arithmetic** — not `Math.abs`, not `addGrams`, not `/ 2`: |Ec|, the margin, ½ e* and the
 *   verdict all arrive already computed;
 * - **no second MPE table** — the coefficient is printed from the number the resolver chose, and the
 *   table lookups that would choose it again are named here so that importing one fails the build.
 *
 * The only arithmetic in the layer is `getMonth() + 1` in the timestamp formatter, which formats a
 * `Date` and never touches a mass.
 */

/**
 * The source text of this directory, loaded by Vite as raw strings.
 *
 * Reading the files through the bundler rather than through `node:fs` keeps this test inside the
 * module graph it inspects: what is scanned is exactly what would be built, and no Node types are
 * needed in the application project.
 */
const rawModules = import.meta.glob<string>('./*.ts', { query: '?raw', import: 'default', eager: true })

/** The modules of the layer that hold logic; the tests are excluded because they quote what is banned. */
const sourceFiles = Object.keys(rawModules)
  .filter((path) => !path.endsWith('.test.ts'))
  .map((path) => path.replace('./', ''))
  .sort()

const sources = new Map(
  sourceFiles.map((name) => [name, rawModules[`./${name}`] ?? '']),
)
const allSources = [...sources.values()].join('\n')

/**
 * The layer without its comments.
 *
 * A doc comment may name the engine it must not call — that is documentation, not a dependency — so
 * the bans below are applied to code. `//` preceded by `:` is left alone, so a URL in a string
 * survives; none of these files contains one.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const code = [...sources.values()].map(stripComments).join('\n')


/**
 * Everything the report layer may import, and why.
 *
 * `types` modules carry no code, `describe` modules turn already-resolved values into text, the
 * `utils` modules format numbers and citations, and `r76Tables` is allowed for one function only —
 * checked separately below.
 */
const ALLOWED_IMPORTS: readonly string[] = [
  './types',
  './content',
  '../models/instrument',
  '../models/normalizedInstrument',
  '../evaluation/types',
  '../evaluation/describe',
  '../resolution/types',
  '../resolution/describe',
  '../validation/types',
  '../constants/r76Tables',
  '../../utils/mass',
  '../../utils/text',
  '../../utils/reference',
]

/** Modules that resolve, evaluate, normalize or validate: the calculation the report must not repeat. */
const FORBIDDEN_MODULES: readonly string[] = [
  'rangeResolver',
  'mpeResolver',
  'resolveTestCondition',
  'indicationConsistency',
  'boundaries',
  'evaluateObservation',
  'validateObservation',
  'normalizeConfiguration',
  'validateConfiguration',
  'pendingRules',
]

/**
 * Calls that would calculate a value the evaluation already produced, or look an R-76 table up a
 * second time. Word boundaries matter: `trimNumber` is formatting and must not be caught by a ban on
 * `Number(…)` conversion.
 */
const FORBIDDEN_CALLS: readonly RegExp[] = [
  /\bMath\s*\./,
  /\bNumber\s*\(/,
  /\bparseFloat\b/,
  /\bparseInt\b/,
  /\.toFixed\s*\(/,
  /\baddGrams\b/,
  /\bsubtractGrams\b/,
  /\bscaleGrams\b/,
  /\bexactIntegerQuotient\b/,
  /\bisExactMultipleOf\b/,
  /\bratio\s*\(/,
  /\btoGrams\b/,
  /\bfromGrams\b/,
  /\bparseMassToGrams\b/,
  /\bparseDecimalString\b/,
  /\bfindTable3Row\b/,
  /\bfindTable6Row\b/,
  /\btable3RowsFor\b/,
  /\btable6RowsFor\b/,
  /\bR76_TABLE_\d/,
  /\bresolveRange\b/,
  /\bresolveMpe\b/,
  /\bresolveTestCondition\b/,
  /\bevaluateDigitalWeighingObservation\b/,
  /\bvalidateConfiguration\b/,
  /\bnormalizeConfiguration\b/,
  /\bcheckIndicationConsistency\b/,
]

/** Matches `from '<specifier>'` in an import or export statement. */
const IMPORT_SOURCE = /from\s+'([^']+)'/g

/** Matches `import { a, b } from '…'` and returns the imported names with their module. */
const NAMED_IMPORT = /import\s+(?:type\s+)?{([^}]*)}\s+from\s+'([^']+)'/g

/** Every module specifier the layer imports, read from code only. */
const importedSpecifiers: string[] = []
for (const match of code.matchAll(IMPORT_SOURCE)) {
  if (match[1] !== undefined) importedSpecifiers.push(match[1])
}

describe('the report layer has no calculation of its own', () => {
  it('reads the modules that hold the report logic', () => {
    expect(sourceFiles).toEqual(['buildReport.ts', 'content.ts', 'types.ts'])
    expect(allSources.length).toBeGreaterThan(1000)
  })

  it('imports nothing but formatters, descriptors and types', () => {
    const unexpected = [...new Set(importedSpecifiers)].filter((specifier) => !ALLOWED_IMPORTS.includes(specifier))
    expect(unexpected).toEqual([])
    expect(importedSpecifiers.length).toBeGreaterThan(10)
  })

  it('never imports a resolver, the evaluation engine, a validator or the normalizer', () => {
    const forbidden = importedSpecifiers.filter((specifier) =>
      FORBIDDEN_MODULES.some((module) => specifier.includes(module)),
    )
    expect(forbidden).toEqual([])
  })

  it('never imports React, a component or anything that renders', () => {
    expect(allSources).not.toContain("'react'")
    expect(allSources).not.toContain('.tsx')
    expect(allSources).not.toContain('components/')
    expect(allSources).not.toContain('pages/')
  })

  it('contains no arithmetic and no second lookup of the R-76 tables', () => {
    const found = FORBIDDEN_CALLS.filter((pattern) => pattern.test(code)).map((pattern) => String(pattern))
    expect(found).toEqual([])
  })

  it('takes only the coefficient’s printed form from the table module, never a table row', () => {
    for (const [name, raw] of sources) {
      const source = stripComments(raw)
      for (const match of source.matchAll(NAMED_IMPORT)) {
        if (match[2] !== '../constants/r76Tables') continue
        const names = (match[1] ?? '')
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry !== '')
        expect({ file: name, importedFromR76Tables: names }).toEqual({
          file: name,
          importedFromR76Tables: ['describeMpeCoefficient'],
        })
      }
    }
    // And the mass utils are used for formatting only.
    for (const match of code.matchAll(NAMED_IMPORT)) {
      if (match[2] !== '../../utils/mass') continue
      const names = (match[1] ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== '')
        .sort()
      expect(names).toEqual(['formatMass', 'trimNumber'])
    }
  })

  it('exports exactly one function: the builder that maps a result onto a report', () => {
    const exportedFunctions = [...code.matchAll(/export function (\w+)/g)].map((match) => match[1])
    expect(exportedFunctions).toEqual(['buildWeighingReport'])
  })

  it('reads the verdict and the limit from the result instead of comparing them again', () => {
    const source = sources.get('buildReport.ts') ?? ''

    // The verdict is the evaluation's own boolean, mapped onto the two legal words.
    expect(source).toContain("result.passed ? 'PASS' : 'FAIL'")
    // |Ec|, the margin and ½ e* are fields of the result, not expressions.
    expect(source).toContain('result.absoluteEcGrams')
    expect(source).toContain('result.marginGrams')
    expect(source).toContain('result.halfEStarGrams')
    expect(source).toContain('result.mpeGrams')
    // And no comparison operator is applied to a mass anywhere in the layer.
    expect(source).not.toMatch(/Grams\s*[<>]/)
    expect(source).not.toMatch(/[<>]=?\s*\w*Grams/)
  })
})
