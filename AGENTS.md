# AGENTS.md — Currency Normalization Benchmark

> # ⚠️ GRADER / REFERENCE ONLY — DO NOT SHOW TO A CANDIDATE UNDER TEST
> This file contains the scoring rubric **and the answer key (Appendix B)**.
> Showing it to a candidate model invalidates the benchmark. To run the benchmark,
> hand the candidate **only the [`benchmark/`](benchmark/) folder** (its
> `PROMPT.md` + `cases.csv`) — that is the candidate-facing brief, with no rubric
> and no answer key. The whole repo root (this file, `index.html`, `TESTING.md`,
> `COMPARISON.md`, `test/`) is the reference solution + grader material.

A **frozen, self-contained benchmark task** for coding agents. Give a model the
brief in [`benchmark/PROMPT.md`](benchmark/PROMPT.md) (and the bundled
`benchmark/cases.csv`), have it build the deliverable *from scratch*, then grade
the result against the objective criteria here. The same brief + same test set are
reused for every model so the scores are comparable over time — this is a
**model-vs-model benchmark to measure progress and performance**.

> This repository also contains a reference solution (`index.html`, `test/`).
> When running the benchmark, **do not show the candidate model the reference
> solution** — only the sections marked *“give to the candidate.”* Appendix B (the
> reference algorithm) is an answer key; withhold it if you want to measure whether
> a model can *derive* the rules, not just transcribe them.

---

## 0. How to run the benchmark (for the grader)

1. Hand the candidate the **[`benchmark/`](benchmark/) folder only** — its
   `PROMPT.md` (the brief) and `cases.csv` (the acceptance set). Do **not** give it
   this file, `index.html`, `TESTING.md`, `COMPARISON.md`, or `test/`. Sections 1–8
   below reproduce that brief for the grader's reference; Appendix B is the answer
   key — never share it.
2. Let it produce a standalone `index.html` from scratch. No internet, no copying
   an existing solution, single self-contained file.
3. Score it with the rubric in **Section 7**. Grading is automatable — adapt
   `test/run-tests.js` (extracts a normalizer and runs it against `cases.csv` +
   fuzz) and `test/compare-engrid.js` (the ENgrid baseline) from this repo.
4. Record the weighted score. Compare across models / over time, and against the
   ENgrid baseline in [`COMPARISON.md`](COMPARISON.md).

Sections 1–8 below are the candidate-facing brief (mirrored in `benchmark/PROMPT.md`).

---

## 1. The problem (give to the candidate)

Online donors type the **same dollar amount in wildly different ways**. A US donor
writes `$1,234.56`; a French-Canadian donor writes `1 234,56 $`; someone pastes an
international value `55.123,45`; others fat-finger malformed or incomplete values
like `40.15$`, `$25.5`, or `1,00.10`. If the donation form misreads these, a donor
can be charged the wrong amount.

Build a tool that takes whatever the donor typed and **normalizes it to one clean
canonical numeric value (USD)** in real time, or clearly **rejects inputs that are
not a possible number**. The audience is **United States and French-Canadian**
formats, but the tool must also handle other common international groupings and
junk gracefully (never crash).

## 2. The deliverable (give to the candidate)

A single **standalone `index.html`** with:

- An **input field** where the donor types the raw amount.
- A **read-only field next to it** that shows the **normalized value**, updated
  **in real time on every keystroke** (no submit button, no debounce gap).
- It is acceptable (encouraged) to also show the detected format and a friendly
  `$1,234.56` rendering, but the **normalized value is what is graded**.

Hard constraints:

- **One file. No external/runtime dependencies. No network calls.** It must work
  opened directly from disk (`file://`) and offline.
- **It must never throw** for *any* input string (including emoji, control
  characters, megabyte pastes).
- Pure, deterministic: the same input always yields the same output.

## 3. The output contract (give to the candidate — this is graded)

`normalize(raw)` (whatever you call it) must produce, for each input:

