# OIML R 76-1:2006 (E) — verified source extracts used by the configuration validator, the resolvers and the evaluation engine

Source document: **OIML R 76-1, Edition 2006 (E)**, *Non-automatic weighing instruments —
Part 1: Metrological and technical requirements*, published by the International Organization of
Legal Metrology. Downloaded from `https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf`
(copy kept in `.refs/R076-1-e06.pdf`, 144 pages).

Every numeric value and every formula implemented in `src/domain` is quoted below with its
clause/table and the printed page of the PDF. **No value used by the validator, by the range / MPE
resolvers or by the A.4.4.3 evaluation is inferred or estimated.** Rules that could not be verified
from this document are listed in `src/domain/pendingRules.ts` and are deliberately *not* implemented.

Three layers of the application rest on this document:

| Layer | Code | Clauses |
| --- | --- | --- |
| Configuration validation | `src/domain/validation/` | Tables 2–4, §3.2–§3.4.3, §4.2.2.1 |
| Range / interval / MPE resolution | `src/domain/resolution/` | §3.3, Table 6 with §3.5.1, §4.2.2.2, T.3.2.2/T.3.2.6 |
| Digital weighing evaluation (E, E₀, Ec, verdict) | `src/domain/evaluation/` | **A.4.4.3** with its note, A.4.2.3, §3.5.1, §3.6 |

---

## Table 1 — Accuracy classes (§3.1.1, printed p. 26)

| Name | Denomination used in R 76 |
| --- | --- |
| Special accuracy | I |
| High accuracy | II |
| Medium accuracy | III |
| Ordinary accuracy | IIII |

## Table 2 — Verification scale interval by instrument type (§3.1.2, printed p. 26)

> | Type of instrument | Verification scale interval |
> | --- | --- |
> | Graduated, without auxiliary indicating device | **e = d** |
> | Graduated, with auxiliary indicating device | e is chosen by the manufacturer according to the requirements in 3.2 and 3.4.2 |
> | Non-graduated | e is chosen by the manufacturer according to the requirements in 3.2 |

## Table 3 — Values of *e*, *n* and Min according to accuracy class (§3.2, printed p. 27)

> **Number of verification scale intervals, n = Max/e** … **Minimum capacity, Min (Lower limit)**
>
> | Accuracy class | Verification scale interval, e | n minimum | n maximum | Min |
> | --- | --- | --- | --- | --- |
> | Special (I) | 0.001 g ≤ e\* | 50 000\*\* | – | 100 e |
> | High (II) | 0.001 g ≤ e ≤ 0.05 g | 100 | 100 000 | 20 e |
> | High (II) | 0.1 g ≤ e | 5 000 | 100 000 | 50 e |
> | **Medium (III)** | **0.1 g ≤ e ≤ 2 g** | **100** | **10 000** | **20 e** |
> | **Medium (III)** | **5 g ≤ e** | **500** | **10 000** | **20 e** |
> | Ordinary (IIII) | 5 g ≤ e | 100 | 1 000 | 10 e |
>
> \* It is not normally feasible to test and verify an instrument to e < 1 mg …
> \*\* See exception in 3.4.4.
> The minimum capacity is reduced to 5 e for grading instruments …

Rows in **bold** are the Class III rows — the only ones Phase 1 evaluates.
Note that Table 3 leaves no Class III row for `2 g < e < 5 g`.

## §3.3 Additional requirements for multi-interval instruments (printed p. 27)

> **3.3.1 Partial weighing range**
> Each partial range (index i = 1, 2, …) is defined by:
> * its verification scale interval, **eᵢ, eᵢ₊₁ > eᵢ**;
> * its maximum capacity, **Maxᵢ**; and
> * its minimum capacity, **Minᵢ = Maxᵢ₋₁** (for i = 1, the minimum capacity is **Min₁ = Min**).
>
> The number of verification scale intervals, **nᵢ, for each partial range is equal to Maxᵢ / eᵢ**.
>
> **3.3.2 Accuracy class**
> **eᵢ and nᵢ in each partial weighing range, and Min₁ shall comply with the requirements given in
> Table 3** according to the accuracy class of the instrument.
>
> **3.3.3 Maximum capacity of partial weighing ranges**
> **With the exception of the last partial weighing range, the requirements in Table 4 shall be
> complied with**, according to the accuracy class of the instrument.

