'use strict';

const fs = require('fs');
const path = require('path');

/**
 * fixGenerator.js
 *
 * Generates a patched version of the buggy line and rewrites the source file.
 * Applies deterministic fix rules based on the pattern detected by bugLocator.
 */

/**
 * Known fix transforms keyed by the pattern label from bugLocator.
 * Each transform receives the buggy line string and returns the fixed line string.
 */
const fixTransforms = [
  {
    // off-by-one: (numbers.length - 1)  →  numbers.length
    test: line => /\/\s*\(\s*\w+\.length\s*-\s*1\s*\)/.test(line),
    fix: line => line.replace(/\/\s*\(\s*(\w+\.length)\s*-\s*1\s*\)/, '/ $1'),
    description: 'Changed divisor from `(array.length - 1)` to `array.length` to compute the correct arithmetic mean.',
  },
  {
    // off-by-one: (numbers.length + 1)  →  numbers.length
    test: line => /\/\s*\(\s*\w+\.length\s*\+\s*1\s*\)/.test(line),
    fix: line => line.replace(/\/\s*\(\s*(\w+\.length)\s*\+\s*1\s*\)/, '/ $1'),
    description: 'Changed divisor from `(array.length + 1)` to `array.length`.',
  },
  {
    // off-by-one loop bound: < length-1  →  < length
    test: line => /<\s*\w+\.length\s*-\s*1\b/.test(line),
    fix: line => line.replace(/<\s*(\w+\.length)\s*-\s*1\b/, '< $1'),
    description: 'Fixed loop upper bound from `length - 1` to `length` so the last element is included.',
  },
  {
    // wrong-operator guard: >= instead of >  (e.g. str.length >= maxLen  →  str.length > maxLen)
    test: line => /\.length\s*>=\s*\w+/.test(line),
    fix: line => line.replace(/(\.length\s*)>=(\s*\w+)/, '$1>$2'),
    description: 'Changed guard from `>=` to `>` so values exactly equal to the threshold are not incorrectly included.',
  },
];

/**
 * Applies the appropriate fix transform to the buggy line.
 *
 * @param {string} buggyLine  The raw source line containing the bug
 * @returns {{ fixedLine: string, description: string }}
 */
function applyFix(buggyLine) {
  for (const transform of fixTransforms) {
    if (transform.test(buggyLine)) {
      return {
        fixedLine: transform.fix(buggyLine),
        description: transform.description,
      };
    }
  }
  // Fallback: return the line unchanged with a note
  return {
    fixedLine: buggyLine,
    description: 'No automatic fix rule matched. Manual review required.',
  };
}

/**
 * Generates a fix for the located bug and returns patch details.
 * Also writes the patched source file to disk at the path derived from
 * locateResult.file.
 *
 * @param {{ file: string, line: number, lineText: string, reasoning: string }} locateResult
 * @returns {{
 *   file: string,
 *   buggyLine: string,
 *   fixedLine: string,
 *   description: string,
 *   patchedSource: string
 * }}
 */
function generateFix(locateResult) {
  const { file, line, lineText } = locateResult;

  if (line === -1) {
    return {
      file,
      buggyLine: lineText,
      fixedLine: lineText,
      description: 'Could not locate bug automatically — no patch generated.',
      patchedSource: '',
    };
  }

  // Read the original source
  const absPath = path.resolve(file);
  const originalSource = fs.readFileSync(absPath, 'utf8');
  const lines = originalSource.split('\n');

  const buggyLine = lines[line - 1]; // line numbers are 1-based
  const { fixedLine, description } = applyFix(buggyLine);

  // Build patched source
  const patchedLines = [...lines];
  patchedLines[line - 1] = fixedLine;
  const patchedSource = patchedLines.join('\n');

  return {
    file,
    buggyLine,
    fixedLine,
    description,
    patchedSource,
  };
}

module.exports = { generateFix };
