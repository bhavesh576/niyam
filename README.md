# NIYAM — Range-Aware R-76 Test & Report Engine

Browser-based application for generating test reports for **non-automatic weighing instruments
(NAWI)** evaluated against **OIML Recommendation R 76**.

This repository currently contains **Phase 1: instrument configuration and configuration
validation**, **Phase 2: multi-interval range resolution and MPE resolution**, **Phase 3: the
digital weighing test of A.4.4.3** and **Phase 4: the result view, the report model and the
printable report document** — all for **multi-interval instruments of accuracy class III**, initial
verification — plus **Phase 5: interface polish, boundary verification and cleanup**, which changed
no rule, no formula and no architecture.

The core concern of the project is the correct treatment of a multi-interval instrument, so the data
model keeps `e` **per partial weighing range** — there is no instrument-wide `e` anywhere — and
every quantity of a test condition (L, I, I_next) is resolved into its own partial weighing range
before any limit is derived from it. Phase 3 evaluates one observation on top of that resolution:

```text
P = I + ½ e* − ΔL        E = P − L        Ec = E − E₀        PASS iff |Ec| ≤ mpe
```

with `e*` taken from the partial weighing range in which the indication `(I + e)` appears, and the
mpe taken from the partial weighing range of the **load** — so `E = I − L` is never computed and
`e*` is never assumed to equal `e_L`.

Phase 4 adds no arithmetic at all. It maps that one result onto a report model and renders it three
ways — as a result view, as a fifteen-column result table and as a printable document:

```text
Phase 3 EvaluationResult  →  WeighingReport (mapping, gated)  →  result view · result table · print/PDF
```

The report generator resolves no range, looks up no Table 6 bracket, halves no interval and compares
no error with a limit; a source-scanning test fails the build if it ever does.

---

## Running the application

```bash
npm install        # once
npm run dev        # development server (Vite)
```

Then open the URL printed by Vite (default `http://localhost:5173/`).

`npm run build` writes the deployable application to `dist/`; `README_DEPLOY.md` and `render.yaml`
are what it takes to serve that directory from a static host.

### The live preview in this workspace

```bash
bash start-preview.sh              # serve the built application from preview/ on 0.0.0.0:5173
bash start-preview.sh --rebuild    # rebuild preview/ from src/ first, then serve it
bash start-preview.sh --dev        # Vite dev server with hot reload (restores dependencies if needed)
```

The default is deliberately *not* the dev server. The sandbox this workspace runs in is reset between
turns: background processes are killed and `node_modules`, being a generated directory outside the
saved snapshot, is wiped — while `src/**`, `preview/**` and `backups/**` survive. A Vite server
therefore has to restore ~114 packages over the network and keep a node process alive before anything
can be seen, and the preview kept showing up blank. `start-preview.sh` instead serves the production
build from `preview/` with `serve-preview.py`, which needs only the Python already in the image: no
`node_modules`, no network, listening in under half a second. It sets `font/woff2` for the bundled
Inter and JetBrains Mono subsets, because Python's MIME table does not know the format and a browser
refuses a webfont served as anything else.

`preview/` is a build artefact like `dist/` — rebuild it after editing sources, and it is excluded
from the backup zips.

Other commands:

```bash
npm test           # unit tests (Vitest, one run)
npm run test:watch # unit tests, watch mode
npm run build      # type-check (tsc -b) + production build into dist/
npm run preview    # serve the production build
npm run lint       # oxlint
npm run typecheck  # tsc -b only
```

Requirements: Node.js 20.19+ (developed on Node 20.20).

### Using the screen

The page has three work areas, **Instrument configuration**, **Digital weighing test** and **Test
result and report**. The configuration area opens first; all three work on the same instrument and
the same evaluation.

1. The form opens pre-filled with the multi-interval example printed in OIML R 76-1:2006 §3.3.3
   (Max = 2 / 5 / 15 kg, e = 1 / 2 / 10 g, class III, Min = 20 g, d = 1 g).
2. Edit Min, d, and the Max / e of each partial weighing range. Add or remove ranges as needed.
   Each mass has its own unit selector (g or kg); values are stored internally in **grams**.
3. Press **Validate configuration**.
4. The result panel reports **Configuration valid** or **Configuration invalid**, and every problem
   is repeated beside the field it belongs to, with the numbers it was computed from and the clause
   it comes from. When the configuration is valid, the normalized range model
   (Minᵢ → Maxᵢ, eᵢ, nᵢ = Maxᵢ/eᵢ, Maxᵢ/eᵢ₊₁) is shown.

After the first validation run the result stays live while the configuration is edited.

5. When the configuration is valid, two disclosures appear — **Range Probe** and **Range
   Boundaries** — closed by default, because they are reference material and not part of entering the
   instrument. Open **Range Probe** and enter a test load **L** (required) and, optionally, an
   indication **I** and a next indication **I_next** — each with its own unit selector.
6. The panel shows the resolution chain for that load: the partial weighing range L falls in, the
   verification scale interval `e` that applies **there**, `m = L / e`, the Table 6 bracket `m` falls
   into, and the resulting maximum permissible error on initial verification. It also shows the
   ranges of `I` and `I_next` and the interval `e*` that applies to `I_next`. An indication that
   the range it falls in cannot display (for example `I_next = 2 001 g` in a range whose
   `e₂ = 2 g`) is rejected beside its field, `e*` is then withheld, and the value you typed is
   never rounded or replaced.
7. **Range Boundaries** lists every range changeover and every reachable Table 6 bracket edge of the
   instrument, each resolved *just below*, *exactly at* and *just above* the boundary, with the row
   that sits on the boundary picked out. The `Use` button of a row copies that probe load into the
   test load field.

Neither disclosure calculates an error of indication or gives a verdict — that is the digital weighing
test.

8. Switch to **Digital weighing test**. The screen shows the instrument under test (class, type,
   Min → Max, d, and every partial weighing range) and the five quantities of one observation of
   A.4.4.3: **L** (test load), **I** (indication), **ΔL** (additional load), **I_next** (next
   indication) and **E₀** (zero error, signed, entered by the tester — never derived).
9. The fields are pre-filled with the changeover at Max₁ = 2 kg of the §3.3.3 example:
   L = 2 kg, I = 2 000 g (range 1), ΔL = 1.4 g, I_next = 2 002 g (range 2), E₀ = +0.5 g. Nothing is
   calculated until **Evaluate** is pressed.
10. The result is shown in the order it is read: first **PASS** or **FAIL** with the comparison it
    made (`|Ec| = 0.9 g ≤ mpe = 1 g — margin 0.1 g`); then the resolved **Range Context**, split into
    a load-side panel (`range_L`, `e_L`, `m`, the Table 6 bracket, the mpe) and an indication-side
    panel (`range_I`, `range_I_next`, `e*`); then the **A.4.4.3 calculation** with the substitution the
    procedure prints (`P = (2000 + 1 − 1.4) g = 1999.6 g`); and finally two disclosures — the ten-step
    calculation trace and the range-aware notes with the clauses the evaluation rests on.
11. If any quantity is missing or inadmissible, the screen says **Not evaluated**, lists every
    reason beside its field, and shows the trace with the step it stopped at. No value is rounded,
    completed or replaced, and no partial number is shown. Editing a field discards the previous
    result; changing the instrument does the same.
12. Switch to **Test result and report**. The area shows the six **report readiness** gates —
    Input data, Configuration, Calculation, Range resolution, MPE, Result — each with what it read
    and from where. Before anything is evaluated, five of them are open, the area says
    **REPORT NOT READY** with the reasons, and **Generate report** is disabled.
13. After an evaluation, the same area shows one verdict banner and the result in four groups —
    **Instrument**, **Observation**, **Resolved** and **Compliance** — followed by the fifteen-column
    **result table**. How the result was reached is not repeated here: the chains, the substituted
    formulae, the range-aware notes and the ten-step trace are on the test screen and in the document.
14. Press **Generate report**. The document appears below, as it will print: title, header lines,
    sections **A. Instrument identification**, **B. Test observation**, **C. Resolved metrological
    context**, **D. Calculation**, **E. Compliance** and **F. Technical reference**, with the prototype
    notice at the top and in the footer.
15. Press **Print / save as PDF**. The browser's own print dialog opens with only the document in it
    (application chrome, navigation, the working result view and the buttons are hidden by
    `@media print`); “Save as PDF” there is the PDF. No PDF library is used and nothing is generated
    server-side.
16. A generated document belongs to the evaluation it was generated from: editing the observation or
    the instrument drops it, and an evaluation performed against a different configuration is
    reported as stale instead of being printed.

---

## What this build implements