## Table 4 — Maximum capacity of partial weighing ranges (§3.3.3, printed p. 28)

> | Class | I | II | **III** | IIII |
> | --- | --- | --- | --- | --- |
> | **Maxᵢ / eᵢ₊₁** | ≥ 50 000 | ≥ 5 000 | **≥ 500** | ≥ 50 |

## §3.3.3 — Official example of a multi-interval instrument (printed p. 28)

> Maximum capacity, **Max = 2 / 5 / 15 kg, class III**
> Verification scale interval, **e = 1 / 2 / 10 g**
>
> This instrument has one Max and one weighing range from **Min = 20 g** to Max = 15 kg.
> The partial weighing ranges are:
>
> * Min = 20 g, Max₁ = 2 kg, e₁ = 1 g, **n₁ = 2 000**
> * Min₂ = 2 kg, Max₂ = 5 kg, e₂ = 2 g, **n₂ = 2 500**
> * Min₃ = 5 kg, Max₃ = Max = 15 kg, e₃ = 10 g, **n₃ = 1 500**

This is the configuration used as the application default (`src/data/defaultConfiguration.ts`).
`d` is not stated in the example; the default uses `d = e₁ = 1 g`, which follows from Table 2
(`e = d` for an instrument without an auxiliary indicating device) and reproduces the example's
`Min = 20 g` through §3.4.3 (`Min ≥ 20 d`).

### §3.3.3 — Maximum permissible errors of that example (printed p. 28)

> The maximum permissible errors on initial verification (mpe) (see 3.5.1) are:
>
> | Load interval as printed | mpe |
> | --- | --- |
> | for m = 0 g to 500 g | **mpe = ± 0.5 e₁ = ± 0.5 g** |
> | for m > 500 g to 2 000 g | **mpe = ± 1 e₁ = ± 1 g** |
> | for m > 2 000 g to 4 000 g | **mpe = ± 1 e₂ = ± 2 g** |
> | for m > 4 000 g to 5 000 g | **mpe = ± 1.5 e₂ = ± 3 g** |
> | for m > 5 000 g to 15 000 g | **mpe = ± 1 e₃ = ± 10 g** |
>
> **Whenever the variation of the indication due to certain influence factors is limited to a
> fraction or multiple of e, this means, in a multi-interval instrument, that e is to be taken
> according to the load applied; particularly at or near zero, load e = e₁.**

Two properties of this example are what Phase 2 implements:

1. **Range membership is `(Maxᵢ₋₁, Maxᵢ]`.** The load 2 000 g is still in partial range 1
   (`mpe = ± 1 e₁`), and the load 2 001 g is already in partial range 2 (`± 1 e₂`). Likewise
   5 000 g → `± 1.5 e₂` but 5 001 g → `± 1 e₃`.
2. **`e` is taken from the partial range that contains the load** — never one instrument-wide `e`.
   The bracket coefficient comes from Table 6 applied to `m = L / eᵢ` of *that* range:
   4 000 g → `m = 4 000 / e₂ = 2 000` → `± 1.0 e₂`; 4 001 g → `m = 2 000.5` → `± 1.5 e₂`.

Anchor points used by the unit tests (all reproduced exactly by the implementation):

| L | partial range | eᵢ | m = L / eᵢ | Table 6 bracket | mpe |
| --- | --- | --- | --- | --- | --- |
| 500 g | 1 | e₁ = 1 g | 500 | 0 ≤ m ≤ 500 | ± 0.5 g |
| 2 000 g | 1 | e₁ = 1 g | 2 000 | 500 < m ≤ 2 000 | ± 1 g |
| 2 001 g | 2 | e₂ = 2 g | 1 000.5 | 500 < m ≤ 2 000 | ± 2 g |
| 4 000 g | 2 | e₂ = 2 g | 2 000 | 500 < m ≤ 2 000 | ± 2 g |
| 4 001 g | 2 | e₂ = 2 g | 2 000.5 | 2 000 < m ≤ 10 000 | ± 3 g |
| 5 000 g | 2 | e₂ = 2 g | 2 500 | 2 000 < m ≤ 10 000 | ± 3 g |
| 5 001 g | 3 | e₃ = 10 g | 500.1 | 500 < m ≤ 2 000 | ± 10 g |
| 15 000 g | 3 | e₃ = 10 g | 1 500 | 500 < m ≤ 2 000 | ± 10 g |

