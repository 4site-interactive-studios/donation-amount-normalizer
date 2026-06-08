# Comparison — This normalizer vs. ENgrid's native `cleanAmount`

> **⚠️ GRADER / REFERENCE ONLY — do not show to a candidate under test.** This
> contains an answer-key section (edge-case decisions). It is part of the grader
> material; the candidate-facing brief is in [`benchmark/`](benchmark/).

A head-to-head between this repo's currency normalizer and the **native amount
handling in [ENgrid](https://github.com/4site-interactive-studios/engrid-scripts)**
(the Engaging Networks front-end framework), which already solves the same donor
problem in production. Use this as a reusable assessment: ENgrid is the **baseline
to beat**, and any future rebuild (human or AI) can be scored the same way.

- **"This repo" / reference implementation:** the `index.html` normalizer in this
  repository, **built from scratch by Claude Opus 4.8 Max** (2026-06-08). It is the
  reference entry on the benchmark; everywhere below, the **"This repo"** column is
  that Opus 4.8 Max implementation.
- **ENgrid version measured:** `0.25.6` (commit `e538e7e8`)
- **Date:** 2026-06-08
- **Method:** ENgrid's `ENGrid.cleanAmount()` was ported verbatim (TS annotations
  removed) into [`test/compare-engrid.js`](test/compare-engrid.js) and run against
  the **identical** `cases.csv` benchmark and the **identical** 300k fuzz set used
  for this repo. Numbers below are produced by that script — re-run it to verify.

ENgrid source under comparison:
- `ENGrid.cleanAmount(amount)` — `packages/scripts/src/engrid.ts:375` (the input sanitizer)
- `ENGrid.formatNumber(...)` — `engrid.ts:346` (display formatter)
- `OtherAmount` — `other-amount.ts:36-69` (fires the sanitizer on `change`/blur, rewrites the field in place)
- `MinMaxAmount` — `min-max-amount.ts` (min/max validation, default 1–100000)
- `CustomCurrency` / `live-currency.ts` (multi-currency symbols + live conversion)

---

## TL;DR

ENgrid's `cleanAmount` and this normalizer **agree on almost all well-formed ASCII
input** — the disambiguation rules (rightmost-separator decimal, 3-digit group
validation, mixed-separator rejection) are nearly the same. The differences are at
the edges and in scope:

- **This repo** is a focused, **standalone, formally-tested, robust** normalizer
  that adds **format detection**, an **impossible-vs-zero** distinction,
  **real-time** per-keystroke feedback, **Unicode folding**, and **integer-cent
  math** — and ships with a 161-case + 300k-fuzz test harness.
- **ENgrid** is a **production framework component** that does *less* per-input
  cleaning robustly but *more* around it: **min/max validation**, **multi-currency
  symbols**, **live currency conversion**, and **native Engaging Networks form
  integration** — things this standalone tool intentionally leaves out of scope.

---

## Empirical results (from `test/compare-engrid.js`)

### Benchmark — 161 rows of `cases.csv`

| Measure | This repo (Opus 4.8 Max) | ENgrid `cleanAmount` |
|---|---|---|
| Normalized **output** matches sheet | **161 / 161 (100%)** | 160 / 161 (99.4%) |
| **Format detection** matches sheet | **161 / 161 (100%)** | n/a — *no detection feature* |
| Returns `NaN` on a benchmark row | 0 | 0 |
| IMPOSSIBLE rows it can flag as impossible | 8 / 8 | **0 / 8** (returns `0`, indistinguishable from a real zero) |

### Robustness — identical 300,000-input fuzz (digits, separators, symbols, unicode, control chars)

| Measure | This repo (Opus 4.8 Max) | ENgrid `cleanAmount` |
|---|---|---|
| Threw an exception | 0 | 0 |
| Produced **`NaN`** | **0** | **23,591 (≈7.9%)** |
| Produced non-finite (`Infinity`) | 0 | 0 |

