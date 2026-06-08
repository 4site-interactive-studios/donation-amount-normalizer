# Testing Plan — Donation Amount Normalizer

> **⚠️ GRADER / REFERENCE ONLY — do not show to a candidate under test.** This
> describes how the *reference* solution is tested. The algorithm/answer key is
> deliberately kept out of this file (see [`AGENTS.md`](AGENTS.md) Appendix B). To
> run the benchmark, hand the candidate only the [`benchmark/`](benchmark/) folder.

Goal: a donor can type a US or French-Canadian currency amount in essentially any
common (or malformed, incomplete, international) form, and the page either shows
the correct normalized value in real time or rejects it as **not a possible
number** — with **not a single runtime error**.

The authoritative behavioral spec is the supplied spreadsheet, captured verbatim
as [`test/cases.csv`](test/cases.csv). `test/run-tests.js` runs the *literal* code
shipped in `index.html` (it extracts the function from the file rather than
copying it) against every row of that sheet plus property and fuzz layers, so the
plan and the product can never drift.

---

## 1. What "no errors" means

Two separate guarantees, both tested:

1. **Robustness — the code never throws and never returns garbage.** For *any*
   input (binary junk, unicode, megabyte pastes), `normalize()` returns a
   well-formed object: `normalized` is a string, `detection` is one of the five
   allowed values, `cents` is a finite non-negative integer, `valid` is boolean.
   No exceptions, no `NaN`, no `Infinity`, no floating-point cent drift.
2. **Correctness — defined inputs map to defined outputs.** Every row of
   `cases.csv` matches the sheet exactly. (Two rows were originally inconsistent;
   they have since been corrected in the sheet — see §3.)

---

## 2. Output contract

`normalize(raw)` returns:

| field | meaning |
|-------|---------|
| `normalized` | **bare** number string — no `$`, no thousands separators, exactly 2 decimals unless whole. `1.00`→`"1"`, `1.1`→`"1.10"`, `1234.10`→`"1234.10"`, `0.0`→`"0"`. IMPOSSIBLE→`"0"`, EMPTY→`""`. |
| `detection` | `US` (period decimal / comma thousands), `CA-FR` (comma decimal / period thousands), `UNIVERSAL` (no separators, or the value is zero), `IMPOSSIBLE` (not a possible number), `EMPTY`. |
| `cents` | integer USD cents (source of truth for the value). |
| `currency` | friendly `$1,234.10` rendering for display (not part of the sheet contract). |
| `valid` / `reasoning` | whether a value was produced, and a short human explanation. |

The page shows `normalized` in the read-only field, with `detection` and
`currency` in the metadata line; IMPOSSIBLE inputs clear the field and show a red
status.

---

> **The normalization rules, the equivalence-class behavior matrix, and the
> IMPOSSIBLE algorithm have been moved out of this file.** They are the reference
> solution's *answer key* and live in [`AGENTS.md`](AGENTS.md) Appendix B
> (grader-only), so this testing doc does not reveal how the solution works to a
> candidate rebuilding from the brief. The acceptance behavior itself is fully
> defined by [`test/cases.csv`](test/cases.csv).

---

## 3. The `cases.csv` suite (and the two corrected rows)

All 160 data rows are baked into the page (injected from `cases.csv` by
`test/build-cases.js`) and run live under **Test suite** (or `?selftest`). Each row
is `PASS` (matches the sheet), `MISLABEL` (sheet row is wrong; corrected value
shown), or `FAIL` (a real defect — there are none).

The user flagged that "some of these could be wrong / mislabeled." Running the
derived rules against all rows surfaced exactly **two** internally-inconsistent
rows. These have now been **corrected in `cases.csv`**, so the whole sheet passes:

| Input | Was | Corrected to | Why the original was wrong |
|-------|-----|--------------|----------------------------|
| `1,223` | `1234`, US | `1223`, US | `1234` cannot come from `1,223`; the digits don't match — a typo. The reasoning ("removed thousands separators") was right; the value was mistyped. |
| `1,012` | `1.12`, CA-FR | `1012`, US | 3 digits after a single comma is a thousands group — the same rule that makes `1.234`→`1234` and `1,223`→`1223`. `1.12` is also not what `1,012` would be as a decimal (`1.01`), so the row was doubly inconsistent. |

The mislabel mechanism remains in place for the future: `window.__MISLABELS__`
(currently empty) maps a trimmed input to `{ out, det, why }`; the harness accepts
such a row only if the engine produces that corrected value, and fails if a
declared entry is never triggered (so the list can't go stale).

---

## 4. Test layers & how to run

| Layer | Where | What it proves |
|------|-------|----------------|
| `cases.csv` | `run-tests.js` Layer 1 | Every spreadsheet row matches the sheet (or a documented mislabel, if any are ever re-introduced). |
| Property grid | `run-tests.js` Layer 2 | Every `{integer}×{0–2 cent digits}` spelled US / CA-FR / plain / noisy normalizes to the **same** bare value. |
| Idempotency | `run-tests.js` Layer 3 | Re-normalizing a `normalized` value reproduces it. |
| Fuzz (300k) | `run-tests.js` Layer 4 | Random hostile strings (incl. unicode) never throw; result always well-formed; `normalized === bareNumber(cents)`; impossible→`"0"`. |
| In-browser | `index.html?selftest` | The shipped browser runtime reproduces the same 161 pass / 0 mislabel / 0 fail. |

```bash
# Headless full suite + 300k fuzz (exit 0 = green):
node test/run-tests.js

# Regenerate the embedded cases after editing cases.csv:
node test/build-cases.js

# In the browser: open index.html (append ?selftest to auto-run the suite)
```

The harness prints `RESULT: PASS …` and exits 0; on any real failure it prints the
offending row and exits 1 (CI-ready).

---

## 5. Manual / UX / accessibility checklist

- [ ] Typing updates the normalized field on every keystroke; the raw input is never rewritten (caret never jumps).
- [ ] Empty input → neutral "Enter an amount"; IMPOSSIBLE → red status; valid → green with the `$` rendering.
- [ ] Output, status, and detection use `aria-live="polite"`.
- [ ] `<label>`s are associated; the read-only output is `tabindex="-1"`.
- [ ] The test-suite table scrolls, has a sticky header, and the filter chips (All / Mislabels / Failures) work.
- [ ] Works at 320px width and with browser zoom.

### Engine matrix
Value computation uses ES5-level features only (no `Intl`, `BigInt`). The single
newer call, `String.prototype.normalize('NFKC')` (ES2015), is feature-detected and
wrapped in `try/catch`; without it, full-width folding is skipped and ASCII input
is unaffected. Verified on Node 16; targets current Chrome/Edge/Firefox/Safari +
iOS/Android.

> Reference-solution edge-case decisions and residual risks have been moved to
> [`COMPARISON.md`](COMPARISON.md) (the grader/assessment doc) so this file does not
> reveal how the tricky cases resolve to a candidate rebuilding from the brief.

---

## 6. Regression policy

- `cases.csv` is the contract. Edit it, run `build-cases.js`, then `run-tests.js`;
  the embedded page data and the headless suite stay in lock-step.
- Any change to the normalizer must keep the suite green (161 pass / 0 mislabel / 0
  fail) or update `cases.csv` + the mislabel list in the same commit with a reason.
- Run `node test/run-tests.js` in CI; non-zero exit fails the build.