## Table 6 — Maximum permissible errors on initial verification (§3.5.1, printed p. 30)

> **3.5 Maximum permissible errors**
> **3.5.1 Values of maximum permissible errors on initial verification**
> The maximum permissible errors for increasing or decreasing loads are given in Table 6.
>
> **Table 6 — For loads, m, expressed in verification scale intervals, e**
>
> | Maximum permissible errors on initial verification | Class I | Class II | **Class III** | Class IIII |
> | --- | --- | --- | --- | --- |
> | **± 0.5 e** | 0 ≤ m ≤ 50 000 | 0 ≤ m ≤ 5 000 | **0 ≤ m ≤ 500** | 0 ≤ m ≤ 50 |
> | **± 1.0 e** | 50 000 < m ≤ 200 000 | 5 000 < m ≤ 20 000 | **500 < m ≤ 2 000** | 50 < m ≤ 200 |
> | **± 1.5 e** | 200 000 < m | 20 000 < m ≤ 100 000 | **2 000 < m ≤ 10 000** | 200 < m ≤ 1 000 |
>
> **Note: The absolute value of the maximum permissible error is 0.5 e, 1.0 e or 1.5 e, i.e. it is
> the value of the maximum permissible error without the positive or negative sign.**
>
> **Note: For multi-interval instruments, refer to 3.3 (including the example).**

The Class III column (bold) is the only one this build evaluates: the configuration validator
rejects every other accuracy class as out of scope. The other three columns are transcribed as
verified reference data in `src/domain/constants/r76Tables.ts` and are not used by any UI path.

The second note is the link between Table 6 and §3.3: for a multi-interval instrument the `e` in
`± 0.5 e / ± 1.0 e / ± 1.5 e` is the verification scale interval **of the partial weighing range
that contains the load**, and `m` is that load divided by that same interval.

## §3.5.2 Maximum permissible errors in service (printed p. 30) — NOT implemented

> **3.5.2 Values of maximum permissible errors in service**
> The maximum permissible errors in service shall be **twice** the maximum permissible errors on
> initial verification (see 8.4.2).

Verified, but deliberately not implemented in Phase 2 (see `src/domain/pendingRules.ts`,
`r76.3.5.2.mpe-in-service`). Phase 2 resolves **initial verification** limits only.

Not implemented in Phase 3 either: the evaluation compares |Ec| with the **initial verification**
limit and says so on screen.

## §3.5.3 Basic rules concerning the determination of errors (printed p. 30)

> **3.5.3.1 Influence factors** — Errors shall be determined under normal test conditions. When the
> effect of one factor is being evaluated, all other factors are to be kept relatively constant, at a
> value close to normal.
>
> **3.5.3.2 Elimination of rounding error** — **The rounding error included in any digital indication
> shall be eliminated if the actual scale interval is greater than 0.2 e.**
>
> **3.5.3.3 Maximum permissible errors for net values** — The maximum permissible errors apply to the
> net value for every possible tare load, except preset tare values.

§3.5.3.2 is the clause that makes the changeover procedure of A.4.4.3 necessary: a digital indication
is rounded, so the error prior to rounding has to be recovered from the changeover point. It is
satisfied **structurally** by this build rather than by a separate correction step: Table 2 gives
`e = d` for an instrument without an auxiliary indicating device, and §3.4.1 forbids such a device on
a multi-interval instrument, so the actual scale interval is always `d = e`, which is greater than
`0.2 e`. There is therefore no configuration in scope in which a separate rounding-error elimination
would apply. Recorded in `src/domain/pendingRules.ts` as verified-and-not-applicable rather than
implemented as a step.

§3.5.3.1 and §3.5.3.3 concern test conditions and tare; neither is evaluated here (no tare, no
influence-factor tests in this build).

## §3.6 Permissible differences between results (printed p. 31) — verified, NOT implemented

