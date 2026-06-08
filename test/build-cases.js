#!/usr/bin/env node
'use strict';

/*
 * test/cases.csv is the single source of truth. This regenerates every derived
 * copy of it so they can never drift:
 *   1. the embedded JS array in index.html      (==CASES_START== / ==CASES_END==)
 *   2. the verbatim block in AGENTS.md Appendix A (<!-- CASES_CSV_START/END -->)
 *   3. benchmark/cases.csv                        (the candidate-facing copy)
 * Re-run after editing cases.csv:  node test/build-cases.js
 * (run-tests.js asserts these stay in sync, so CI catches a forgotten rebuild.)
 */

const fs = require('fs');
const path = require('path');
const { parseCSV } = require('./csv');

const CSV_PATH = path.join(__dirname, 'cases.csv');
const HTML_PATH = path.join(__dirname, '..', 'index.html');
const AGENTS_PATH = path.join(__dirname, '..', 'AGENTS.md');
const BENCH_CSV_PATH = path.join(__dirname, '..', 'benchmark', 'cases.csv');

function replaceBetween(text, startMark, endMark, body, label) {
  const s = text.indexOf(startMark), e = text.indexOf(endMark);
  if (s === -1 || e === -1) { console.error(label + ': markers not found'); process.exit(1); }
  return text.slice(0, s + startMark.length) + body + text.slice(e);
}

const raw = fs.readFileSync(CSV_PATH, 'utf8');
const rows = parseCSV(raw).filter(r => r.length >= 3 && !(r.length === 1 && r[0] === ''));
rows.shift(); // header

const cases = rows.map(r => ({ input: r[0], output: r[1], detection: r[2], reasoning: r[3] || '' }));

// 1. index.html embedded array
let html = fs.readFileSync(HTML_PATH, 'utf8');
html = replaceBetween(html, '/* ==CASES_START== */', '/* ==CASES_END== */',
  '\nwindow.__CASES__ = ' + JSON.stringify(cases, null, 0) + ';\n', 'index.html');
fs.writeFileSync(HTML_PATH, html, 'utf8');

// 2. AGENTS.md Appendix A verbatim fenced block
let agents = fs.readFileSync(AGENTS_PATH, 'utf8');
agents = replaceBetween(agents, '<!-- CASES_CSV_START -->', '<!-- CASES_CSV_END -->',
  '\n```csv\n' + raw.replace(/\s+$/, '') + '\n```\n', 'AGENTS.md');
fs.writeFileSync(AGENTS_PATH, agents, 'utf8');

// 3. benchmark/cases.csv exact copy
fs.mkdirSync(path.dirname(BENCH_CSV_PATH), { recursive: true });
fs.writeFileSync(BENCH_CSV_PATH, raw, 'utf8');

console.log('Regenerated from cases.csv (' + cases.length + ' rows): index.html, AGENTS.md Appendix A, benchmark/cases.csv');
