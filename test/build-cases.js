#!/usr/bin/env node
'use strict';

/*
 * Reads cases.csv and injects the rows as a JS array into index.html between the
 * ==CASES_START== / ==CASES_END== markers, keeping the page standalone while the
 * spreadsheet remains the single source of truth. Re-run after editing cases.csv:
 *
 *     node test/build-cases.js
 */

const fs = require('fs');
const path = require('path');
const { parseCSV } = require('./csv');

const CSV_PATH = path.join(__dirname, 'cases.csv');
const HTML_PATH = path.join(__dirname, '..', 'index.html');

const raw = fs.readFileSync(CSV_PATH, 'utf8');
const rows = parseCSV(raw).filter(r => r.length >= 3 && !(r.length === 1 && r[0] === ''));
const header = rows.shift(); // Input,Output,Format Detection,Reasoning

const cases = rows.map(r => ({
  input: r[0],
  output: r[1],
  detection: r[2],
  reasoning: r[3] || ''
}));

const literal = 'window.__CASES__ = ' + JSON.stringify(cases, null, 0) + ';';

let html = fs.readFileSync(HTML_PATH, 'utf8');
const startMark = '/* ==CASES_START== */';
const endMark = '/* ==CASES_END== */';
const start = html.indexOf(startMark);
const end = html.indexOf(endMark);
if (start === -1 || end === -1) { console.error('CASES markers not found in index.html'); process.exit(1); }

const before = html.slice(0, start + startMark.length);
const after = html.slice(end);
html = before + '\n' + literal + '\n' + after;
fs.writeFileSync(HTML_PATH, html, 'utf8');

console.log('Injected ' + cases.length + ' cases from ' + path.basename(CSV_PATH) + ' into index.html');
