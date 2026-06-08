#!/usr/bin/env node
'use strict';

/*
 * Head-to-head: this repo's normalizer vs ENgrid's native ENGrid.cleanAmount(),
 * both run against the identical benchmark (cases.csv) and the same fuzz set.
 *
 * The ENGrid function below is ported VERBATIM (TS type annotations removed) from
 * engrid-scripts: packages/scripts/src/engrid.ts  ->  static cleanAmount(amount),
 * plus the field-value formatting from other-amount.ts's `change` handler
 * (`clean % 1 != 0 ? clean.toFixed(2) : clean.toString()`). Ported here only so
 * the comparison is reproducible; ENgrid remains the source of truth for its code.
 *
 *   node test/compare-engrid.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseCSV } = require('./csv');

const HTML_PATH = path.join(__dirname, '..', 'index.html');
const CSV_PATH = path.join(__dirname, 'cases.csv');

/* ---- our normalizer, extracted from the shipped index.html ---- */
function loadOurs() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  function block(a, b) {
    const s = html.indexOf(a), e = html.indexOf(b);
    return html.slice(html.lastIndexOf('/*', s), html.indexOf('*/', e) + 2);
  }
  const sandbox = {}; sandbox.window = sandbox; vm.createContext(sandbox);
  vm.runInContext(block('==NORMALIZER_START==', '==NORMALIZER_END=='), sandbox);
  return sandbox.CurrencyNormalizer;
}
const OURS = loadOurs();

/* ---- ENgrid native (ported verbatim from engrid-scripts) ---- */
function engridCleanAmount(amount) {
  const valueArray = amount.replace(/[^0-9,\.]/g, '').split(/[,.]+/);
  const delimArray = amount.replace(/[^.,]/g, '').split('');
  if (valueArray.length === 1) {
    return parseInt(valueArray[0]) || 0;
  }
  if (valueArray
    .map((x, index) => (index > 0 && index + 1 !== valueArray.length && x.length !== 3) ? true : false)
    .includes(true)) {
    return 0;
  }
  if (delimArray.length > 1 && !delimArray.includes('.')) {
    return 0;
  }
  if ([...new Set(delimArray.slice(0, -1))].length > 1) {
    return 0;
  }
  if (valueArray[valueArray.length - 1].length <= 2) {
    const cents = valueArray.pop() || '00';
    return parseInt(cents) > 0
      ? parseFloat(Number(parseInt(valueArray.join('')) + '.' + cents).toFixed(2))
      : parseInt(valueArray.join(''));
  }
  return parseInt(valueArray.join(''));
}
// What the donor actually sees in the field after ENgrid's `change` handler runs.
function engridFieldValue(input) {
  const clean = engridCleanAmount(input);
  return clean % 1 != 0 ? clean.toFixed(2) : clean.toString();
}

/* ================= Benchmark: both vs cases.csv ================= */
const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8')).filter(r => r.length >= 3);
rows.shift();

let oursOut = 0, oursDet = 0;
let engOut = 0;
let engNaN = 0, engImpossibleUnflagged = 0;
const divergences = [];

for (const r of rows) {
  const input = r[0], expOut = r[1], expDet = r[2];

  const o = OURS.normalize(input);
  if (o.normalized === expOut) oursOut++;
  if (o.detection === expDet) oursDet++;

  let eg;
  try { eg = engridFieldValue(input); } catch (e) { eg = 'THREW:' + e.message; }
  if (eg === 'NaN') engNaN++;
  if (eg === expOut) {
    engOut++;
    if (expDet === 'IMPOSSIBLE') engImpossibleUnflagged++; // matches "0" but cannot signal impossible
  } else {
    divergences.push({ input, expOut, expDet, eng: eg });
  }
}

/* ================= Robustness: identical fuzz ================= */
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rand = mulberry32(0xC0FFEE);
const ALPHABET = ('0123456789.,    $€£¥-()CAUSDeurok\t\n+/\\*#%abc１２．，٫٢٣').split('');
const FUZZ_N = 300000;
let oursThrew = 0, oursBad = 0, engThrew = 0, engNaNFuzz = 0, engNonFinite = 0;
for (let i = 0; i < FUZZ_N; i++) {
  let s = ''; const len = Math.floor(rand() * 24);
  for (let j = 0; j < len; j++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  try { const o = OURS.normalize(s); if (typeof o.normalized !== 'string' || !isFinite(o.cents)) oursBad++; }
  catch (e) { oursThrew++; }
  try { const n = engridCleanAmount(s); if (Number.isNaN(n)) engNaNFuzz++; else if (!isFinite(n)) engNonFinite++; }
  catch (e) { engThrew++; }
}

/* ================= Report ================= */
const pct = (n) => (100 * n / rows.length).toFixed(1) + '%';
console.log('\n================ Normalizer vs ENgrid native (cleanAmount) ================');
console.log('Benchmark: ' + rows.length + ' rows from cases.csv\n');
console.log('                                    THIS REPO        ENgrid cleanAmount');
console.log('  Normalized output matches sheet:  ' + (oursOut + '/' + rows.length).padEnd(15) + (engOut + '/' + rows.length));
console.log('  Output match rate:                ' + pct(oursOut).padEnd(15) + pct(engOut));
console.log('  Format detection matches sheet:   ' + (oursDet + '/' + rows.length).padEnd(15) + 'n/a (no detection feature)');
console.log('  Returns NaN on a benchmark row:   ' + ('0').padEnd(15) + engNaN);
console.log('  IMPOSSIBLE rows: output "0" but cannot flag as impossible: ENgrid ' + engImpossibleUnflagged);
console.log('\nRobustness — identical ' + FUZZ_N.toLocaleString('en-US') + '-input fuzz:');
console.log('  Threw an exception:               ' + ('ours ' + oursThrew).padEnd(15) + 'ENgrid ' + engThrew);
console.log('  Produced NaN:                     ' + ('ours 0').padEnd(15) + 'ENgrid ' + engNaNFuzz);
console.log('  Produced non-finite (Infinity):   ' + ('ours 0').padEnd(15) + 'ENgrid ' + engNonFinite);

console.log('\nRows where ENgrid output differs from the sheet (' + divergences.length + '):');
for (const d of divergences) {
  console.log('  ' + JSON.stringify(d.input).padEnd(20) +
    ' sheet=' + (d.expOut + '/' + d.expDet).padEnd(16) + ' ENgrid=' + d.eng);
}

console.log('\nIllustrative one-offs (not in the sheet):');
for (const ex of ['.', '12．34', '５０', '0٫99', '1.2.3', '1,5', '5.000']) {
  console.log('  ' + JSON.stringify(ex).padEnd(12) +
    ' ours=' + (OURS.normalize(ex).normalized + '/' + OURS.normalize(ex).detection).padEnd(16) +
    ' ENgrid=' + engridFieldValue(ex));
}