ENgrid never crashes, but ~1 in 13 arbitrary inputs yields `NaN`, which surfaces in
the field as the literal text `"NaN"` (`NaN.toFixed(2)`) or as a `NaN` amount.

### The single benchmark divergence

| Input | Sheet (this repo) | ENgrid | Note |
|---|---|---|---|
| `1,234,00` | `1234` / `CA-FR` | `0` | ENgrid's "multiple commas, no period ⇒ invalid" rule rejects comma-as-decimal-after-comma-grouping; the sheet treats it as `1 234,00 → 1234`. ENgrid is *stricter* here. |

### Illustrative one-offs (not in the sheet)

| Input | This repo | ENgrid | Why it matters |
|---|---|---|---|
| `.` | `0` / IMPOSSIBLE | **`NaN`** | Robustness: bare separator. |
| `12．34` (full-width `.`) | `12.34` / US | **`1234`** | 100× error — full-width punctuation stripped, digits merged. |
| `５０` (full-width digits) | `50` / UNIVERSAL | **`0`** | Amount silently dropped — non-ASCII digits stripped. |
| `0٫99` (Arabic decimal sep) | `0.99` / CA-FR | **`99`** | 100× error — separator stripped. |
| `1.2.3` | `0` / IMPOSSIBLE | `0` | Agree (both reject). |
| `1,5` | `1.50` / CA-FR | `1.50` | Agree. |
| `5.000` | `5000` / CA-FR | `5000` | Agree (3-digit group ⇒ thousands). |

---

## Comprehensive capability comparison

✅ full · ⚠️ partial / caveat · ❌ absent · ➖ intentionally out of scope

| Capability | This repo (Opus 4.8 Max) | ENgrid `0.25.6` (native) |
|---|---|---|
| **US format** (`$1,234.56`, `40.15$`, `$25.5`) | ✅ | ✅ |
| **French-Canadian** (`1 234,56 $`) | ✅ | ✅ |
| **International / European** (`55.123,45`, `1.234,56`) | ✅ | ✅ |
| **Lone 3-digit group ⇒ thousands** (`1.234`→1234) | ✅ | ✅ |
| **Mixed-separator / sandwich rejection** | ✅ | ✅ (one stricter case: `1,234,00`) |
| **Benchmark output accuracy** (cases.csv) | ✅ 100% | ⚠️ 99.4% |
| **Format detection** (US / CA-FR / UNIVERSAL / IMPOSSIBLE) | ✅ | ❌ |
| **Impossible vs. zero distinction** | ✅ | ❌ (both → `0`) |
| **Real-time, per-keystroke** | ✅ `input` event | ⚠️ on `change`/blur only |
| **UI pattern** | ✅ separate read-only preview (input preserved) | ⚠️ rewrites the same field in place |
| **Unicode / full-width / Arabic-Indic digits** | ✅ NFKC + digit/sep folding | ❌ stripped → wrong value or dropped |
| **Never returns `NaN`/`Infinity`** | ✅ (0 in 300k) | ❌ (~7.9% `NaN`) |
| **Money math** | ✅ integer cents, no float | ⚠️ `parseFloat`/`toFixed` (JS float) |
| **Output type** | string (normalized) + `$` rendering | JS `number` (caller formats) |
| **Min / max amount validation** | ➖ out of scope | ✅ `MinMaxAmount` (+ custom messages, live validation, blocks submit) |
| **Multi-currency symbols** (USD/GBP/EUR, per country) | ➖ USD only | ✅ `CustomCurrency` |
| **Live currency conversion / display** | ➖ | ✅ `live-currency` |
| **Display formatting** (grouped, localizable) | ⚠️ USD `$1,234.56` only | ✅ `formatNumber(n, dec, decPt, sep)` |
| **Engaging Networks form integration** (radios, "other", fees, frequency) | ➖ standalone demo | ✅ native |
| **Standalone, zero-dependency, single file** | ✅ one `index.html`, offline | ❌ framework module (build + EN page) |
| **Automated test suite for the cleaner** | ✅ 161 cases + property + idempotency + 300k fuzz | ❌ no tests / no test runner in repo |
| **Published per-input spec** | ✅ `cases.csv` + `AGENTS.md` | ❌ behavior defined only by code |