> Regardless of what variation of results is permitted, **the error of any single weighing result
> shall by itself not exceed the maximum permissible error for the given load.**
>
> **3.6.1 Repeatability** — The difference between the results of several weighings of the same load
> shall not be greater than the absolute value of the maximum permissible error of the instrument for
> that load.
>
> **3.6.2 Eccentric loading** — The indications for different positions of a load shall meet the
> maximum permissible errors, when the instrument is tested according to 3.6.2.1-3.6.2.4.

The first sentence is the rule this build applies to one observation: the corrected error of a single
weighing is compared, by itself, with the mpe for that load — no averaging over a series and no
statistical treatment. Repeatability (§3.6.1) and eccentric loading (§3.6.2, with the 1/3, 1/(n − 1),
1/10 and rolling-load variants of §3.6.2.1–§3.6.2.4) need **several** observations and are recorded
in `src/domain/pendingRules.ts`, not implemented: this build evaluates one observation at a time.

## §3.4.1 / §3.4.2 / §3.4.3 (printed pp. 28–30)

> **3.4.1** Only instruments of classes I and II may be fitted with an auxiliary indicating device …
> **A multi-interval instrument shall not be fitted with an auxiliary indicating device.**
>
> **3.4.2 Verification scale interval** — The verification scale interval, e, is determined by the
> expression: **d < e ≤ 10 d** (see Tables 5a and 5b), **e = 10ᵏ kg**, k being a positive or negative
> whole number, or zero.
> *(This clause governs instruments **with** an auxiliary indicating device — it is therefore not
> applicable to a Class III multi-interval instrument, for which Table 2 gives `e = d`.)*
>
> **3.4.3 Minimum capacity** — The minimum capacity of the instrument is determined in conformity
> with the requirements in Table 3. **However, in the last column of this Table, the verification
> scale interval, e, is replaced by the actual scale interval, d.**

Combination used by the validator: Class III ⇒ `Min ≥ 20 d` (§3.4.3 with Table 3).

## §4.2.2.1 Form of the indication (printed p. 43)

> **The scale interval for weighing results shall be in the form 1 × 10ᵏ, 2 × 10ᵏ or 5 × 10ᵏ units**
> in which the result is expressed, the index, k, being a positive or negative whole number or equal
> to zero.
> All displaying, printing and tare weighing devices of an instrument shall, within any one weighing
> range, have the same scale interval for any given load.

## §4.2.2.2 Form of the indication — allowed indications of a multi-interval instrument (printed pp. 43–44)

> **A digital indication shall show at least one figure beginning at the extreme right.**
> **Where the scale interval is changed automatically the decimal sign shall maintain its position
> in the display.**
> …
> The unit of mass shall be chosen so that weight values have not more than one non-significant zero
> to the right. … **For multi-interval instruments and multiple range instruments with automatic
> changeover these requirements apply only to the smallest (partial) weighing range.**
> **Examples for a multi-interval instrument or a multiple range instrument with automatic
> changeover:**

Printed on p. 44, verbatim:

> Example 1
>
> | Maxᵢ | eᵢ | Allowed indications |
> | --- | --- | --- |
> | Max₁ = 150 kg | e₁ = 50 g | xxx.050 kg xxx.050 kg xxx.05 kg xxx.05 kg |
> | Max₂ = 300 kg | e₂ = 100 g | xxx.100 kg xxx.1 kg xxx.10 kg xxx.1 kg |
>
> Example 2
>
> | Maxᵢ | eᵢ | Allowed indications |
> | --- | --- | --- |
> | Max₁ = 1500 kg | e₁ = 500 g | xxxx.5 kg |
> | Max₂ = 3000 kg | e₂ = 1000 kg | xxx1.0 kg |

Each partial weighing range has its **own** list of allowed indications, and every listed value is a
multiple of that range's eᵢ. This is the printed basis of the indication-consistency check.

## §4.2.3 Limits of indication (printed p. 44) — verified, NOT implemented

> **There shall be no indication above Max + 9 e.**
> For multiple range instruments this applies to each weighing range. …
> **For multi-interval instruments there shall be no indication using eᵢ above Maxᵢ = nᵢ × eᵢ for the
> lower partial weighing range(s), i.**