**`normalized`** — a *bare* number **string**:
- no currency symbol, **no thousands separators**, `.` as the decimal point;
- **exactly two decimals unless the value is whole**, in which case **no decimal
  part at all**. Examples: `1.00 → "1"`, `1.1 → "1.10"`, `1234.10 → "1234.10"`,
  `0.0 → "0"`;
- round **half-up** to the nearest cent;
- for an **IMPOSSIBLE** input, `normalized` is `"0"`;
- for **empty/blank** input, `normalized` is `""` (a neutral UI state — not part
  of the graded CSV).

**`detection`** — one of:
- **`US`** — period is the decimal separator and/or comma is the thousands
  separator (e.g. `1.00`, `1,234.56`).
- **`CA-FR`** — comma is the decimal separator and/or period is the thousands
  separator (e.g. `1,00`, `1.234`, `1.234,56`).
- **`UNIVERSAL`** — no separators at all (a plain integer like `1234`), **or** the
  value is exactly zero (e.g. `0`, `0.0`).
- **`IMPOSSIBLE`** — not a possible number (see Section 5).
- (`EMPTY` for blank input — UI state, not in the CSV.)

## 4. Format conventions you must support (give to the candidate)

| Style | Thousands sep | Decimal sep | Example | Normalizes to |
|------|---------------|-------------|---------|---------------|
| US | `,` | `.` | `$1,234.56` | `1234.56` |
| French-Canadian | space | `,` | `1 234,56 $` | `1234.56` |
| International / European | `.` | `,` | `55.123,45` | `55123.45` |
| Plain integer | — | — | `1234` | `1234` |

Donors also include currency symbols, letters, and stray spaces (`$`, `USD`,
`CA$`, `40.15$`, ` $ 1 XYZ `). These non-numeric characters are simply removed.

## 5. What counts as IMPOSSIBLE (give to the candidate)

Reject (→ `normalized = "0"`, `detection = "IMPOSSIBLE"`) when the input is not a
possible number, e.g.:

- it contains **no digits** (`XYZ`);
- the integer part **mixes both** `,` and `.` as grouping separators, i.e. a
  separator sandwich / two decimal separators (`1,000.100,00`, `1,000.100.10`,
  `1.000,100,10`, `1.100,000.10`, `1,000.100,000.10`);
- a thousands group is **not** a leading group of 1–3 digits followed by groups of
  **exactly 3** (`1,00.10` — `00` too short; `1,0000.10` — `0000` too long).

The authoritative, exhaustive definition of correct behavior is **`cases.csv`**
(Section 6). When in doubt, the CSV wins.

## 6. The authoritative test set (give to the candidate)

[`test/cases.csv`](test/cases.csv) (also embedded verbatim in **Appendix A**) is
the ground truth. It has 161 rows and four columns:

```
Input, Output, Format Detection, Formatting Reasoning
```

- **Input** — the raw string a donor typed (quoted in CSV when it contains commas;
  leading/trailing spaces are significant and intentional).
- **Output** — the expected `normalized` value (`0` for IMPOSSIBLE rows).
- **Format Detection** — the expected `detection` (`US` / `CA-FR` / `UNIVERSAL` /
  `IMPOSSIBLE`).
- **Formatting Reasoning** — human notes explaining the transformation (NOT graded;
  for understanding only, and its wording/spelling is informal).

**A correct solution makes every row’s `normalized` and `detection` match.** The
CSV has been validated for internal consistency (two originally-inconsistent rows
were corrected), so all 161 are mutually consistent — do not “fix” it.

> ⚠️ **Do not hardcode the 161 cases.** The CSV is the *acceptance* test, not the
> spec to memorize. Grading includes held-out inputs and fuzzing (Section 7) that
> a lookup table will fail. Build a general algorithm.

---

## 7. Scoring rubric (for the grader — not shown to the candidate)

Score each submission on four weighted dimensions, 0–100 each; weighted total is
the benchmark score.