| Area | Status |
| --- | --- |
| Typed instrument model (`InstrumentConfig`, `PartialRange`) with per-range `e` | implemented |
| Form draft model (text + display unit) and one-point conversion to grams | implemented |
| Configuration validator, independent of the UI (`validateConfiguration`) | implemented |
| Normalized multi-interval range model (`normalizeConfiguration`) | implemented |
| Range resolution of L, I and I_next (`resolveLoadRange`, `resolveIndicationRange`, `resolveNextIndicationRange`) | implemented |
| `e_L` and `e*` taken from the resolved partial weighing ranges | implemented |
| Indication consistency: `I` and `I_next` must be displayable in the range they resolve into | implemented |
| MPE on initial verification, class III (`resolveMPE`, Table 6) | implemented |
| Boundary probe table (range changeovers and Table 6 bracket edges, three positions each) | implemented |
| Observation model (L, I, ΔL, I_next, E₀), one internal unit (grams) | implemented |
| Pre-calculation validation of the observation, incl. ΔL > 0 and the changeover step = one `e*` | implemented |
| `P = I + ½ e* − ΔL`, `E = P − L`, `Ec = E − E₀`, verdict `|Ec| ≤ mpe` (A.4.4.3) | implemented |
| Ten-step calculation trace and the substitution lines, deterministic | implemented |
| Report model as a gated mapping of the evaluation result (`buildWeighingReport`) | implemented |
| Six readiness gates; incomplete input → **REPORT NOT READY**, never a partial report | implemented |
| Result view in four groups with one verdict (PASS or FAIL, no third state) | implemented |
| Fifteen-column result table + per-test-point detail (range chains, formulae, notes) | implemented |
| Report document, sections A–F, with the prototype notice and the clauses actually used | implemented |
| Printing to PDF through the browser (`@media print`, A4, document only) | implemented |
| No duplicate calculation in the report layer, enforced by a source-scanning test | implemented, tested |
| The A.4.4.3 worked example (e = 5 g, P = 1 001 g, E = +1 g, Ec = +0.5 g) reproduced | implemented, tested |
| Class III, multi-interval instrument | implemented |
| Other accuracy classes (I, II, IIII) | Table 3 / Table 4 / Table 6 data recorded, evaluation rejected as out of scope |
| MPE in service (§3.5.2, twice the initial-verification limits) | verified, **not** implemented |
| Repeatability (§3.6.1), eccentric loading (§3.6.2) | verified, **not** implemented — one observation at a time |
| Determination of the zero-setting accuracy (A.4.2.3.1/.2) | verified, **not** implemented — E₀ is a tester input |
| Weighing-test suite (A.4.4.1, ≥ 10 test loads) | verified, **not** implemented — the report model holds an array of test points, this build fills it with one |
| Instrument identity in the report (make, model, serial number, verification mark, owner) | **not** modelled — the report identifies the instrument by its configuration and says so |
| Report persistence, lab report management, signatures, approval workflow | **not** implemented |
| Measurement uncertainty, grey zone | verified as a requirement, **not** modelled |
| Multiple-range instruments | not implemented |

Deliberately **not** built in this build: persistence, authentication, dashboards, analytics, tare
and influence-factor tests, other accuracy classes, measurement uncertainty, and any claim of legal
certification — the application evaluates one observation against transcribed R-76 limits and prints
a prototype record of that evaluation. It issues no certificate.

---

## Project structure

```text
src/
  components/            presentation only — no R-76 logic
    StatusBanner.tsx             Phase 6 — every state reported: verdict, blocked, not ready, valid
    Collapsible.tsx              Phase 6 — a <details> disclosure: caret, title, note
    ClauseTag.tsx                Phase 6 — one clause reference, always rendered the same way
    SectionHead.tsx              Phase 6 — category kicker, title, note (entered/resolved/calculated/verdict)
    CalculationTable.tsx         Phase 6 — the four substitution lines, on screen and on paper
    fieldElementId.ts            Phase 6 — issue field path -> input id; revealField() for "→ field"
    InstrumentConfigurationForm.tsx
    PartialRangeRow.tsx          six columns: Range, Minᵢ derived, Maxᵢ, eᵢ, nᵢ derived, actions
    MassField.tsx
    IssueMessages.tsx / issueElementIds.ts
    ValidationResultPanel.tsx
    NormalizedRangeTable.tsx
    TestResolutionPanel.tsx      test condition entry + the resolution chain, as two disclosures
    BoundaryProbeTable.tsx       every boundary, probed below / at / above
    DigitalWeighingTestPanel.tsx the A.4.4.3 bench: strip, observation, verdict, context, calculation
    CalculationTrace.tsx         renders the ten steps it is given (disclosure and document alike)
    TestResultPanel.tsx          Phase 4 — result view, readiness gates, generate, print
    ResultSummary.tsx            the four groups of the result, and the one verdict banner
    ResultTable.tsx              the fifteen columns, grouped — the one canonical result table
    ReportReadiness.tsx          the six gates, satisfied or open, with what each one read
    ReportDocument.tsx           sections A–F: the A4 document that prints
  pages/
    ConfigurationPage.tsx        the single screen; owns draft state, derives everything else
  domain/
    models/
      instrument.ts              InstrumentConfig, PartialRange, class/type enums-as-unions
      draft.ts                   form draft (text + unit) -> InstrumentConfig (grams)
      normalizedInstrument.ts    NormalizedInstrument, NormalizedPartialRange
      testCondition.ts           test condition draft (L, I, I_next) -> grams
      observation.ts             observation draft (L, I, ΔL, I_next, E₀) -> grams
    constants/
      r76Tables.ts               Table 3, Table 4 and Table 6, transcribed from the Recommendation
    validation/
      validateConfiguration.ts   entry point; orders and groups the rule results
      types.ts                   ValidationResult, ValidationIssue, FieldPath, RuleReference
      fieldPath.ts               addressing issues to form fields
      references.ts              rule ids + the clause/quote/status behind every rule
      rules/
        scopeAndInputRules.ts    phase scope, required and positive input
        scaleIntervalRules.ts    1/2/5 x 10^k form of d and e_i; d = e_1
        table3Rules.ts           e bands, n = Max/e minimum and maximum, Min >= 20 d
        rangeOrderRules.ts       Max_i and e_i strictly increasing
        table4Rules.ts           Max_i / e_(i+1) >= 500 (all but the last partial range)
        structuralRules.ts       consistency checks that are NOT R-76 requirements
    normalizeConfiguration.ts    validated configuration -> range model
    pendingRules.ts              rules NOT implemented, and why (later phase / not verified)
    resolution/
      types.ts                   RangeResolution, RangeResolutionResult, MpeResolutionResult
      references.ts              the clause and quote behind every resolution statement
      rangeResolver.ts           L / I / I_next -> partial weighing range -> applicable e
      indicationConsistency.ts   I and I_next must be displayable in the range they resolve into
      mpeResolver.ts             L -> range_L -> e_L -> m = L/e_L -> Table 6 -> absolute mpe
      resolveTestCondition.ts    composition of the two, the entry point of the evaluation
      boundaries.ts              boundary probes: below / exactly at / just above
      describe.ts                the wording the panel renders (pure functions)
    evaluation/                  Phase 3 — the digital weighing test of A.4.4.3
      types.ts                   TestObservationInput, EvaluationResult, TraceStep, CalculationLine
      references.ts              the clause and quote behind every statement of the evaluation
      validateObservation.ts     required and admissible inputs; the changeover I -> I_next
      evaluateObservation.ts     P, E, Ec, |Ec| vs mpe — pure, no React, no UI
      describe.ts                substitution lines, verdict wording, the ten trace steps
    report/                      Phase 4 — mapping, not calculation
      types.ts                   WeighingReport and its sections; ReportedMass keeps the grams
      content.ts                 the fixed wording: title, notice, scope limits, section headings
      buildReport.ts             the six readiness gates and the mapping onto the report model
  data/
    defaultConfiguration.ts      the official R-76 §3.3.3 example (grams and form draft)
  utils/
    mass.ts                      units, decimal parsing, exact microgram arithmetic, formatting
    numeric.ts                   tolerant comparisons (limit checks never use raw <, <=, >, >=)
    text.ts                      subscripts, ordinals, count formatting
    reference.ts                 how a rule citation is rendered
  testing/
    fixtures.ts, assertions.ts   test-only helpers
docs/
  r76-verified-extracts.md       verbatim quotes + printed page numbers for every limit used
.refs/
  R076-1-e06.pdf                 the source document the quotes were taken from (not in git)
```

**Domain logic is kept out of React.** `src/domain` and `src/utils` contain no React import and can
be executed and unit-tested on their own; the components only render what the domain returns.
`src/domain/report` goes one step further: it imports no resolver, no engine and no validator, and
`noDuplicateCalculation.test.ts` reads its source and fails if that changes.

---

## Rules implemented by the validator

