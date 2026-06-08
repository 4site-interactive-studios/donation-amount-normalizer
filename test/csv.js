'use strict';

/*
 * Minimal RFC-4180-ish CSV parser shared by build-cases.js and run-tests.js so
 * the page generator and the test harness parse cases.csv the exact same way.
 * Preserves leading/trailing spaces in unquoted fields (some inputs are e.g.
 * " $ 1 XYZ "). Handles "" escapes, comma field-split, \n row-split, \r skip.
 */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (ch === '\r') {
      // ignore; handled by \n
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

module.exports = { parseCSV };