| Dimension | Weight | How to measure |
|-----------|--------|----------------|
| **Functional correctness** | 50% | Fraction of the 161 `cases.csv` rows where both `normalized` and `detection` match. |
| **Generalization** | 20% | Run a **held-out** set the candidate never saw: (a) a generated grid of `{integer} × {0–2 cent digits}` rendered in US / CA-FR / plain / noisy spellings, all of which must collapse to the same value; (b) hand-picked variants of CSV shapes with different digits. Detects hardcoding/overfitting — a lookup table scores ~0 here. |
| **Robustness** | 15% | Fuzz ≥100k random strings (digits, separators, symbols, unicode, control chars). **Any** uncaught exception, `NaN`/`Infinity`, or malformed result → proportional penalty. Also check idempotency: `normalize(normalize(x).normalized)` reproduces the value. |
| **Requirements** | 15% | Single self-contained file (no external/network deps); updates in real time without a submit; never rewrites the input field mid-type; reasonable accessibility (labelled fields, `aria-live` on the output). |

**Anti-overfit check (gate):** inspect the source. If correctness is achieved via
an embedded table of the CSV inputs/outputs rather than an algorithm, cap
Functional correctness at 50% and Generalization at 0%.

Suggested reference grader: this repo’s `test/run-tests.js` extracts the
normalizer from a candidate `index.html` (between agreed markers, or by adapting
the loader) and runs Layers 1–4 (cases.csv, property grid, idempotency, 300k
fuzz). Reuse or adapt it so every model is graded by identical code.

### Suggested score bands
- **90–100** — production-ready: all/near-all CSV rows, generalizes, never throws, clean standalone realtime UI.
- **70–89** — solid: correct on common formats, a few edge/IMPOSSIBLE misses or minor robustness gaps.
- **50–69** — partial: handles US + simple cases, fails grouping-validation / international / IMPOSSIBLE.
- **<50** — incomplete, crashes on fuzz, or overfit to the CSV.

---

## 8. Rules of engagement (for the candidate)

- Build it **from scratch**. Do **not** search for or copy an existing currency
  parsing library or solution — the point is to see what the model produces.
- Make the disambiguation rules **deterministic and documented**; where an input
  is genuinely ambiguous (e.g. a lone separator with 3 trailing digits), pick one
  rule and apply it consistently — `cases.csv` shows the intended resolution.
- Ship a way to self-verify (an in-page test runner and/or a headless harness that
  runs `cases.csv`) so results are reproducible.

---

## Appendix A — `cases.csv` (verbatim copy of `test/cases.csv`)

The canonical file is `test/cases.csv`; this is an exact mirror so the brief is
self-contained. If they ever disagree, `test/cases.csv` wins. (This block is
regenerated by `node test/build-cases.js`; do not hand-edit.)