All values are transcribed from **OIML R 76-1:2006 (E)** — see
[`docs/r76-verified-extracts.md`](docs/r76-verified-extracts.md) for the verbatim text and printed
page numbers. Every issue produced at runtime carries the same citation, plus a status:
`verified` (quoted clause), `derived` (combination of quoted clauses), `structural` (configuration
consistency, explicitly *not* an R-76 requirement) or `scope` (limitation of this build).

| Rule id | Requirement | Source |
| --- | --- | --- |
| `r76.4.2.2.1.display-division-form` | d must be 1 × 10ᵏ, 2 × 10ᵏ or 5 × 10ᵏ | §4.2.2.1 |
| `r76.4.2.2.1.verification-interval-form` | each eᵢ must be 1 × 10ᵏ, 2 × 10ᵏ or 5 × 10ᵏ | §4.2.2.1 + Table 2 + §3.4.1 (derived) |
| `r76.table2.d-equals-e1` | d = e₁ (no auxiliary indicating device permitted on a multi-interval instrument) | Table 2 + §3.4.1 (derived) |
| `r76.table3.e-band` | eᵢ must fall in a class III band: 0.1 g ≤ e ≤ 2 g, or 5 g ≤ e | §3.3.2 with Table 3 |
| `r76.table3.n-minimum` | nᵢ = Maxᵢ/eᵢ ≥ 100 (0.1 g ≤ e ≤ 2 g) or ≥ 500 (5 g ≤ e) | §3.3.1, §3.3.2 with Table 3 |
| `r76.table3.n-maximum` | nᵢ = Maxᵢ/eᵢ ≤ 10 000 | §3.3.1, §3.3.2 with Table 3 |
| `r76.3.4.3.min-capacity` | Min ≥ 20 d (Table 3 lower limit with e replaced by d) | §3.4.3 with Table 3 |
| `r76.3.3.1.max-increasing` | Maxᵢ strictly increasing (Minᵢ = Maxᵢ₋₁) | §3.3.1 |
| `r76.3.3.1.e-increasing` | eᵢ₊₁ > eᵢ | §3.3.1 |
| `r76.table4.partial-range-ratio` | Maxᵢ / eᵢ₊₁ ≥ 500 for every partial range except the last | §3.3.3 with Table 4 |
| `structure.weighing-range-non-empty` | Min < Max₁ (otherwise the weighing range is empty) | structural, T.3.1.4 |
| `structure.n-integral` | Maxᵢ a whole multiple of eᵢ — **warning only** | structural (no such clause in R 76) |
| `structure.single-partial-range` | one partial range in a multi-interval configuration — **warning only** | structural, T.3.2.6 |
| `input.*`, `scope.*` | required/positive input; class III and multi-interval only | structural / scope |

Rules that could **not** be verified from the official document are isolated in
`src/domain/pendingRules.ts` with `reason: 'not-verified'` and are **not** enforced —
for example "Maxᵢ must be an exact multiple of eᵢ" (warning only), "Min must be a multiple of d",
an upper bound on eᵢ₊₁/eᵢ, or a limit on Σnᵢ. A unit test asserts that no issue produced by the
validator carries one of those identifiers.

---

## Range resolution and MPE resolution

Implemented in `src/domain/resolution`, pure functions over the normalized range model. Four
rules govern the whole module; each of them has a dedicated unit test.

1. **`e` comes from the resolved partial weighing range.** There is no `instrument.e` and no
   `ranges[0].e` fallback in the code. If a value does not fall into a partial weighing range
   (below Min, above Max, not entered), the applicable interval is `null` and no limit is derived —
   the resolver reports that instead of substituting `e₁`.
2. **The load MPE is bracketed by the load.** `m = L / e_L`, never `I / e`, and never a global `e`.
3. **`e*` is resolved from `I_next` alone.** It equals `e_L` only when both quantities happen to
   fall in the same partial weighing range.
4. **An indication must be a value its own range can display.** A load is applied mass; an
   indication is a displayed value. `I` and `I_next` are checked against the scale interval of the
   partial weighing range they resolve into (see *Indication consistency* below); `L` is never
   subjected to that check, and a rejected indication is reported as entered.

### Range membership

A partial weighing range *i* is `(Minᵢ, Maxᵢ]` = `(Maxᵢ₋₁, Maxᵢ]`, with range 1 closed at Min.
The §3.3.3 example fixes this reading: the load 2 000 g is still in range 1 (`mpe = ± 1 e₁`) while
2 001 g is already in range 2 (`mpe = ± 1 e₂`). Values outside `Min → Max` resolve to
`below-weighing-range` / `above-weighing-range`; missing or unparsable values to `not-a-value`.

`resolveRanges` returns exactly the five fields the specification names:

```ts
RangeResolutionResult { range_L, range_I, range_I_next, e_L, e_star }
```

### Indication consistency

`src/domain/resolution/indicationConsistency.ts`. R-76 prints what an indicating device may show:
§4.2.2.2 lists the **"Allowed indications"** of each partial weighing range of a multi-interval
instrument with automatic changeover (`e₁ = 50 g → xxx.050 kg`, `e₂ = 100 g → xxx.100 kg`), and
T.3.2.2 defines `d` as "the difference between two consecutive indicated values". With `e = d`
(Table 2, and §3.4.1: a multi-interval instrument has no auxiliary indicating device) an indication
in partial weighing range *i* must be an exact multiple of `eᵢ` — tested on integer micrograms, so
no tolerance can let a value between two indications through.

The **next indication is an observation, not a convention**. A.4.4.3: weights of 1/10 `eᵢ` are added
"until the indication of the instrument is increased unambiguously by one scale interval (I + e)",
and its multi-interval note takes the interval from "the partial weighing range in which the
indication (I + e) appears". For the §3.3.3 example, `I = 2 000 g` (range 1, `e₁ = 1 g`) changing
over into range 2 (`e₂ = 2 g`) gives `I_next = I + e₂ = 2 002 g` — which is the pre-filled example.
`2 001 g` is rejected: it falls in range 2, but that range cannot display it.

| Quantity | Checked against a scale interval? |
| --- | --- |
| test load `L` | no — applied mass (`displayable` is `null`); `2 001 g` is an ordinary load with `m = 1 000.5 → ± 1.0 e₂` |
| indication `I` | yes — `eᵢ` of the range `I` resolves into |
| next indication `I_next` | yes — `eᵢ` of the range `I_next` resolves into; a rejection withholds `e*` |

Verified but **not** applied: §4.2.3 permits indications up to `Max + 9 e`. This build reports any
indication above `Max` as outside the weighing range (stricter) and records §4.2.3 in
`pendingRules.ts`.

### MPE chain

```text
L  ->  range_L  ->  e_L  ->  m = L / e_L  ->  Table 6 bracket (class III)  ->  absolute mpe = coefficient x e_L
```

Table 6 (§3.5.1), class III, initial verification — transcribed verbatim, brackets contiguous and
half-open (`lower < m ≤ upper`, so a boundary value belongs to the lower bracket):

| m | mpe |
| --- | --- |
| 0 ≤ m ≤ 500 | ± 0.5 e |
| 500 < m ≤ 2 000 | ± 1.0 e |
| 2 000 < m ≤ 10 000 | ± 1.5 e |

`MpeResolutionResult` keeps `m`, the Table 6 `bracket` row, the `coefficient`, `absoluteMpeGrams`
and the `sourceReference` — which is what the Phase 3 calculation trace prints, step by step.

Worked against the official example (Max = 2 / 5 / 15 kg, e = 1 / 2 / 10 g), the implementation
reproduces every line printed in §3.3.3:

| L | range | e | m = L / e | bracket | mpe |
| --- | --- | --- | --- | --- | --- |
| 500 g | 1 | e₁ = 1 g | 500 | 0 ≤ m ≤ 500 | ± 0.5 g |
| 2 000 g | 1 | e₁ = 1 g | 2 000 | 500 < m ≤ 2 000 | ± 1 g |
| 2 001 g | 2 | e₂ = 2 g | 1 000.5 | 500 < m ≤ 2 000 | ± 2 g |
| 4 000 g | 2 | e₂ = 2 g | 2 000 | 500 < m ≤ 2 000 | ± 2 g |
| 4 001 g | 2 | e₂ = 2 g | 2 000.5 | 2 000 < m ≤ 10 000 | ± 3 g |
| 5 000 g | 2 | e₂ = 2 g | 2 500 | 2 000 < m ≤ 10 000 | ± 3 g |
| 5 001 g | 3 | e₃ = 10 g | 500.1 | 500 < m ≤ 2 000 | ± 10 g |
| 15 000 g | 3 | e₃ = 10 g | 1 500 | 500 < m ≤ 2 000 | ± 10 g |

### Boundary probes

`boundaryProbes(instrument)` returns every boundary of the instrument, each with three fully
resolved probe loads:

| Boundary | below | at | above |
| --- | --- | --- | --- |
| Min | Min − e₁ (or 0 g) | Min | Min + e₁ |
| Maxᵢ (range changeover) | Maxᵢ − eᵢ | Maxᵢ | Maxᵢ + eᵢ₊₁ |
| Table 6 bracket edge | L − eᵢ | L = m × eᵢ | L + eᵢ |
| Max | Max − e_r | Max | Max + e_r |

For the default example that is six boundaries and eighteen probe loads: 19 / 20 / 21 g,
499 / 500 / 501 g, 1 999 / 2 000 / 2 002 g, 3 998 / 4 000 / 4 002 g, 4 998 / 5 000 / 5 010 g and
14 990 / 15 000 / 15 010 g. A bracket edge that coincides with a range boundary (m = 2 000 of
range 1 *is* Max₁ = 2 kg) is emitted once, as the range changeover. Probe points that fall outside
the weighing range are shown with the status the resolver gave them — nothing is filtered out.

The one-interval spacing of the probe loads is a presentation choice, **not** an R-76 requirement
(R-76 does not prescribe test loads); the panel says so in the table caption and the reference
object carries `status: 'structural'`.

---

## The digital weighing test (A.4.4.3)

`src/domain/evaluation/`. One observation goes in, one evaluation comes out — a pure function,
independent of React:

```ts
evaluateDigitalWeighingObservation(instrument: NormalizedInstrument, observation: TestObservationInput): EvaluationResult
```

`TestObservationInput` extends the Phase 2 `TestConditionInput` with `deltaLGrams` and `e0Grams`;
`EvaluationResult` carries `range_L`, `range_I`, `range_I_next`, `e_L`, `e_star`, `m`, the Table 6
`bracket` and `coefficient`, `mpeGrams`, `P`, `E`, `E0`, `Ec`, `absoluteEcGrams`, `marginGrams`,
`passed`, the `issues` that blocked it, the `references` it rests on — and the whole Phase 2
`resolution`, because there is exactly one range-resolution system in this codebase.

### The exact path

```text
L      ->  range_L      ->  e_L  ->  m = L / e_L  ->  Table 6 (class III, initial)  ->  mpe
I      ->  range_I      ->  displayable in e_I ?
I_next ->  range_I_next ->  displayable ?  ->  e*  ->  I_next − I must equal e*
                             |
                             v
                P = I + ½ e* − ΔL   ->   E = P − L   ->   Ec = E − E₀   ->   |Ec| ≤ mpe ?
```

The load side and the indication side are resolved **separately**: the mpe comes from `e_L` (the
partial weighing range of the load), the ½ e term from `e*` (the partial weighing range in which
`(I + e)` appears). At a transition `e* ≠ e_L`, and using `e_L` in the formula would give a wrong
`P` — the demo below shows the 0.5 g difference.

### The transition case that is pre-filled

The multi-interval example printed in §3.3.3 (Max = 2 / 5 / 15 kg, e = 1 / 2 / 10 g, Min = 20 g),
observed at the changeover at Max₁ = 2 kg:

| Quantity | Value | Resolves to |
| --- | --- | --- |
| L | 2 kg = 2 000 g | range 1 (20 g → 2 kg), `e_L = e₁ = 1 g` — Max₁ belongs to range 1 |
| I | 2 000 g | range 1, displayable (multiple of `e₁`) |
| ΔL | 1.4 g | added in steps of 1/10 `e₁` |
| I_next | 2 002 g | **range 2** (2 kg → 5 kg), displayable (multiple of `e₂`), `e* = e₂ = 2 g` |
| E₀ | +0.5 g | tester input (A.4.2.3), signed |

| Step | Value |
| --- | --- |
| `m = L / e_L` | 2 000 → bracket `500 < m ≤ 2 000` → `± 1.0 e₁` → **mpe = ± 1 g** |
| `P = I + ½ e* − ΔL` | `(2000 + 1 − 1.4) g` = **1 999.6 g** (with ½ `e_L` it would wrongly be 1 999.1 g) |
| `E = P − L` | `(1999.6 − 2000) g` = **−0.4 g** |
| `Ec = E − E₀` | `(−0.4 − (+0.5)) g` = **−0.9 g** |
| `|Ec| ≤ mpe` | `0.9 g ≤ 1 g` → **PASS**, margin 0.1 g |

With ΔL = 1.6 g instead: `P = 1 999.4 g`, `E = −0.6 g`, `Ec = −1.1 g`, `|Ec| > 1 g` → **FAIL**,
excess 0.1 g. Both observations ship as fixtures (`createExampleObservationDraft`,
`createFailingObservationDraft`); only the passing one is pre-filled.

The engine also reproduces the worked example printed in A.4.4.3 itself — an instrument with
`e = 5 g` loaded with 1 kg, indication 1 000 g, changeover at ΔL = 1.5 g:
`P = (1 000 + 2.5 − 1.5) g = 1 001 g`, `E = +1 g`, `Ec = +1 − (+0.5) = +0.5 g`.

### What is refused, and how

Nothing is calculated unless every quantity is present and admissible. A refused evaluation reports
the reason beside its field, repeats it in the result panel, and shows the trace stopped at that
step. The observation is passed through **unchanged** — no rounding, no completion, no invented next
indication.

| Situation | Message (rule id) |
| --- | --- |
| L, I, ΔL, I_next or E₀ missing | `ΔL is required to determine the changeover point.` (`r76.a4.4.3.additional-load-required`), `I_next is required for the digital changeover calculation.` (`…next-indication-required`), `Cannot evaluate: E0 is required for corrected error Ec.` (`…zero-error-required`) |
| ΔL negative | `ΔL = -1.4 g is negative: weights are added to the load receptor, so the additional load cannot be below zero.` (`r76.a4.4.3.additional-load-negative`) |
| L outside the weighing range | Phase 2 rule `r76.t3.1.4.load-outside-weighing-range` |
| I or I_next not displayable in its range | Phase 2 rule `r76.t3.2.2.indication-scale-interval`, e.g. `Invalid next indication: … 2001 g is not a multiple of 2 g (2001 g / 2 g = 1,000.5).` |
| I_next ≤ I | `r76.a4.4.3.changeover-not-increased` |
| I_next − I ≠ e* | `r76.a4.4.3.changeover-not-one-interval` — e.g. a step of 2 g where `e* = 1 g` |
| configuration not validated | the screen asks for the instrument first; nothing is evaluated against a draft |

`E₀ = 0` **is** evaluated (a measured zero error of exactly zero is a value, not a missing one), and
equality passes: `|Ec| = mpe` is inside the limit, which Table 6's note states as an absolute value.
One microgram more fails — the comparison is done on integer micrograms, with no tolerance.

### The calculation trace

Ten deterministic steps, always the same ten, rendered as a list (not an explanation):
load range → `e_L` → mpe → indication range → next indication range → `e*` → `P` → `E` → `E₀`
correction → `|Ec|` vs mpe. Each step prints what it produced and the clause it rests on; a step
that could not be completed says why, and the header counts how many completed.

---

## The result and the report (Phase 4)

One calculation, one mapping, three renderings. The Phase 3 evaluation produces an
`EvaluationResult`; `buildWeighingReport` maps it onto a `WeighingReport`; the result view, the
result table and the printed document all render that model.

```text
Phase 3 EvaluationResult
        │  buildWeighingReport — readiness gates, then mapping (no arithmetic)
        ▼
   WeighingReport ──► ResultSummary  (four groups + one verdict banner)
        │          ──► ResultTable    (the fifteen columns, grouped)
        │          ──► ReportDocument (sections A–F, A4 printable)
        └──────────► print / save as PDF (browser dialog, document only)
```

### What the report layer is not allowed to do

It does not resolve a partial weighing range, look up a Table 6 bracket, halve an interval, subtract
one mass from another, take an absolute value or compare an error with a limit. It reads fields the
evaluation already filled — `result.P`, `result.E`, `result.Ec`, `result.absoluteEcGrams`,
`result.marginGrams`, `result.halfEStarGrams`, `result.m`, `result.mpeGrams`, `result.mpeBracket`,
`result.passed` — and pairs each with the text the report prints. Every `ReportedMass` keeps the
grams it was given, so a test can compare the report with the result by identity.

`noDuplicateCalculation.test.ts` enforces this by reading the source of the layer: an allow-list of
imports, a ban on every resolver, engine and validator module, a ban on arithmetic and table-lookup
calls, a restriction of the R-76 table module to `describeMpeCoefficient` (the printed form of a
coefficient the resolver already chose) and of the mass utils to `formatMass` and `trimNumber`, and
the requirement that `buildWeighingReport` is the only exported function.

### The readiness gates

A report is generated only when all six gates are satisfied. Each one says what it read, and from
where:

| Gate | Satisfied when |
| --- | --- |
| Input data | L, I, ΔL, I_next and E₀ are all present |
| Configuration | the instrument is validated, and the evaluation was performed against *this* instrument |
| Calculation | the evaluation produced P, E and Ec (not blocked) |
| Range resolution | `range_L`, `range_I`, `range_I_next`, `e_L` and `e*` are all resolved |
| MPE | `m`, the Table 6 bracket and the absolute mpe are resolved |
| Result | the evaluation produced a verdict |

