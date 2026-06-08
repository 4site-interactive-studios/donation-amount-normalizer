#!/usr/bin/env node
'use strict';

/*
 * Executable proof for TESTING.md. It does NOT re-implement the parser: it
 * extracts the exact code shipped in ../index.html and runs it, so every test
 * exercises the literal code donors use.
 *
 * Layers:
 *   1. cases.csv          — every row of the supplied spreadsheet. A row passes
 *                           if it matches the sheet, or if it is a DOCUMENTED
 *                           mislabel (sheet wrong) whose corrected value we hit.
 *   2. Property grid      — every {integer}×{cents} spelled US / CA-FR / plain
 *                           must normalize to the same bare value.
 *   3. Idempotency        — re-normalizing a normalized value reproduces it.
 *   4. Fuzz (300k random) — never throws; result always well-formed.
 *
 * Exit 0 = all layers pass (mislabels are expected, not failures).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = path.join(__dirname, '..', 'index.html');
const CSV_PATH = path.join(__dirname, 'cases.csv');

function sliceBlock(html, startMark, endMark) {
  const s = html.indexOf(startMark), e = html.indexOf(endMark);
  if (s === -1 || e === -1) throw new Error('markers not found: ' + startMark);
  const blockStart = html.lastIndexOf('/*', s);
  const blockEnd = html.indexOf('*/', e) + 2;
  return html.slice(blockStart, blockEnd);
}

function loadFromHtml() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const normCode = sliceBlock(html, '==NORMALIZER_START==', '==NORMALIZER_END==');
  const misCode = sliceBlock(html, '==MISLABELS_START==', '==MISLABELS_END==');
  const sandbox = {};
  sandbox.window = sandbox;          // IIFE uses `window`; make it the global
  vm.createContext(sandbox);
  vm.runInContext(normCode, sandbox, { filename: 'index.html#normalizer' });
  vm.runInContext(misCode, sandbox, { filename: 'index.html#mislabels' });
  if (!sandbox.CurrencyNormalizer) throw new Error('CurrencyNormalizer not exported');
  return { N: sandbox.CurrencyNormalizer, mislabels: sandbox.__MISLABELS__ || {} };
}

// CSV parser that preserves spaces in unquoted fields.
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* skip */ }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const { N, mislabels } = loadFromHtml();

let passed = 0, failed = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) passed++; else { failed++; failures.push(label + (detail ? '  ::  ' + detail : '')); }
}

/* ------------------------------------------------------------------ *
 * Layer 1 — cases.csv                                                 *
 * ------------------------------------------------------------------ */
const csvRows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8')).filter(r => r.length >= 3);
csvRows.shift(); // header
let csvPass = 0, csvMislabel = 0, csvFail = 0;
const mislabelsSeen = new Set();

for (const r of csvRows) {
  const input = r[0], expOut = r[1], expDet = r[2];
  let res;
  try { res = N.normalize(input); }
  catch (e) { csvFail++; check('CSV ' + JSON.stringify(input), false, 'threw ' + e); continue; }
  const exact = res.normalized === expOut && res.detection === expDet;
  if (exact) { csvPass++; passed++; continue; }
  const m = mislabels[input.replace(/^\s+|\s+$/g, '')];
  if (m && res.normalized === m.out && res.detection === m.det) {
    csvMislabel++; mislabelsSeen.add(input.replace(/^\s+|\s+$/g, '')); passed++; continue;
  }
  csvFail++;
  check('CSV ' + JSON.stringify(input), false,
    'sheet=(' + expOut + ',' + expDet + ') got=(' + res.normalized + ',' + res.detection + ')');
}
// Every declared mislabel must actually be exercised (guards stale entries).
for (const key of Object.keys(mislabels)) {
  check('MISLABEL exercised ' + JSON.stringify(key), mislabelsSeen.has(key),
    'declared mislabel never triggered — stale?');
}

/* ------------------------------------------------------------------ *
 * Layer 2 — property grid                                             *
 * ------------------------------------------------------------------ */
function group(intStr, sep) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep); }
function bare(cents) { const d = Math.floor(cents / 100), c = cents % 100; return c === 0 ? String(d) : d + '.' + (c < 10 ? '0' + c : '' + c); }