Recorded in `src/domain/pendingRules.ts` (`r76.4.2.3.limits-of-indication`). This build is stricter:
an indication above Max is reported as outside the weighing range, and the `Max + 9 e` allowance is
not applied.

## A.4.4.3 Evaluation of error (A.4.1.6) — the changeover observation (printed pp. 88–89)

This is the clause the evaluation engine implements. Transcribed in full, in the order it is printed.

> **A.4.4.3 Evaluation of error (A.4.1.6)**
>
> For instruments with digital indication and without a device for displaying the indication with a
> smaller scale interval (not greater than 1/5 e), the changeover points are to be used to determine
> the indication of the instrument, prior to rounding, as follows.
>
> At a certain load, L, the indicated value, I, is noted. **Additional weights of say 1/10 e are
> successively added until the indication of the instrument is increased unambiguously by one scale
> interval ( I + e ).**
>
> The additional load ΔL added to the load receptor gives the indication P, prior to rounding by using
> the following formula:
>
> **P = I + ½ e – ΔL**
>
> The error prior to rounding is:
>
> **E = P – L = I + ½ e – ΔL – L**
>
> The corrected error prior to rounding is:
>
> **Ec = E – E0 ≤ mpe**
>
> where **E0 is the error calculated at zero or at a load close to zero (e.g. 10 e)**.
>
> **Example:** An instrument with a verification scale interval, e, of 5 g is loaded with 1 kg and
> thereby indicates 1 000 g. After adding successive weights of 0.5 g, the indication changes from
> 1 000 g to 1 005 g at an additional load of 1.5 g. Inserted in the above formula these observations
> give:
>  **P = (1 000 + 2.5 – 1.5) g = 1 001 g**
>  Thus the true indication prior to rounding is 1 001 g, and the error is:
>  **E = (1 001 – 1 000) g = + 1 g**
>  If the changeover point at zero as calculated above was E0 = + 0.5 g, the corrected error is:
>  **Ec = + 1 – (+ 0.5) = + 0.5 g**
>
> In the tests A.4.2.3 and A.4.11.1, the error shall be determined with a sufficient accuracy in view
> of the tolerance in question.
>
> **Note:** The above description and formulae are also valid for multi-interval instruments. Where
> the load, L, and the indication, I, are in different partial weighing ranges:
>  the additional weights ΔL are to be in steps of 1/10 eᵢ,
>  in the equation "E = P – L = ..." above, the term "½ e" is to be ½ eᵢ or ½ eᵢ₊₁ **according to the
> partial weighing range in which the indication (I + e) appears**.

### How each sentence is implemented

| Printed text | Implementation |
| --- | --- |
| "For instruments with digital indication and without a device for displaying the indication with a smaller scale interval (not greater than 1/5 e)" | Scope of the evaluation. Every configuration this build accepts is digital with `e = d` (Table 2) and, being multi-interval, has no auxiliary indicating device (§3.4.1). Recorded as a scope statement, not as a numeric test. |
| "At a certain load, L, the indicated value, I, is noted." | Inputs `L` and `I`. `L` resolves `range_L` → `e_L` → `m = L / e_L` → the Table 6 mpe. `I` is checked against the interval of the range it appears in. |
| "Additional weights of say 1/10 e are successively added until the indication … is increased unambiguously by one scale interval ( I + e )." | Inputs `ΔL` and `I_next`. Two requirements are verified, never assumed: `I_next > I`, and `I_next − I` equals **one** scale interval of the range in which `I_next` appears. A negative `ΔL` cannot be an added load and is refused. |
| "P = I + ½ e – ΔL" | `P`, with the ½ e term taken as **½ e\***, where `e*` is the interval of the partial weighing range in which `(I + e)` appears — per the note, not `e_L`. |
| "E = P – L" | `E`, signed. |
| "Ec = E – E0 ≤ mpe" | `Ec = E − E₀`, signed; the verdict is `|Ec| ≤ mpe`, the absolute comparison Table 6's note requires. |
| "where E0 is the error calculated at zero or at a load close to zero (e.g. 10 e)" | `E₀` is an **input** entered by the tester and labelled "Zero error E₀". It is never derived, never assumed to be zero, and no zero-tracking or automatic zero-setting is modelled. Missing `E₀` blocks the evaluation. |
| "Example: … P = (1 000 + 2.5 – 1.5) g = 1 001 g … E = + 1 g … Ec = + 0.5 g" | Reproduced exactly as a test (`src/domain/evaluation/evaluateObservation.test.ts`, "the worked example printed in A.4.4.3"). |
| "Note: … also valid for multi-interval instruments … ½ eᵢ or ½ eᵢ₊₁ according to the partial weighing range in which the indication (I + e) appears" | The reason `e*` exists and why `e* ≠ e_L` at a transition. `ΔL` in steps of 1/10 eᵢ is stated on screen as the procedure the tester followed; the value itself is entered, never computed. |