<!-- CASES_CSV_START -->
```csv
Input,Output,Fromat Detection,Formatting Reasoning
0,0,UNIVERSAL,No changes
0.0,0,UNIVERSAL,Add missing decimal value. Trimmed trailing zeroes
"1,00.10",0,IMPOSSIBLE,"Contains a group of integer values, that is not the first group of values, that is less than three"
"1,000.100,00",0,IMPOSSIBLE,Two commas sandwich a period. That's not a possible number
"1,000.100,000.10",0,IMPOSSIBLE,Two periods sandwich a comma. Two commas sandwich a period. That's not a possible number
"1,000.100.10",0,IMPOSSIBLE,Contains two decimal seperators. That's not a possible number
"1,0000.10",0,IMPOSSIBLE,"Contains a group of integer values, that is not the only group of values, that is greater than three"
"1.000,100,10",0,IMPOSSIBLE,Contains two decimal seperators. That's not a possible number
"1.100,000.10",0,IMPOSSIBLE,Two periods sandwich a comma. That's not a possible number
XYZ,0,IMPOSSIBLE,No numbers. That's not a possible number
 $ 1 XYZ ,1,UNIVERSAL,Remove any non numbers other than periods and commas
" $ 1,00 XYZ ",1,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
 $ 1.00 XYZ ,1,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
 1 ,1,UNIVERSAL,Remove any non numbers other than periods and commas
" 1,00 ",1,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
 1.00 ,1,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
$1,1,UNIVERSAL,Remove any non numbers other than periods and commas
"$1,00",1,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
$1.00,1,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
1,1,UNIVERSAL,No changes
"1,00$",1,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
1.00,1,US,Trimmed trailing zeroes
1.00$,1,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
1$,1,UNIVERSAL,Remove any non numbers other than periods and commas
" $ 1,1 XYZ ",1.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
" $ 1,10 XYZ ",1.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
 $ 1.1 XYZ ,1.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
 $ 1.10 XYZ ,1.10,US,Remove any non numbers other than periods and commas
" 1,1 ",1.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
" 1,10 ",1.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
 1.1 ,1.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
 1.10 ,1.10,US,Remove any non numbers other than periods and commas
"$1,1",1.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
"$1,10",1.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
$1.1,1.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
$1.10,1.10,US,Remove any non numbers other than periods and commas
"1,1$",1.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
"1,10$",1.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
1.1,1.10,US,Add missing decimal value
1.1$,1.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
1.10,1.10,US,Do nothing
1.10$,1.10,US,Remove any non numbers other than periods and commas
" $ 1,12 XYZ ",1.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
 $ 1.12 XYZ ,1.12,US,Remove any non numbers other than periods and commas
" 1,012",1012,US,Remove any non numbers other than periods and commas. Removed thousands seperators
 1.12 ,1.12,US,Remove any non numbers other than periods and commas
"$1,12",1.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
$1.12,1.12,US,Remove any non numbers other than periods and commas
"1,12$",1.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
1.12,1.12,US,Do nothing
1.12$,1.12,US,Remove any non numbers other than periods and commas
$12,12,UNIVERSAL,Remove any non numbers other than periods and commas
"$12,00",12,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
$12.00,12,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
12,12,UNIVERSAL,No changes
"12,00$",12,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
12.00,12,US,Trimmed trailing zeroes
12.00$,12,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
12$,12,UNIVERSAL,Remove any non numbers other than periods and commas
"$12,1",12.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
"$12,10",12.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
$12.1,12.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
$12.10,12.10,US,Remove any non numbers other than periods and commas
"12,1$",12.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
"12,10$",12.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
12.1,12.10,US,Add missing decimal value
12.1$,12.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
12.10,12.10,US,Do nothing
12.10$,12.10,US,Remove any non numbers other than periods and commas
"$12,12",12.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
$12.12,12.12,US,Remove any non numbers other than periods and commas
"12,12$",12.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
12.12,12.12,US,Do nothing
12.12$,12.12,US,Remove any non numbers other than periods and commas
$123,123,UNIVERSAL,Remove any non numbers other than periods and commas
"$123,00",123,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
$123.00,123,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
123,123,UNIVERSAL,No changes
"123,00$",123,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
123.00,123,US,Trimmed trailing zeroes
123.00$,123,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
123$,123,UNIVERSAL,Remove any non numbers other than periods and commas
"$123,1",123.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
"$123,10",123.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
$123.1,123.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
$123.10,123.10,US,Remove any non numbers other than periods and commas
"123,1$",123.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
"123,10$",123.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
123.1,123.10,US,Add missing decimal value
123.1$,123.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
123.10,123.10,US,Do nothing
123.10$,123.10,US,Remove any non numbers other than periods and commas
"$123,12",123.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
$123.12,123.12,US,Remove any non numbers other than periods and commas
"123,12$",123.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
123.12,123.12,US,Do nothing
123.12$,123.12,US,Remove any non numbers other than periods and commas
$1234,1234,UNIVERSAL,Remove any non numbers other than periods and commas
"$1234,00",1234,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
$1234.00,1234,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
"1,223",1223,US,Removed thousands seperators
"1,234,00",1234,CA-FR,Removed thousands seperators. Trimmed trailing zeroes
"1,234.00",1234,US,Removed thousands seperators. Trimmed trailing zeroes
1.234,1234,CA-FR,Removed thousands seperators
1234,1234,UNIVERSAL,No changes
"1234,00$",1234,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
1234.00,1234,US,Trimmed trailing zeroes
1234.00$,1234,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
1234$,1234,UNIVERSAL,Remove any non numbers other than periods and commas
"$1234,1",1234.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
"$1234,10",1234.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
$1234.1,1234.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
$1234.10,1234.10,US,Remove any non numbers other than periods and commas
"1,234.10",1234.10,US,Removed thousands seperators
"1.234,10",1234.10,CA-FR,Removed thousands seperators. Swapped decimal seperator for period.
"1234,1$",1234.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
"1234,10$",1234.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
1234.1,1234.10,US,Add missing decimal value
1234.1$,1234.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
1234.10,1234.10,US,Do nothing
1234.10$,1234.10,US,Remove any non numbers other than periods and commas
"$1234,12",1234.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
$1234.12,1234.12,US,Remove any non numbers other than periods and commas
"1234,12$",1234.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
1234.12,1234.12,US,Do nothing
1234.12$,1234.12,US,Remove any non numbers other than periods and commas
$12345,12345,UNIVERSAL,Remove any non numbers other than periods and commas
"$12345,00",12345,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
$12345.00,12345,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
"12,345.00",12345,US,Removed thousands seperators. Trimmed trailing zeroes
"12.345,00",12345,CA-FR,Removed thousands seperators. Trimmed trailing zeroes
12345,12345,UNIVERSAL,No changes
"12345,00$",12345,CA-FR,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
12345.00,12345,US,Trimmed trailing zeroes
12345.00$,12345,US,Trimmed trailing zeroes. Remove any non numbers other than periods and commas
12345$,12345,UNIVERSAL,Remove any non numbers other than periods and commas
"$12345,1",12345.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
"$12345,10",12345.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
$12345.1,12345.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
$12345.10,12345.10,US,Remove any non numbers other than periods and commas
"12,345.10",12345.10,US,Removed thousands seperators
"12.345,10",12345.10,CA-FR,Removed thousands seperators. Swapped decimal seperator for period.
"12345,1$",12345.10,CA-FR,Add missing decimal value. Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
"12345,10$",12345.10,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
12345.1,12345.10,US,Add missing decimal value
12345.1$,12345.10,US,Add missing decimal value. Remove any non numbers other than periods and commas
12345.10,12345.10,US,Do nothing
12345.10$,12345.10,US,Remove any non numbers other than periods and commas
"$12345,12",12345.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
$12345.12,12345.12,US,Remove any non numbers other than periods and commas
"12345,12$",12345.12,CA-FR,Remove any non numbers other than periods and commas. Swapped decimal seperator for period.
12345.12,12345.12,US,Do nothing
12345.12$,12345.12,US,Remove any non numbers other than periods and commas
"123,456.00",123456,US,Removed thousands seperators. Trimmed trailing zeroes
"123.456,00",123456,CA-FR,Removed thousands seperators. Trimmed trailing zeroes
"123,456.10",123456.10,US,Removed thousands seperators
"123.456,10",123456.10,CA-FR,Removed thousands seperators. Swapped decimal seperator for period.
"1,234,567.00",1234567,US,Removed thousands seperators. Trimmed trailing zeroes
"1.234.567,00",1234567,CA-FR,Removed thousands seperators. Trimmed trailing zeroes
"1,234,567.10",1234567.10,US,Removed thousands seperators
"1.234.567,10",1234567.10,CA-FR,Removed thousands seperators. Swapped decimal seperator for period.
```
<!-- CASES_CSV_END -->