const ints = ['0', '1', '5', '50', '999', '1000', '12345', '999999', '1000000', '12345678'];
const cps = ['', '0', '5', '00', '99', '50', '07'];
for (const ip of ints) {
  for (const cp of cps) {
    const dollars = Number(ip);
    const cents2 = cp === '' ? 0 : Number((cp + '00').slice(0, 2));
    const expected = bare(dollars * 100 + cents2);
    const spellings = [
      group(ip, ',') + (cp ? '.' + cp : ''),   // US
      group(ip, '.') + (cp ? ',' + cp : ''),   // CA-FR
      ip + (cp ? '.' + cp : ''),               // plain
      '$ ' + group(ip, ',') + (cp ? '.' + cp : '') + ' USD', // noisy US
    ];
    for (const sp of spellings) {
      let res;
      try { res = N.normalize(sp); } catch (e) { check('PROP ' + JSON.stringify(sp), false, 'threw ' + e); continue; }
      check('PROP ' + JSON.stringify(sp) + ' -> ' + expected,
        res.valid && res.normalized === expected,
        'got ' + (res && res.normalized) + ' det=' + (res && res.detection));
    }
  }
}

/* ------------------------------------------------------------------ *
 * Layer 3 — idempotency                                              *
 * ------------------------------------------------------------------ */
for (const r of csvRows) {
  const res = N.normalize(r[0]);
  if (!res.valid) continue;
  const again = N.normalize(res.normalized);
  check('IDEMPOTENT ' + JSON.stringify(r[0]) + ' (' + res.normalized + ')',
    again.valid && again.normalized === res.normalized,
    'reparse=' + (again && again.normalized));
}

/* ------------------------------------------------------------------ *
 * Layer 4 — fuzz                                                     *
 * ------------------------------------------------------------------ */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xC0FFEE);
const ALPHABET = ('0123456789.,    $€£¥-()CAUSDeurok\t\n+/\\*#%abc１２．，٫٢٣'.split(''));
const DETS = { 'US': 1, 'CA-FR': 1, 'UNIVERSAL': 1, 'IMPOSSIBLE': 1, 'EMPTY': 1 };
const FUZZ_N = 300000;
let fuzzThrew = 0, fuzzBad = 0;
for (let i = 0; i < FUZZ_N; i++) {
  const len = Math.floor(rand() * 24);
  let s = '';
  for (let j = 0; j < len; j++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  let r;
  try { r = N.normalize(s); }
  catch (e) { fuzzThrew++; if (failures.length < 50) failures.push('FUZZ threw on ' + JSON.stringify(s) + ': ' + e); continue; }
  let ok = r && typeof r === 'object'
    && typeof r.normalized === 'string'
    && typeof r.valid === 'boolean'
    && DETS[r.detection] === 1
    && typeof r.cents === 'number' && isFinite(r.cents) && r.cents >= 0 && Math.floor(r.cents) === r.cents;
  if (ok && r.valid) {
    ok = r.normalized === N.bareNumber(r.cents);
    if (ok) { const r2 = N.normalize(r.normalized); ok = r2.valid && r2.normalized === r.normalized; }
  }
  if (ok && !r.valid) ok = (r.detection === 'IMPOSSIBLE' && r.normalized === '0') || (r.detection === 'EMPTY' && r.normalized === '');
  if (!ok) { fuzzBad++; if (failures.length < 50) failures.push('FUZZ bad on ' + JSON.stringify(s) + ' -> ' + JSON.stringify(r)); }
}
check('FUZZ no exceptions (' + FUZZ_N + ')', fuzzThrew === 0, fuzzThrew + ' threw');
check('FUZZ all well-formed', fuzzBad === 0, fuzzBad + ' malformed');

/* ------------------------------------------------------------------ *
 * Report                                                             *
 * ------------------------------------------------------------------ */
console.log('\n=== Currency Normalizer Test Report ===');
console.log('Source under test: ' + HTML_PATH);
console.log('cases.csv:    ' + csvPass + ' pass, ' + csvMislabel + ' mislabel, ' + csvFail + ' fail  (of ' + csvRows.length + ')');
console.log('Fuzz inputs:  ' + FUZZ_N.toLocaleString('en-US'));
console.log('Checks passed: ' + passed);
console.log('Checks failed: ' + failed);
if (failed) {
  console.log('\n--- Failures (first 50) ---');
  failures.slice(0, 50).forEach(f => console.log('  x ' + f));
  console.log('\nRESULT: FAIL');
  process.exit(1);
} else {
  console.log('\nRESULT: PASS — every row matches the sheet or is a documented mislabel; no errors across all layers.');
  process.exit(0);
}