Otherwise the outcome is `not-ready` with a headline (**REPORT NOT READY**), a summary and one reason
per open gate — and it carries no report object at all, so no code path can render a document with a
hole in it. With E₀ missing, that chain reads on screen as: the test area refuses to evaluate
(“Cannot evaluate: E0 is required for corrected error Ec.”), the Input data gate reports
“Incomplete — E₀ is missing.”, the Calculation gate reports the blocked evaluation, the Result gate
reports that no verdict was produced, and **Generate report** stays disabled.

### The result table

Fifteen columns, grouped by the part of the evaluation they belong to, one row per test point, all
masses in grams:

| Group | Columns |
| --- | --- |
| Observation | `L`, `I`, `ΔL`, `I_next` |
| Resolved context | `range_L`, `range_I`, `range_I_next`, `e_L`, `e*` |
| Calculation | `P`, `E`, `E₀`, `Ec` |
| Compliance | `MPE`, `Result` |

For the pre-filled transition observation the row reads:

```text
2000 · 2000 · 1.4 · 2002 · 1 · 1 · 2 · 1 · 2 · 1999.6 · −0.4 · +0.5 · −0.9 · ± 1 · PASS
```

Nothing is hidden behind the table, and nothing is repeated beside it: the two chains of §7 —
`L → range_L → e_L → m → Table 6 bracket → mpe` and, separately, `I → range_I;
I_next → range_I_next → e*` — the substituted formulae and the range-aware notes the resolution
carried are printed once each, in sections C and D of the document, and are on the test screen while
the observation is being evaluated.

### The document

Title **R-76 Weighing Performance Evaluation — Prototype**, header lines *Instrument*, *Accuracy
Class*, *Evaluation Type* and *Generated*, then:

* **A. Instrument identification** — the configuration that identifies the instrument (no make,
  model or serial number exists in the data model, and the document says so instead of leaving a
  blank field), class and type, Min → Max, `d`, and the table of partial weighing ranges with `eᵢ`
  and `nᵢ`.
* **B. Test observation** — the test performed, the evaluation type, the indication mode (`e = d`,
  no auxiliary indicating device), the test condition, the five entered quantities, where E₀ came
  from, and the confirmation that `I → I_next` really is one scale interval of the range `(I + e)`
  appears in.
* **C. Resolved metrological context** — `range_L`, `range_I`, `range_I_next`, `e_L` and `e*`,
  whether each indication is displayable in the range it falls in, the two chains of §7, and the
  range-aware notes the resolution carried (a boundary, an exempt range, an unresolved `e*`).
* **D. Calculation** — the four substitution lines of A.4.4.3 as a table, and the ten steps of the
  calculation trace, both printed from the same model the test screen shows.
* **E. Compliance** — **PASS** or **FAIL** with the comparison that produced it, `m`, the Table 6
  bracket, the coefficient, the mpe, `|Ec|` and the margin, the result table, the basis for treating
  one weighing result as a result (§3.6, quoted in section F), and what this evaluation does *not*
  cover: in-service limits (§3.5.2), repeatability and eccentric loading (§3.6.1, §3.6.2), the test
  suite of A.4.4.1, the determination of E₀ (A.4.2.3), tare and influence factors, uncertainty and
  any grey zone, other accuracy classes and multiple-range instruments.
* **F. Technical reference** — only the clauses this evaluation rests on, each with the verbatim
  quote behind it. Clauses that are recorded but not applied are never cited here.

The prototype notice is printed at the top and in the footer: the document is not an OIML
certificate, not a government or statutory approval and not a legal metrology certificate, and
verification remains the responsibility of the competent legal metrology authority.

### Printing

`@page { size: A4 portrait; margin: 14mm }` plus an `@media print` block that hides the top bar, the
footer, the work areas, the working result view, the gates and the buttons, and keeps
`#report-document` alone; table headers repeat on every page, rows and sections are not split, and
`print-color-adjust: exact` keeps the verdict legible on paper. **Print / save as PDF** calls
`window.print()` — the browser's “Save as PDF” is the PDF. No PDF library, no server.

### Structured for more than one test point

`WeighingReport.testPoints` is an array and every section reads from it, so a weighing test as a
series (A.4.4.1) can fill it later without reshaping the model. This build evaluates one
observation, so the array holds one entry, and the overall verdict is PASS only when every test
point passed.

---

## Tests

```bash
npm test
```

437 tests in 22 files:

* `src/domain/validation/validateConfiguration.test.ts` (46) — valid multi-interval configuration
  (including the published example and its Table 3 / Table 4 boundary values), decreasing Max,
  non-increasing e, invalid e values (wrong form and wrong band), invalid n = Max/e relationships,
  invalid Min, invalid partial-range relationship (Table 4), unit-conversion consistency, scope
  guards and rule provenance.
* `src/domain/normalizeConfiguration.test.ts` (9) — the range model: Minᵢ = Maxᵢ₋₁ with Min₁ = Min,
  nᵢ, Table 4 ratios, Table 3 band per range, incomplete input, fractional n.
* `src/utils/mass.test.ts` (13) — g/kg conversion, decimal parsing, exact microgram arithmetic
  (including the IEEE-754 traps `0.3 / 0.1` and `1.005 kg`), the 1/2/5 × 10ᵏ form check, formatting.
* `src/pages/ConfigurationPage.test.tsx` (5) — render smoke test of the screen and the shell.
* `src/pages/ConfigurationPage.interaction.test.tsx` (9) — the workflow a user performs: press
  *Validate configuration*, see *Configuration valid* / *Configuration invalid*, see each message
  beside its field, add and remove a partial range, switch a field from kg to g without changing
  the mass, reset to the example.
* `src/domain/resolution/rangeResolver.test.ts` (35) — a load in each partial weighing range, all
  six boundary positions around 2 kg and 5 kg, the applicable `e` per range (never `e₁`), values
  below Min / above Max / missing, indications and next indications, `e_L` and `e*`, kg↔g safety,
  and displayability (`null` for every load, `true`/`false` for indications, `e*` withheld for a
  next indication its range cannot display).
* `src/domain/resolution/indicationConsistency.test.ts` (17) — the two required cases first:
  `I = 2 000 g` with `I_next = 2 001 g` is **not** accepted as a changeover indication of a range
  whose `e₂ = 2 g`, and `I_next = 2 002 g` **is**; the entered value is never modified; the
  explanation quotes A.4.4.3; the same `2 001 g` is an ordinary load; displayability per range
  including a `0.1 g` interval; the field-message mapping and the table labels.
* `src/domain/resolution/mpeResolver.test.ts` (64) — every line of the §3.3.3 mpe walk-through, all
  Table 6 class III bracket edges from both sides, the verified boundaries of all four accuracy
  classes, loads with no limit (below Min, above Max, missing, outside Table 6), the `1.5 × 0.1 g`
  float trap, kg↔g safety, and the scope bookkeeping against `pendingRules.ts`.
* `src/domain/resolution/boundaries.test.ts` (14) — the probe groups of three instruments
  (multi-interval example, single range, 0.1 g interval): which boundaries exist, the three probe
  loads of each, what changes across them, exact mass arithmetic, and that a bracket edge
  coinciding with a range boundary is not duplicated.
* `src/domain/resolution/resolveTestCondition.test.ts` (21) — the composition (`m` and the Table 6
  coefficient use the same `e_L`; I and I_next never influence the load mpe), the test-condition
  draft model and its unit handling, and the wording the panel renders.
* `src/pages/ConfigurationPage.resolution.test.tsx` (22) — the panel as a user sees it: it appears
  only for a valid configuration, resolves the pre-filled load at Max₁, follows a typed load into
  range 3, reports a load below Min without falling back to `e₁`, reports a cleared load as
  missing, updates `e*` when I_next crosses a changeover, and shows all boundary probes including
  the `Use` button that copies a probe load into the field, plus the indication-consistency
  behaviour on screen (the pre-filled `I_next = I + e₂ = 2 002 g` changeover, the rejection of
  `2 001 g` at its field with `e*` withheld and the value left untouched, and the load exemption).

* `src/domain/evaluation/evaluateObservation.test.ts` (37) — the calculation matrix: a normal
  observation inside one partial weighing range; the transition observation (`e_L ≠ e*`, and the
  wrong `P` that ½ `e_L` would give); a transition into range 3 (`e* = e₃`); loads exactly on a
  range boundary and on a Table 6 bracket edge; the verdict comparison at the limit, one microgram
  inside and one microgram outside, on both the positive and the negative side; the A.4.4.3 worked
  example (e = 5 g) reproduced exactly; every blocked case (missing ΔL, negative ΔL, inadmissible
  I_next, inadmissible I, missing E₀, missing L, load outside the weighing range) with all
  intermediates `null`; the changeover relationship; kg↔g safety; a fractional interval
  (`½ e* = 0.05 g`); that the observation is never modified; and the scope bookkeeping against
  `pendingRules.ts`.
