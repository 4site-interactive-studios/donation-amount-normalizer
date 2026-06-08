# Donation Amount Normalizer

A standalone, dependency-free `index.html` that takes a donation amount typed in
almost any common **US** or **French-Canadian / international** format —
malformed, incomplete, or grouped — and normalizes it to a clean USD value in
real time, or rejects it as *not a possible number*.

Built from scratch as a focused experiment; not tied to any framework or backend.

```
40.15$        -> 40.15        (US)
$25.5         -> 25.50        (US)
$55.123,45    -> 55123.45     (CA-FR)
1 234,56 $    -> 1234.56      (CA-FR)
1.234         -> 1234         (CA-FR, period thousands)
1,00.10       -> rejected     (IMPOSSIBLE: bad grouping)
XYZ           -> rejected     (IMPOSSIBLE: no number)
```

## Output contract

`normalize(raw)` returns a **bare** number string (no `$`, no thousands
separators, 2 decimals unless whole — `1.00`→`1`, `1.1`→`1.10`) plus a format
**detection**: `US`, `CA-FR`, `UNIVERSAL`, `IMPOSSIBLE`, or `EMPTY`. A friendly
`$1,234.10` rendering is also provided for display. All value math uses integer
cents, so there is no floating-point drift.

## Run it

```bash
# Open directly, or serve (preview server config is in .claude/launch.json):
python3 -m http.server 8765      # then visit http://localhost:8765/

# Append ?selftest to auto-run the in-page test suite:
#   http://localhost:8765/?selftest
```

## Tests

The behavioral spec lives in [`test/cases.csv`](test/cases.csv) (161 rows). The
harness extracts the **exact** normalizer shipped in `index.html` and runs it
against every row, plus a property grid, an idempotency check, a bundle-sync guard,
and 300,000 fuzz inputs (proving it never throws).

```bash
node test/run-tests.js        # full suite + fuzz; exit 0 = green
node test/build-cases.js      # regenerate every derived copy of cases.csv after editing the sheet
node test/compare-engrid.js   # head-to-head vs ENgrid's native cleanAmount
```

Current status: **161 / 161 rows pass · 0 failures**, 300k-input fuzz clean.

`test/cases.csv` is the single source of truth; `build-cases.js` regenerates the
embedded copies (in `index.html`, `AGENTS.md` Appendix A, and `benchmark/cases.csv`)
and `run-tests.js` fails if any drift, so they can never fall out of sync.

## Repository layout

> **The repo root is the reference solution + grader material.** When running the
> benchmark against another model, hand it **only the [`benchmark/`](benchmark/)
> folder** — everything else is an answer key.

| Path | Audience | Contents |
|------|----------|----------|
| [`benchmark/`](benchmark/) | **candidate** | `PROMPT.md` (the brief) + `cases.csv` — the only thing a candidate receives |
| `index.html` | grader / public | the reference solution (also the live demo) |
| [`AGENTS.md`](AGENTS.md) | grader | how to run the benchmark, scoring rubric, and the answer key (Appendix B) |
| [`TESTING.md`](TESTING.md) | grader | how the reference is tested (methodology only) |
| [`COMPARISON.md`](COMPARISON.md) | grader | head-to-head vs ENgrid + edge-case answer key |
| `test/` | grader | harness, comparison script, canonical `cases.csv` |

`TESTING.md`, `COMPARISON.md`, and `AGENTS.md` carry a grader-only banner; the
reference algorithm lives only in `AGENTS.md` Appendix B so the other docs don't
leak hints.

## Comparison vs. ENgrid

[`COMPARISON.md`](COMPARISON.md) is a head-to-head against the native amount
handling in [ENgrid](https://github.com/4site-interactive-studios/engrid-scripts)
(`ENGrid.cleanAmount`), run against the same `cases.csv` benchmark + 300k fuzz via
[`test/compare-engrid.js`](test/compare-engrid.js). It doubles as a reusable
baseline ("beat ENgrid") for the benchmark.

## Benchmark

The benchmark hands a model the candidate brief [`benchmark/PROMPT.md`](benchmark/PROMPT.md)
plus `benchmark/cases.csv` and asks it to rebuild this tool from scratch; the
grader scores it objectively (correctness + generalization + robustness +
requirements) per [`AGENTS.md`](AGENTS.md) to compare progress over time.
