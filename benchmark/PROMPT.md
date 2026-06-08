# Build a Donation Amount Normalizer (from scratch)

You are given **this folder only**: this brief and the acceptance test set
`cases.csv` (next to this file). Build the deliverable from scratch. Do not look
for or copy an existing solution.

---

## 1. The problem

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

## 2. The deliverable

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

## 3. The output contract (this is graded)

Your normalizer must produce, for each input:

**`normalized`** — a *bare* number **string**:
- no currency symbol, **no thousands separators**, `.` as the decimal point;
- **exactly two decimals unless the value is whole**, in which case **no decimal
  part at all**. Examples: `1.00 → "1"`, `1.1 → "1.10"`, `1234.10 → "1234.10"`,
  `0.0 → "0"`;
- round **half-up** to the nearest cent;
- for an **IMPOSSIBLE** input, `normalized` is `"0"`;
- for **empty/blank** input, `normalized` is `""` (a neutral UI state — not part
  of the graded test set).

**`detection`** — one of:
- **`US`** — period is the decimal separator and/or comma is the thousands
  separator (e.g. `1.00`, `1,234.56`).
- **`CA-FR`** — comma is the decimal separator and/or period is the thousands
  separator (e.g. `1,00`, `1.234`, `1.234,56`).
- **`UNIVERSAL`** — no separators at all (a plain integer like `1234`), **or** the
  value is exactly zero (e.g. `0`, `0.0`).
- **`IMPOSSIBLE`** — not a possible number (see Section 5).
- (`EMPTY` for blank input — UI state, not in the test set.)

## 4. Format conventions you must support

| Style | Thousands sep | Decimal sep | Example | Normalizes to |
|------|---------------|-------------|---------|---------------|
| US | `,` | `.` | `$1,234.56` | `1234.56` |
| French-Canadian | space | `,` | `1 234,56 $` | `1234.56` |
| International / European | `.` | `,` | `55.123,45` | `55123.45` |
| Plain integer | — | — | `1234` | `1234` |

Donors also include currency symbols, letters, and stray spaces (`$`, `USD`,
`CA$`, `40.15$`, ` $ 1 XYZ `). These non-numeric characters are simply removed.

## 5. What counts as IMPOSSIBLE

Reject (→ `normalized = "0"`, `detection = "IMPOSSIBLE"`) when the input is not a
possible number, e.g.:

- it contains **no digits** (`XYZ`);
- the integer part **mixes both** `,` and `.` as grouping separators, i.e. a
  separator sandwich / two decimal separators (`1,000.100,00`, `1,000.100.10`,
  `1.000,100,10`, `1.100,000.10`, `1,000.100,000.10`);
- a thousands group is **not** a leading group of 1–3 digits followed by groups of
  **exactly 3** (`1,00.10` — `00` too short; `1,0000.10` — `0000` too long).

The authoritative, exhaustive definition of correct behavior is **`cases.csv`**
(next to this file).

## 6. The authoritative test set

`cases.csv` (in this folder) is the ground truth. It has 161 rows and four columns:

```
Input, Output, Format Detection, Formatting Reasoning
```

- **Input** — the raw string a donor typed (quoted in CSV when it contains commas;
  leading/trailing spaces are significant and intentional).
- **Output** — the expected `normalized` value (`0` for IMPOSSIBLE rows).
- **Format Detection** — the expected `detection` (`US` / `CA-FR` / `UNIVERSAL` /
  `IMPOSSIBLE`).
- **Formatting Reasoning** — human notes (NOT graded; informal wording/spelling).

**A correct solution makes every row's `normalized` and `detection` match.** The
sheet is internally consistent; do not "fix" it.

> ⚠️ **Do not hardcode the 161 cases.** The CSV is the *acceptance* test, not the
> spec to memorize. Grading includes held-out inputs and fuzzing that a lookup
> table will fail. Build a general algorithm.

## 7. Rules of engagement

- Build it **from scratch**; do not search for or copy an existing currency-parsing
  library or solution.
- Make the disambiguation rules **deterministic and documented**; where an input is
  genuinely ambiguous, pick one rule and apply it consistently — `cases.csv` shows
  the intended resolution.
- Ship a way to self-verify (an in-page test runner and/or a headless harness that
  runs `cases.csv`) so results are reproducible.
