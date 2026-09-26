'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * blastRadius.js
 *
 * Scans all .js files in sample-app/ for call sites of a given function name
 * and returns every file + line number where the function is called.
 */

/**
 * Finds all call sites of `fnName` across all JS files in the sample-app directory.
 *
 * @param {string} fnName  The function name to scan for (e.g. 'average')
 * @returns {{
 *   fnName: string,
 *   callSites: Array<{ file: string, line: number, lineText: string }>,
 *   summary: string
 * }}
 */
function analyseBlastRadius(fnName) {
  const callSites = [];
  const callRegex = new RegExp(`\\b${fnName}\\s*\\(`, 'g');

  let files;
  try {
    files = fs.readdirSync(config.paths.sampleApp).filter(f => f.endsWith('.js'));
  } catch {
    return { fnName, callSites: [], summary: 'Could not read sample-app directory.' };
  }

  for (const filename of files) {
    const filePath = path.join(config.paths.sampleApp, filename);
    const relPath = `sample-app/${filename}`;
    let source;
    try {
      source = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const lines = source.split('\n');
    lines.forEach((line, idx) => {
      // Reset lastIndex before every test() call — global regex retains state
      // between calls and would skip matches if not reset unconditionally.
      callRegex.lastIndex = 0;
      if (callRegex.test(line)) {
        callSites.push({ file: relPath, line: idx + 1, lineText: line.trim() });
      }
    });
  }

  const count = callSites.length;
  const summary = count === 0
    ? `No call sites found for ${fnName}() — fix is self-contained.`
    : `Found ${count} call site${count === 1 ? '' : 's'} for ${fnName}() — verify no regressions.`;

  return { fnName, callSites, summary };
}

module.exports = { analyseBlastRadius };