* `src/domain/evaluation/validateObservation.test.ts` (20) — the exact wording and rule id of every
  reason an evaluation can be refused, their order, the reuse of the Phase 2 indication rule, `e*`
  withheld for a rejected next indication, `E₀ = 0` and `ΔL = 0` accepted, a load at Min and at Max
  (where the changeover would need an indication above Max), and pass-through of the observation.
* `src/domain/evaluation/describe.test.ts` (23) — the strings on screen: signed formatting, the
  verdict word and the comparison it states (margin, excess, exactly at the limit), `e*` named with
  its range, the four substitution lines, the ten trace steps in order with their clause and their
  `completed` flag for every blocked case, determinism, and the one-line summaries.
* `src/pages/ConfigurationPage.observation.test.tsx` (23) — the screen as a tester uses it: the three
  work areas and which one opens first, the instrument summary, the pre-filled observation and its
  units, nothing calculated before **Evaluate**, all three ranges and both intervals visible, the
  substitution with ½ `e*`, the PASS and FAIL banners, the ten trace steps, every refusal on screen
  with the value left untouched, the result dropped when a field is edited, a result never shown
  again for a changed instrument, the reset button, and the clauses listed.

* `src/domain/report/buildReport.test.ts` (29) — the report layer: the six gates in order and what
  each satisfied gate says it read; not-ready, with no report object, for a missing instrument, for
  no evaluation, for an evaluation of a different instrument, for missing E₀, for missing ΔL, for an
  I_next the range cannot display, for an I_next that is not one scale interval above I and for an
  I_next that does not lie above I; identity of every reported mass, interval, range number, `m`,
  bracket, mpe, |Ec| and margin with the evaluation result; the substitution lines and the ten trace
  steps equal to the ones the evaluation printed; the five resolved values of the transition case
  and both §7 chains; the fifteen table values in grams with their signs; PASS, FAIL and PASS at the
  limit; the title, the notice, the identification note, the range table, the test information, the
  provenance of E₀, the clause list (with the clauses that are *not* applied absent) and the printed
  timestamp.
* `src/domain/report/noDuplicateCalculation.test.ts` (8) — reads the source of the report layer and
  fails if it imports anything outside the allow-list, imports a resolver, the engine, a validator or
  the normalizer, imports React or a component, contains arithmetic or a second R-76 table lookup,
  takes more than `describeMpeCoefficient` from the table module or more than `formatMass` and
  `trimNumber` from the mass utils, exports a second function, or compares a mass with an operator
  instead of reading `result.passed`.
* `src/pages/ConfigurationPage.report.test.tsx` (16) — the flow end to end: the result area before
  any evaluation (five open gates, disabled **Generate report**, no document, no verdict anywhere);
  without a validated configuration; the four groups after evaluating the transition, and the ten
  trace steps in the generated document rather than repeated on the result screen; the fifteen
  columns of the result table; the generated document — title, header lines, sections A–F, ranges,
  resolved context, calculation, trace, verdict, scope limits and the §3.6 quote — with its table
  equal to the one on screen; that the document claims no certificate, no authority and no competition
  branding; that it offers no third verdict (and mentions a grey zone only where it discloses that
  it does not model one); that printing calls `window.print()` once and only after a document
  exists; FAIL and PASS-at-the-limit through the document; E₀ missing, I_next undisplayable and
  I_next not one interval above I blocked from the test area all the way to the document; a generated
  document dropped when the observation changes and regenerated from the new one; the same when the
  instrument is edited, because the evaluation is then stale; and one evaluation surviving the walk
  through all three areas.

* `src/domain/report/boundaryMatrix.test.ts` (16) — **Phase 5 §14**: the six boundary positions of
  the §3.3.3 example (just below, exactly at and just above Max₁ = 2 kg and Max₂ = 5 kg), each with a
  valid changeover observation, asserting `range_L`, `range_I`, `range_I_next`, `e_L` and `e*`, the
  limit chain (`m`, Table 6 bracket, mpe), the arithmetic (`P`, `E`, `Ec`, verdict), that the entered
  grams are carried through unchanged and that fractional `m` (1 000.5, 2 499.5, 500.1) is never
  rounded — and then the same values read back out of the report model: table cells, range and
  interval labels, bracket, both transparency chains and the verdict.
* `src/pages/ConfigurationPage.boundary.test.tsx` (2) — the second changeover on screen: a load
  exactly on Max₂ = 5 kg with I_next = 5 010 g, asserting that the test panel shows the load side
  (range 2, e₂ = 2 g, m = 2 500, ± 3 g) apart from the indication side (range_I = 2,
  range_I_next = 3, e* = e₃ = 10 g), and that the fifteen columns of the generated document's table
  are cell-for-cell equal to the result view's.
* `src/pages/uiText.test.tsx` (5) — **Phase 5 §25**: renders the configuration area (fresh, rejected,
  accepted, with a changeover and with a next indication outside the weighing range), the test area
  (evaluated, blocked, refused) and the result area (before and after generation, and blocked) and
  fails on any markup artefact, unfinished-work marker, demo wording, competition reference,
  future-feature promise or unresolved value (`undefined`, `NaN`, `[object Object]`) in the rendered
  text.
* `src/pages/consoleHygiene.test.tsx` (3) — **Phase 5 §19**: the same walk-through with `console.error`
  and `console.warn` captured, asserting that using the application produces no console output at all.

Test-only development dependencies: `vitest`, `jsdom`, `@testing-library/react` and
`@testing-library/dom`. The application itself depends on `react` and `react-dom` only.

---

## Phase 5 — polish and verification

Phase 5 changed no rule, no formula, no data model and no architecture. It corrected what the
interface said, made two sides of a resolution impossible to read as one, removed what nothing used,
and verified the boundary behaviour the earlier phases were built for.

**Interface**

* The validation banner carries the mark the specification asks for — `✓ Configuration valid`,
  `✕ Configuration invalid` — with the mark `aria-hidden`, so a screen reader hears the words and not
  "check mark" before them.
* Both resolution tables (the *Test load resolution* panel and the *Ranges and limits* table of an
  evaluation) are now grouped by side: **LOAD SIDE** — `range_L`, `e_L`, `m`, Table 6 bracket, mpe —
  and **INDICATION SIDE** — `range_I`, `range_I_next`, `e*`. The group rows are plain cells, so no
  row header was added or renamed and the two sides cannot be read as one `e`. *(Phase 6 states the
  same separation in the layout instead: the probe panel became the **Range Probe** disclosure, and
  the resolution of an evaluation became two tables side by side, **Load side** and **Indication
  side**.)*
* Each partial weighing range row shows where it starts, taken from the validated range model:
  `Range 1  20 g →`, `Range 2  2 kg →`, `Range 3  5 kg →`, beside the `nᵢ = Maxᵢ / eᵢ` already shown.
  *(Phase 6 gave both derived values their own columns: **Minᵢ** — tinted, dotted, titled with the
  Maxᵢ₋₁ it comes from — and **nᵢ**, so neither can be read as something the tester typed.)*
  The chain `Min → Max₁ → Max₂ → Max₃` of a multi-interval instrument is therefore visible where it is
  edited, and appears only once the validator has accepted it.
* The result view states what was tested above the verdict — *Weighing test — evaluation of error at a
  changeover point · Initial verification* — so the first question the screen has to answer is answered
  first.
* Stray markup was removed from user-facing prose (the weighing test's subtitle printed literal
  backticks around `e_L` and `e*`), and the words *undefined* and *m undefined* were replaced by
  *not resolved* / *not defined* / *no e\* applies*, which say what is missing instead of naming a
  programming state.
* Narrow windows (smaller laptop, split screen, tablet) now stack the readiness gates, the document's
  fact lists and the detail chains, tighten the document's padding and shrink the result table; the
  desktop layout is unchanged.

**Verification**

* The boundary matrix above (§14) is the technical core of this phase: six positions around the two
  changeovers of the official example, five resolution values each, fractional `m` preserved exactly,
  and the report model carrying the same values as the evaluation.
* The blocked report is a heading (`REPORT NOT READY`) inside a status region, so it is announced;
  the generated document is a labelled region (`aria-labelledby` on its title).

**Removed as unused** — the `variant` prop of `IssueMessages`, the `disabled` prop of `MassField`,
`ReportInstrument.minText` and `.maxText`, `ReportInstrumentRange.intervalSymbol`, and the CSS rules
`.detail-note` and `.readonly-value`. No component, no test and no style rule that anything renders
was deleted.

---

## Phase 6 — the workbench layout

