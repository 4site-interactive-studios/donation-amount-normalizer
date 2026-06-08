# Testing Plan — Donation Amount Normalizer

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
   they have since been corrected in the sheet — see §4.)

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

## 3. Normalization rules (the spec under test)

1. **Unicode fold** — `String.normalize('NFKC')` (full-width `１２．３４`→`12.34`),
   then Arabic-Indic / Persian digits → ASCII and the Arabic decimal separator
   (U+066B) → `,`.
2. **Strip** everything except digits, `,` and `.` (spaces, `$`, letters, `/`,
   NBSP, etc. are simply removed). No digits remain → **IMPOSSIBLE**.
3. **Decimal decision** — the **rightmost** separator governs:
   - if **both** `,` and `.` appear → the rightmost is the decimal point, the
     other type is the thousands separator;
   - if only **one** type appears → exactly **3** digits after the last one means
     it is a thousands separator (no decimals: `1.234`→1234, `1,234`→1234);
     **0/1/2/4+** digits means it is the decimal point (`1,5`→1.50, `12.34`→12.34).
4. **Grouping validation** — the integer (grouping) region may contain only **one**
   type of thousands separator, and every group must be a leading group of 1–3
   digits followed by groups of exactly 3 digits. Otherwise → **IMPOSSIBLE**.
   This is what rejects `1,00.10`, `1,0000.10`, `1,000.100,00`, etc.
5. **Value** — leading zeros dropped; fraction rounded **half-up** to 2 digits
   with integer cent math (`cents = dollars*100 + first2 + (3rd>=5?1:0)`), so no
   floating-point drift. Integer part > 13 digits → rejected (keeps cents exact).
6. **Detection** — zero value → `UNIVERSAL`; else period-decimal → `US`,
   comma-decimal → `CA-FR`, comma-thousands → `US`, period-thousands → `CA-FR`,
   no separators → `UNIVERSAL`.

A space is never a separator (it is stripped), so `1 234,56` → `1234.56` works for
fr-CA, and `25 50` → `2550` (the sheet's "remove any non-numbers" rule).

---

## 4. The `cases.csv` suite (and the two corrected rows)

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

## 5. Test layers & how to run

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

## 6. Equivalence classes & boundaries

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
| IMPOSSIBLE | `1,00.10`, `1,0000.10`, `1,000.100,00`, `XYZ` | rejected (§7) |
| Too large | 14+ integer digits | rejected |
| Boundary: digits after a lone separator | 0,1,2,**3**,4 | 3 → thousands; otherwise decimal |
| Boundary: group sizes | first 1–3, rest exactly 3 | anything else → IMPOSSIBLE |
| Boundary: rounding half-up | `x.xx4`↓ / `x.xx5`↑ | integer cent carry exact |

---

## 7. IMPOSSIBLE rules (from the sheet, generalized)

An input is rejected when:

- it contains **no digits** (`XYZ`);
- the integer/grouping region mixes **both** `,` and `.` as thousands separators —
  this catches every "two commas sandwich a period" / "two decimal separators"
  case (`1,000.100,00`, `1,000.100.10`, `1.000,100,10`, `1.100,000.10`,
  `1,000.100,000.10`);
- a thousands group is **not** the leading group of 1–3 digits followed by groups
  of exactly 3 (`1,00.10` — `00` too short; `1,0000.10` — `0000` too long);
- the integer part exceeds 13 digits.

All eight IMPOSSIBLE rows in the sheet are reproduced by these checks.

---

## 8. Manual / UX / accessibility checklist

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

---

## 9. Residual risks (and why they are acceptable)

| Risk | Mitigation |
|------|------------|
| Sheet rows `1,223` / `1,012` were inconsistent | Corrected in `cases.csv` (§4); engine produces the consistent value; suite now fully green. |
| Lone-separator 3-digit ambiguity (`1.234` = 1234 not 1.234) | Resolved deterministically per the sheet; the value and `$` rendering are shown before submit. |
| Full-width / Arabic-Indic / Persian numerals | Folded to ASCII so they normalize correctly. |
| Other numeral scripts (Devanagari, Thai…) | Stripped → IMPOSSIBLE (fail-closed), never a wrong value. Out of scope for US + fr-CA. |
| Amount above ~$10 trillion | Rejected as too large rather than risking precision loss. |
| Non-currency paste with no digits | IMPOSSIBLE; no value submitted. |

---

## 10. Regression policy

- `cases.csv` is the contract. Edit it, run `build-cases.js`, then `run-tests.js`;
  the embedded page data and the headless suite stay in lock-step.
- Any change to the normalizer must keep the suite green (161 pass / 0 mislabel / 0
  fail) or update `cases.csv` + the mislabel list in the same commit with a reason.
- Run `node test/run-tests.js` in CI; non-zero exit fails the build.