---

## Appendix B — Reference algorithm (ANSWER KEY — withhold to test derivation)

> # ⚠️ ANSWER KEY — never include this appendix in a candidate's materials.

This is one correct algorithm that reproduces all 161 rows. It is the reference
solution’s approach; share it only if you want an *implementation* test rather
than a *derivation* test.

1. **Unicode fold** (robustness, beyond the CSV): `String.normalize('NFKC')` to
   fold full-width digits/punctuation, then map Arabic-Indic (U+0660–9) and
   Extended Arabic-Indic / Persian (U+06F0–9) digits to ASCII and the Arabic
   decimal separator U+066B → `,`.
2. **Strip** every character except `0-9`, `,`, `.` (removes `$`, letters, spaces,
   etc.). If no digits remain → **IMPOSSIBLE**.
3. **Decide the decimal point by the rightmost separator:**
   - if **both** `,` and `.` are present, the rightmost is the decimal point and
     the other type is the thousands separator;
   - if only **one** type is present, then **exactly 3 digits after the last one**
     means it is a thousands separator (no decimal part); **0/1/2/4+** digits means
     it is the decimal point;
   - if **none**, the value is a plain integer.
4. **Validate the integer (grouping) region:** it may contain only **one** type of
   thousands separator, and the groups must be a leading group of 1–3 digits
   followed by groups of **exactly 3**; otherwise → **IMPOSSIBLE**.