Phase 6 is layout only. It changed how the three work areas are arranged on screen and how dense
they are; it changed no calculation, no rule, no formula, no table value and no data model. The demo
dataset is untouched, the §3.3.3 transition example is untouched, and the separation of `e_L` (the
interval of the partial range the load falls in) from `e*` (the interval of the range in which `I + e`
appears, which is what the `½e` term of A.4.4.3 takes) is untouched.

Measured against the Phase 5 backup, 46 of the 48 files under `src/domain/**` are byte-for-byte
identical. The two that differ produce wording, not numbers, and both predate this layout pass:
`traceSummary()` in `evaluation/describe.ts` (the “10 of 10 steps completed” line a disclosure shows
beside its title) and the six section titles in `report/content.ts` (A–F, so the screen and the
document name the same sections). Every resolver, validator, MPE chain and formula is unchanged.

An earlier attempt at this phase stacked everything vertically — a step strip above the tabs, five
full-width observation fields each with a paragraph under it, and the verdict below two range panels
below the calculation — which put the result of an evaluation off the screen and read like a long
form rather than a laboratory tool. It was rejected and replaced by the layout below. The rejected
state is kept as `backups/NIYAM_Phase6_UI_Redesign_Backup.zip`, and the static state sheet it shipped
(`design-review.html`) was deleted: it dumped `document.body.innerHTML`, and because React sets a
controlled `<select>` through the DOM property, every unit selector in that dump rendered its first
option. It showed `g` where the application shows `kg`, and it is not a way to look at this app.

### The chrome

Fixed heights, one navigation, and no third level of wayfinding:

| Part | Height | Contents |
| --- | --- | --- |
| Header | 48 px | navy `#0b2540`, one row: `NIYAM` · 1 px divider · “Range-Aware R-76 Test Engine” · spacer · two 22 px chips, `OIML R 76-1:2006` and `Prototype` |
| Tabs | 40 px | white, 1 px bottom rule `#e4e7ec`, the open area underlined in 2 px navy and set in navy — no pills, no cards |
| Body | the rest of the window | max-width 1280 px centred on `#f6f7f9`, padding 16 px vertical / 20 px horizontal, one split pane |
| Footer | 28 px | one muted line: “Prototype evaluation record · this application does not issue legal certificates.” |

There is no stepper and no breadcrumb. The title of the area being worked in is inside the body and
is the largest type on screen (18 px). Radius is 4–6 px, and the only shadow in the application is
the paper’s.

### The split

Every work area is two panes side by side, each a white card that owns its own scrolling, so nothing
in one pane can push the other off the screen and an action row never moves:

| Area | Grid | Left | Right |
| --- | --- | --- | --- |
| Instrument configuration | `1.15fr 0.85fr` | the form: 2 × 2 instrument grid, partial ranges table, `+ Add range`, then a pinned action row (`Validate configuration` · `Reset to R-76 example` · the checks line) | before validation, one line — “Validate the configuration to see the range model.”; after it, a 40 px banner, the normalized range model, and the two closed disclosures `Range Probe` and `Range Boundaries` |
| Digital weighing test | `420px 1fr` | the instrument strip, the five entered observations as a 2 × 3 grid, one helper line, then the pinned action row (`Evaluate` as the 36 px hero · `Reset to transition example`) | `No result yet.` before Evaluate; after it, the verdict banner, the resolved range context, the A.4.4.3 calculation, and the two closed disclosures |
| Test result and report | `1fr 360px` | the verdict banner, the record in four cells, the result table, the six readiness gates, then the pinned action row (`Generate report` · `Print / save as PDF`) | the A4 document, scaled to the column; before generation, an empty sheet of the same size |

At 1280 × 720 this keeps the work above the fold: the fields, the range table and `Validate
configuration` on the first area; the observation grid and `Evaluate` on the second, and after
Evaluate the verdict; the verdict, the record and `Generate report` on the third.

### Density

| Thing | Metric |
| --- | --- |
| Inputs | 32 px, 13 px type, `#d0d5dd` rule, radius 4 px |
| Labels | 12 px / 550 `#344054`, with the quantity symbol in mono before the name |
| Helper text | one 11 px line for a whole grid — never an essay under each field |
| Section kickers | 10 px / 700 / 0.08em with a 3 × 10 px bar: ENTERED blue, RESOLVED teal, CALCULATED navy |
| Range rows | 36 px; resolution rows 22 px; trace rows 28 px; readiness rows 28 px |
| Status banner | 40 px for a configuration verdict, at most 48 px for the verdict of an evaluation |
| Primary buttons | navy, 32 px, and 36 px with a 120 px minimum for the one action a screen exists for |

### The four defects this phase fixed

* **A derived minimum was blank.** The Min column of the partial ranges table showed `—` until the
  configuration had been validated. Minᵢ is not entered — Min₁ is `Min` and Minᵢ is Maxᵢ₋₁
  (§3.3.1) — so the form now derives it from the draft chain while typing, and the column always
  shows a mass. It stays read-only, tinted and dotted, so it cannot be mistaken for an input.
* **Unit selectors appeared to hold the wrong unit.** They did not: `src/data/defaultConfiguration.ts`
  has always carried `kg` for the 2 / 5 / 15 kg capacities, and the application renders `kg`. The
  wrong values were in the static state sheet, which could not represent a React-controlled
  `<select>`. The sheet is gone.
* **A hollow box beside the corrected error — real, and fixed.** The report read “Xe*”. `½` was never
  the problem: U+00BD is in the Inter and JetBrains Mono subsets this application ships, and the trace
  has always printed `½e*`. The box was the small-capital c of the corrected error — U+A700 MODIFIER
  LETTER CHINESE TONE YIN PING. Measured against the fonts the application actually loads (every
  declared `unicode-range`, then the cmap of every subset file), neither family carries it, and
  neither does the fallback: DejaVu Sans, the widest-coverage system font there is, has no U+A700, so
  the character drew a box on screen and on paper. It is now spelled `Ec` with a plain c — the form
  the verified transcript of A.4.4.3 in `docs/r76-verified-extracts.md` already used — which both
  shipped families carry, so the notation no longer depends on a glyph the reader’s machine may not
  have. 141 occurrences across 24 files; formulae, values and clause references untouched.
* **Legal prose was repeated on every screen.** The scope statements now appear once per screen where
  they belong — one `.scope-line` under the calculation on the test screen — and the disclaimer
  appears once in the 28 px footer and once on the paper.

### Glyph coverage

Every non-ASCII character the interface renders was checked against the two variable fonts it ships
(`@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`) — first by the `unicode-range`
each `@font-face` declares, then by the cmap of the subset file that range points at:

| Characters | Served by the shipped webfonts |
| --- | --- |
| `§ ± µ · ½ × Δ – — ’ “ ” … − ᵢ ᵏ` and the plain `c` of `Ec` | yes |
| `₀ ₁ ₂ ₃ ₊ ₋ → ≤ ≥ ≠ ✓ ✕ ✗` | no — these fall back to the system font |

The second row was left as it is on purpose: those codepoints are in every mainstream system font
(measured here in DejaVu Sans, DejaVu Sans Mono and the Noto CJK families), so they render everywhere
— with the system’s metrics rather than Inter’s, but they render. What must never happen is a
character no font has, because that draws a box. `uiText.test.tsx` now fails if a Modifier Tone Letter
(U+A700–U+A71F), a Private Use Area codepoint (U+E000–U+F8FF) or a replacement character (U+FFFD)
reaches the screen.

### What stayed exactly as it was

The five observation fields and their unit selectors (`Unit for Test load L`, `Unit for Additional
load ΔL`, `Unit for Zero error E₀`), the pre-filled transition values (L = 2 kg, I = 2000 g,
ΔL = 1.4 g, I_next = 2002 g, E₀ = +0.5 g), the ten calculation steps and their wording, the two
resolution chains, the six readiness gates, the result table’s fifteen columns, the document’s six
sections A–F, the stale-evaluation rule, the discard-on-edit rule, `window.print()` as the only
output path, and the fact that a FAIL report is allowed while NOT EVALUATED blocks generation.

### Test contract changes

437 tests in 22 files, as before. Only three page tests were touched, each because a label moved:

* the instrument strip is one line plus three wrapping chips — `Class III — multi-interval`,
  `Min 20 g → Max 15 kg`, `d = e₁ = 1 g`, and a chip per partial range
  (`2 · 2 kg → 5 kg · e₂ = 2 g`, with `Range 2 · n₂ = 2,500` as its title);
* the rows of the two resolution tables are named with the symbols the calculation uses —
  `range_L`, `e_L`, `m = L / e_L`, `Table 6`, `MPE` on the load side, `range_I`, `range_I_next`,
  `e*`, `I displayable`, `I_next displayable` on the indication side — and are addressed by exact
  header, because `range_I` is a prefix of `range_I_next`;