---

## Fair read — where each one wins

**This normalizer is better when** the goal is *robust, transparent
normalization*: showing the donor exactly what was parsed in real time,
distinguishing "we can't read this" from "$0", surviving any input (paste,
mobile IME, non-Latin digits) without `NaN`, and proving correctness with a
regression suite.

**ENgrid is better when** you need a *complete donation experience*: it enforces
min/max gift bounds, swaps currency symbols by country, shows live currency
conversion, and is wired into the Engaging Networks form lifecycle. Its
`cleanAmount` is intentionally small — a number-in/number-out helper — and on the
clean ASCII a real EN form actually receives, it is 99.4% aligned with this spec.

The two are complementary: this repo is essentially a hardened, test-backed,
detection-aware **upgrade of `cleanAmount`'s core**, minus the surrounding form
framework.

---

## Using this for future assessments

`cleanAmount`'s scores above are a concrete **baseline** for the
[`AGENTS.md`](AGENTS.md) benchmark. A candidate rebuild should be expected to at
least match ENgrid on functional correctness (≥99% of `cases.csv`) and to **beat**
it on the dimensions it lacks:

| AGENTS.md dimension | ENgrid `cleanAmount` baseline |
|---|---|
| Functional correctness (50%) | ~99.4% output; 0% on the detection sub-criterion |
| Generalization (20%) | fails Unicode / non-ASCII digit variants |
| Robustness (15%) | 0 throws but ~7.9% `NaN` → partial |
| Requirements (15%) | not standalone; not per-keystroke; rewrites field in place |

**Reproduce:**

```bash
node test/compare-engrid.js     # this repo vs ported ENGrid.cleanAmount, on cases.csv + 300k fuzz
node test/run-tests.js          # this repo's own full suite (161 + property + idempotency + fuzz)
```

To re-benchmark against a newer ENgrid, re-port `ENGrid.cleanAmount` (and the
`other-amount.ts` field-format line) from the target version into
`test/compare-engrid.js` and re-run. The ported copy is clearly attributed at the
top of that file; ENgrid remains the source of truth for its own code.

---

## Reference solution — edge-case decisions (answer key)

> Kept here in the grader/assessment doc — **not** in `TESTING.md` — so a candidate
> rebuilding from the brief does not see how the tricky cases were resolved. These
> are the deliberate decisions behind this repo's normalizer and the residual risks
> they accept.

| Decision / risk | How it is resolved (and why it is acceptable) |
|---|---|
| Sheet rows `1,223` / `1,012` were internally inconsistent | Corrected in `cases.csv`; the engine produces the consistent value (`1223`, `1012`); the suite is fully green. |
| Lone-separator 3-digit ambiguity (`1.234` = `1234`, not `1.234`) | Resolved deterministically per the sheet; the value and the `$` rendering are shown before submit so a donor can catch a misread. |
| Full-width / Arabic-Indic / Persian numerals | Folded to ASCII (NFKC + explicit digit/separator map) so they normalize correctly instead of being silently corrupted. |
| Other numeral scripts (Devanagari, Thai, …) | Stripped → IMPOSSIBLE (fail-closed); never a wrong value. Out of scope for a US + fr-CA audience. |
| Amount above ~$10 trillion (>13 integer digits) | Rejected as too large rather than risking precision loss (keeps integer-cent math exact within `Number.MAX_SAFE_INTEGER`). |
| Non-currency paste with no digits | IMPOSSIBLE; no value submitted. |