5. **Compute the value** with integer-cent math (no floating point): combine the
   integer digits and the (≤2, rounded **half-up**) fraction digits into a cent
   count. An integer part longer than 13 digits → reject (keeps cents exact within
   `Number.MAX_SAFE_INTEGER`).
6. **Format** `normalized` as the bare string (Section 3) and pick `detection`:
   value 0 → `UNIVERSAL`; else period-decimal → `US`, comma-decimal → `CA-FR`,
   comma-thousands → `US`, period-thousands → `CA-FR`, no separators → `UNIVERSAL`.

Worked examples: `40.15$` → `40.15`/US · `$25.5` → `25.50`/US ·
`$55.123,45` → `55123.45`/CA-FR · `1 234,56 $` → `1234.56`/CA-FR ·
`1.234` → `1234`/CA-FR · `1,00.10` → `0`/IMPOSSIBLE · `XYZ` → `0`/IMPOSSIBLE.

### Behavior matrix (answer key — equivalence classes & boundaries)

| Class | Examples | Result |
|-------|----------|--------|
| Plain integer | `0`, `12`, `1234`, `$123` | bare integer, UNIVERSAL |
| US decimal | `1.00`, `1.1`, `1234.12` | `1`, `1.10`, `1234.12`, US |
| CA-FR decimal | `1,00`, `1,10`, `12,12$` | `1`, `1.10`, `12.12`, CA-FR |
| US thousands | `1,234.10`, `12,345.00`, `1,234,567.10` | grouping removed, US |
| CA-FR thousands | `1.234`, `1.234,10`, `1.234.567,00` | grouping removed, CA-FR |
| Lone 3-digit group | `1.234`, `1,223` | thousands → `1234` / `1223` |
| Symbols / noise | `$ 1 XYZ`, `1.00$`, `CA$ 75,25` | symbols stripped |
| Full-width / Arabic | `１２３４．５６`, `0٫99` | folded → `1234.56`, `0.99` |
| Zero | `0`, `0.0`, `0,00` | `0`, UNIVERSAL |
| IMPOSSIBLE | `1,00.10`, `1,0000.10`, `1,000.100,00`, `XYZ` | rejected |
| Too large | 14+ integer digits | rejected |
| Boundary: digits after a lone separator | 0,1,2,**3**,4 | 3 → thousands; otherwise decimal |
| Boundary: group sizes | first 1–3, rest exactly 3 | anything else → IMPOSSIBLE |
| Boundary: rounding half-up | `x.xx4`↓ / `x.xx5`↑ | integer cent carry exact |