* the qualifying wording moved out of the cells and into the head of the section that holds them:
  the cell says `± 1 g (± 1.0 e₁)` and the head says `initial verification · class III`, and the
  sentence that explains `e*` is the title of its cell.

## The result screen fixed, and the build made deployable

Four corrections on the third work area and the files a host needs to serve the build. Nothing else
moved: `src/domain/**` is untouched, so every rule, formula, resolution and dataset is exactly what
the phases before this one verified and tested.

### The verdict banner is one line

On the result screen the banner had grown into a column — `PASS`, then `|Ec|`, then `=`, then
`0.9 g`, one word per line. The cause was the counts beside it: `.status-meta` was `flex: none` with
`margin-left: auto`, and its `.status-counts` child was `white-space: nowrap`, so the sentence
`Digital weighing · Initial verification · one test point · 1 passed · 0 failed` took its full
intrinsic width off the same flex row and left the verdict a few pixels wide. `.status-verdict` then
did what a flex container does with no room: it wrapped.

The banner now has a `metaLine` variant. Where the counts are a sentence they take a second row of
their own (`flex: 1 0 100%`, left-aligned under the verdict), and the verdict row is held to one
line: `.status-verdict { flex-wrap: nowrap }`, `.status-word { flex: none }`, and the comparison
itself `nowrap` with an ellipsis, so a narrow window clips the end of a formula rather than stacking
it. Two rows of 19 px and 15 px inside 6 px of padding: one 48 px block, the same component and the
same tones as the test screen, for PASS, for FAIL and for the not-ready states. The configuration
banner on the first screen keeps its counts at the right edge, because `0 errors · 0 warnings` is
short enough to share a 40 px line.

### The record is two by two, and one line per fact

The four groups — Instrument · Observation · Resolved · Compliance — are a 2 × 2 grid instead of one
row of four, so each cell is half the pane wide rather than a quarter. Inside a cell the facts are
now one line each (`.detail-list` is a grid of `auto minmax(0, 1fr)`): the name at the left, the
value at the right. Seven facts are seven lines; a name stacked over its value made fourteen, which
is what pushed the result table and the gates down. `overflow-wrap` on a value is `break-word`
rather than `anywhere`, so `Range 1 (20 g → 2 kg)` breaks at a space if it must break, and never
inside a number or a unit.

### The document appears when the six gates are satisfied

The pane on the right showed an empty sheet until `Generate report` was pressed, so a PASS on the
left and “Report appears here…” on the right were two different answers to one question. The pane now
shows the document as soon as `buildWeighingReport` returns `status: 'ready'` — the same model the
result view and the result table are reading, built by the same call, so there is still one source of
truth and no third rendering. `Generate report` remains the stamp: it rebuilds the document with the
time it was generated and unlocks `Print / save as PDF`. Until it is pressed, one 11 px line above the
sheet says so (`Preview of the document · Generate report stamps the time it was generated and
enables printing.`), because the document prints a `Generated` fact and that time is provisional.
Where the gates are not satisfied there is no document at all, and the empty sheet says why.

### Values do not break in the middle

The body cells of the range model are `nowrap`, so `2 kg` and `20 g → 2 kg` stay in one piece; the
`.table-scroll` box around the table scrolls sideways if a window is too narrow for six columns, and
the page does not. `.resolution-value` is `nowrap` for the same reason, and its panel scrolls
sideways rather than clipping. The trace keeps printing `½e*` (U+00BD, in both shipped families).

### Deploying the build

`npm run build` (`tsc -b && vite build`) writes the whole application to `dist/`, and `vite.config.ts`
sets `base: '/'` explicitly so the asset URLs are absolute from the root of whatever host serves them.
There is no server process, no API, no database and no environment variable: the calculation runs in
the browser.

* `render.yaml` — a Blueprint for one static site: `runtime: static`, `buildCommand: npm ci && npm
  run build`, `staticPublishPath: ./dist`, a rewrite of `/*` to `/index.html`, and
  `X-Content-Type-Options: nosniff` on every path. Validated against Render’s own JSON schema
  (`https://render.com/schema/render.yaml.json`), where the static-site keys are `staticPublishPath`,
  `headers` and `routes` — a `rewrites` key is not in the schema and would be ignored.
* `public/_redirects` — the same rewrite, for a host that reads that file from the published
  directory instead of the Blueprint.
* `README_DEPLOY.md` — the fifteen lines it takes to connect the repository and deploy.
* `.nvmrc` and `engines` in `package.json` — Vite 8 needs Node `^20.19.0 || >=22.12.0`, and a build
  host that picks an older Node fails before it reaches the application.
* `preview/` is `.gitignore`d: it is the copy of the build this workspace serves locally, and `dist/`
  is the deployable one.

### Test contract changes

438 tests in 22 files — the 437 of Phase 6 plus one for the new behaviour of the right pane. Four
assertions changed, all of them about *where* something is rather than what it says, because the
document now exists before `Generate report` is pressed:

* `resultTables()` finds two tables in the ready state instead of one — the result screen’s and the
  document’s — and both are asserted to hold the same fifteen values;
* the rules “the resolved values are in the record” and “the ten steps of the trace are not on this
  screen” are now asked of `.pane-result-main`, the result screen, because the paper beside it prints
  the trace from the same model and would otherwise answer for it;
* the boundary case at Max₂ expects the same two tables before generation;
* “drops a generated document when the observation changes” keeps its point — the document stamped
  from the old evaluation is gone — and now also asserts that what the pane shows is built from the
  new one (ΔL 1.5, not the 1.4 it was generated from).

## Notes for the next phase

* `resolveTestCondition(instrument, { L, I, I_next })` is the entry point the evaluation uses: it
  returns `range_L`, `range_I`, `range_I_next`, `e_L`, `e*`, `m`, the Table 6 bracket and the
  absolute mpe, each with the clause it came from — plus `check_I`, `check_I_next`,
  `indicationsAccepted` and `issues`. `EvaluationResult.resolution` carries it through unchanged, so
  a later phase reads the resolution from the evaluation result instead of resolving a second time.
* `evaluateDigitalWeighingObservation` evaluates **one** observation. A weighing test (A.4.4.1:
  ≥ 10 test loads including Max, Min and the loads near which the mpe changes, increasing and then
  decreasing) is a sequence of those evaluations plus a report; nothing in the engine assumes a
  series, and nothing stores one. The report model is already shaped for it:
  `WeighingReport.testPoints` is an array, `ReportResult` counts passed and failed points, and the
  overall verdict is PASS only when every point passed. What a series needs is a place to keep
  several evaluations (and the increasing/decreasing order of A.4.4.1), plus a `buildWeighingReport`
  that maps all of them — the mapping of one point is written and tested.
* `buildWeighingReport({ instrument, evaluation, generatedAt })` is the only entry point of the
  report layer, and it is pure: the caller supplies the timestamp, so a test can pin it. It returns
  either `{ status: 'ready', checks, report }` or `{ status: 'not-ready', checks, headline, summary,
  reasons }` — the second variant has no `report` field, which is what makes a partial document
  unrepresentable. Keep it that way when the model grows.
* Verified but deliberately not applied: §4.2.3 allows indications up to `Max + 9 e` and forbids an
  indication using `eᵢ` above `Maxᵢ = nᵢ × eᵢ`. Recorded as `r76.4.2.3.limits-of-indication` in
  `pendingRules.ts`; applying it means distinguishing indications from loads in the range resolver.
  Today an observation at Max cannot be evaluated, because the next indication would lie above Max.
* E₀ is a tester input by design. Implementing its determination (A.4.2.3.1/.2, A.4.3) means
  modelling a zero-setting device and a second changeover observation near zero — the arithmetic is
  already the same evaluation.
* Still to implement, and verified to exist: repeatability (§3.6.1, A.4.10), eccentric loading
  (§3.6.2.1–§3.6.2.4), the mpe in service (§3.5.2), net load and tare (§3.3.4, §3.5.3.3), other
  accuracy classes, multiple-range instruments, and uncertainty of the determination. All are listed
  in `src/domain/pendingRules.ts` with their clause and reason.
* The report identifies the instrument by its configuration because the data model holds no make,
  model, serial number, verification mark, owner or location — and section A says so plainly instead
  of printing empty fields. Adding real instrument identity means extending `InstrumentConfig`
  (optional, free-text, not part of any R-76 check) and section A with it.
* Printing uses the browser's own dialog, which is the simplest reliable method and needs no
  dependency. A generated PDF file (rather than a print dialog) would need a library or a
  server-side renderer; before adding one, check that it reproduces the table and the subscripts
  (`e₁`, `Ec`, `Max₃`) as faithfully as the browser does.
* Before any of that, confirm which edition of R 76 the target regulation references (this build uses
  the 2006 edition; the 202x committee draft renumbers the clauses, e.g. Table 3 → §5.2) and whether
  any national rule adds requirements that R 76 leaves open (see `pendingRules.ts`).