Implemented in `src/domain/evaluation/`: `validateObservation.ts` (inputs and changeover),
`evaluateObservation.ts` (P, E, Ec, verdict), `describe.ts` (the substitution lines and the ten-step
trace). All masses are handled as integer micrograms internally, so `½ e` is exact and the comparison
`|Ec| ≤ mpe` has no floating-point tolerance: equality passes, one microgram more fails.

**Not** taken from A.4.4.3: nothing. The clause contains no uncertainty band, no grey zone and no
rounding of the result, and none is applied.

## A.4.2.3 Accuracy of zero-setting — where E₀ comes from (printed p. 88)

> **A.4.2.3.1 Non-automatic and semi-automatic zero-setting**
> The accuracy of the zero-setting device is tested by first loading the instrument to an indication as
> close as possible to a changeover point, and then by initiating the zero-setting device and
> determining the additional load at which the indication changes from zero to one scale interval above
> zero. **The error at zero is calculated according to the description in A.4.4.3.**
>
> **A.4.2.3.2 Automatic zero-setting or zero-tracking**
> The indication is brought out of the automatic range (e.g. by loading with 10 e). Then the additional
> load at which the indication changes from one scale interval to the next above is determined and the
> error is calculated according to the description in A.4.4.3. It is assumed that the error at zero load
> would be equal to the error at the load in question.
>
> **A.4.3 Setting to zero before loading** — For instruments with digital indication, the adjustment to
> zero, or the determination of the zero point is carried out as follows: a) For instruments with
> non-automatic zero-setting, weights equivalent to half a scale interval are placed on the load
> receptor, and the instrument is adjusted until the indication alternates between zero and one scale
> interval. Then weights equivalent to half a scale interval are removed from the load receptor to
> attain a centre of zero reference position. b) For instruments with semi-automatic or automatic
> zero-setting or zero-tracking, the deviation from zero is determined as described in A.4.2.3.

These clauses establish that **E₀ is itself the result of a changeover measurement** performed
separately, by the same procedure, at or near zero. This build therefore takes E₀ as an explicit
tester input: it is a measurement the tester has already made, not a quantity the software may invent.
The determination procedure of A.4.2.3.1/A.4.2.3.2 (loading to a changeover point near zero,
initiating the zero-setting device, finding the additional load) is **verified and not implemented** —
see `src/domain/pendingRules.ts`, `r76.a4.2.3.zero-setting-accuracy`.

## Derived rule — an indication must be a multiple of the scale interval of its own range

Status **derived** (no single sentence states it; it follows from verified text, and §4.2.2.2 prints
it as "Allowed indications"):

1. T.3.2.2 (p. 14): `d` is "the difference between two consecutive indicated values, for digital
   indication" ⇒ consecutive indications differ by exactly `d`.
2. T.3.2.6 (p. 14): a multi-interval instrument has "partial weighing ranges each with different
   scale intervals", and "the partial weighing range [is] determined automatically according to the
   load applied".
3. Table 2 (p. 26) with §3.4.1 (p. 28): Table 2 gives `e = d` for a "Graduated, without auxiliary
   indicating device" instrument, and §3.4.1 states "A multi-interval instrument shall not be fitted
   with an auxiliary indicating device" ⇒ the scale interval of partial weighing range i is eᵢ.
4. §4.2.2.2 (p. 44): the allowed indications of each partial weighing range are printed as multiples
   of its eᵢ.

