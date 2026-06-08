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
against every row, plus a property grid, an idempotency check, and 300,000 fuzz
inputs (proving it never throws).

```bash
node test/run-tests.js        # full suite + fuzz; exit 0 = green
node test/build-cases.js      # re-inject cases.csv into index.html after editing the sheet
```

Current status: **161 / 161 rows pass · 0 failures**, 300k-input fuzz clean.

See [`TESTING.md`](TESTING.md) for the full testing plan, normalization rules,
equivalence classes, `IMPOSSIBLE` rules, and residual risks.