⇒ An indication resolved into partial weighing range i must be an exact multiple of eᵢ. For the
§3.3.3 example (e₂ = 2 g above Max₁ = 2 kg) the indications of partial weighing range 2 are
2 000 g, 2 002 g, 2 004 g, … — **2 001 g is not one of them**, while 2 001 g is an ordinary test
*load* whose mpe resolves from e₂ (m = 1 000.5 → ± 1.0 e₂).

Implemented in `src/domain/resolution/indicationConsistency.ts`; the interval is computed on integer
micrograms (`isExactMultipleOf`), so no tolerance can let a value between two indications pass.

## Terminology used (printed pp. 13–14)

> **T.3.1.1 Maximum capacity (Max)** — Maximum weighing capacity, not taking into account the
> additive tare capacity.
> **T.3.1.2 Minimum capacity (Min)** — Value of the load below which the weighing results may be
> subject to an excessive relative error.
> **T.3.1.4 Weighing range** — Range between the minimum and maximum capacities.
> *(T.3.1.1, T.3.1.2 and T.3.1.4 are printed on p. 13; the T.3.2.x entries below on p. 14.)*
>
> **T.3.2.2 Actual scale interval, d** — Value, expressed in units of mass of: the difference between
> the values corresponding to two consecutive scale marks, for analog indication; or **the difference
> between two consecutive indicated values, for digital indication**.
> **T.3.2.3 Verification scale interval (e)** — Value, expressed in units of mass, used for the
> classification and verification of an instrument.
> **T.3.2.5 Number of verification scale intervals (n)** — Quotient of the maximum capacity and the
> verification scale interval: n = Max / e.
> **T.3.2.6 Multi-interval instrument** — Instrument having one weighing range which is divided into
> partial weighing ranges each with different scale intervals, with the **partial weighing range**
> determined automatically according to the load applied, both on increasing and decreasing loads.

---

## Explicitly out of scope (verified to exist, not implemented)

* Maximum permissible errors **in service** — §3.5.2 (twice the initial-verification limits). The
  evaluation compares with the initial-verification limit and says so.
* ~~Errors of indication, error before rounding, changeover point test (E, E₀, Ec, ΔL) — §3.5.3, A.4~~
  **implemented** (`src/domain/evaluation/`, A.4.4.3): one observation, P / E / Ec and the verdict
  |Ec| ≤ mpe, with the ten-step calculation trace.
* Repeatability — §3.6.1, A.4.10: needs several weighings of the same load; this build evaluates one
  observation.
* Eccentric loading — §3.6.2 with §3.6.2.1–§3.6.2.4 (1/3, 1/(n − 1), 1/10 and rolling-load variants):
  needs several load positions.
* Determination of the zero-setting accuracy — A.4.2.3.1, A.4.2.3.2, A.4.3: E₀ is entered by the
  tester as the result of that separate measurement.
* Discrimination test — A.4.5; tare and preset tare — §3.5.3.3, §3.5.3.4, A.4.6; temperature and other
  influence factors — §3.5.3.1, A.4.11; supplementary weighing test — A.4.4.2; substitution material
  — A.4.4.5; modules — A.4.4.4, Annex F.
* Uncertainty of the determination ("with a sufficient accuracy in view of the tolerance in
  question", A.4.4.3) and any grey zone: the limit is compared as printed, with no band around it.
* Test suites and reports (the ≥ 10 test loads of A.4.4.1, PDF output): one observation per
  evaluation, no document is produced and no certificate is issued.
* Limits of indication — §4.2.3 (`Max + 9 e`, and "no indication using eᵢ above Maxᵢ"). Verified,
  recorded in `pendingRules.ts`, deliberately not applied: this build reports any indication above Max
  as outside the weighing range.
* ~~Maximum permissible errors on initial verification — §3.5.1 Table 6~~ **implemented in Phase 2**
  (`src/domain/resolution/mpeResolver.ts`).
* Other accuracy classes (I, II, IIII) — Table 3 / Table 4 rows are recorded as data but the
  validator rejects them as out of scope for this phase.
* Multiple-range instruments — §3.2 note ("On multiple range instruments …").
* Auxiliary indicating devices — §3.4.1, §3.4.2, Tables 5a/5b.
* Grading instruments (`Min = 5 e`) — §3.2 note.
* Load cell / indicator module compatibility — Annex F.
