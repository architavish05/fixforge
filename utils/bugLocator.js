'use strict';

/**
 * bugLocator.js
 *
 * Analyses a bug report and the provided source code files to locate
 * the most likely buggy line. This is a deterministic heuristic analyser
 * (no external AI calls) that searches for common off-by-one patterns,
 * wrong operators, and boundary conditions.
 *
 * Returns a patternLabel on the result so downstream modules (confidenceScorer,
 * bugMemory) can key off the detected pattern type.
 */

/**
 * Scans source lines for suspicious arithmetic patterns near keywords
 * that often indicate off-by-one or wrong-operator bugs.
 *
 * @param {string} source   Raw source code string
 * @returns {{ lineNumber: number, lineText: string, pattern: string }[]}
 */
function findSuspiciousLines(source) {
  const lines = source.split('\n');
  const suspects = [];

  // Patterns that commonly indicate bugs
  const patterns = [
    { regex: /\/\s*\(\s*\w+\.length\s*-\s*1\s*\)/, label: 'off-by-one denominator: divides by (length - 1) instead of length' },
    { regex: /\/\s*\(\s*\w+\.length\s*\+\s*1\s*\)/, label: 'off-by-one denominator: divides by (length + 1)' },
    { regex: /<\s*\w+\.length\s*-\s*1\b/, label: 'off-by-one loop bound: < length-1 excludes last element' },
    { regex: /<=\s*\w+\.length\b/, label: 'off-by-one loop bound: <= length causes out-of-bounds access' },
    { regex: /\*\s*-\s*1\b/, label: 'suspicious negation in multiplication' },
    { regex: /\.length\s*>=\s*\w+/, label: 'wrong-operator guard: >= instead of > causes boundary to be included' },
    { regex: /\/\/[^\n]*BUG/i, label: 'developer-marked bug comment' },
  ];

  lines.forEach((line, idx) => {
    for (const { regex, label } of patterns) {
      if (regex.test(line)) {
        suspects.push({ lineNumber: idx + 1, lineText: line.trim(), pattern: label });
      }
    }
  });

  return suspects;
}

/**
 * Correlates bug report keywords with suspicious source lines to rank candidates.
 *
 * @param {string} bugReport  Contents of bugreport.md
 * @param {string} source     Source code to analyse
 * @param {string} filename   Name of the file being analysed
 * @returns {{ file: string, line: number, lineText: string, reasoning: string }}
 */
function correlate(bugReport, source, filename) {
  const suspects = findSuspiciousLines(source);

  // Extract mentioned function names from the bug report
  const fnMatches = bugReport.match(/`([a-zA-Z_$][a-zA-Z0-9_$]*)\(\)/g) || [];
  const mentionedFns = fnMatches.map(m => m.replace(/[`()]/g, ''));

  // Score each suspect: +2 if its line contains a mentioned function name
  const scored = suspects.map(s => {
    let score = 1;
    for (const fn of mentionedFns) {
      if (s.lineText.includes(fn) || isInsideFunction(source, s.lineNumber, fn)) {
        score += 2;
      }
    }
    return { ...s, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      file: filename,
      line: -1,
      lineText: '(no suspicious line found)',
      patternLabel: null,
      reasoning: 'No known bug patterns detected. Manual review required.',
    };
  }

  const best = scored[0];
  return {
    file: filename,
    line: best.lineNumber,
    lineText: best.lineText,
    patternLabel: best.pattern,
    _score: best.score,
    reasoning:
      `Pattern detected: "${best.pattern}". ` +
      (mentionedFns.length
        ? `Bug report mentions function(s): ${mentionedFns.map(f => f + '()').join(', ')}. `
        : '') +
      `Line ${best.lineNumber} is the most likely root cause.`,
  };
}

/**
 * Simple heuristic: checks whether a given line number falls inside
 * a function whose name matches `fnName` in the source.
 */
function isInsideFunction(source, targetLine, fnName) {
  const lines = source.split('\n');
  let insideFn = false;
  let depth = 0;
  let fnStartLine = -1;

  // Escape once before the loop to avoid regex injection and redundant work
  const escapedFnName = fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fnRegex = new RegExp(`function\\s+${escapedFnName}\\b`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (!insideFn && fnRegex.test(line)) {
      insideFn = true;
      fnStartLine = lineNum;
      depth = 0;
    }

    if (insideFn) {
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;

      if (lineNum === targetLine) return true;

      if (fnStartLine !== lineNum && depth <= 0) {
        insideFn = false;
      }
    }
  }

  return false;
}

/**
 * Main export: locates the bug given the bug report text and a map of
 * filename → file contents.
 *
 * @param {string} bugReport
 * @param {{ [filename: string]: string }} codeFiles
 * @returns {{ file: string, line: number, lineText: string, reasoning: string }}
 */
function locateBug(bugReport, codeFiles) {
  const candidates = Object.entries(codeFiles).map(([filename, source]) =>
    correlate(bugReport, source, filename)
  );

  // Pick the candidate with the highest score among those where a line was found;
  // fall back to the first candidate if none found a line.
  const found = candidates
    .filter(c => c.line !== -1)
    .sort((a, b) => (b._score || 0) - (a._score || 0))[0]
    || candidates[0];

  // Strip internal _score from returned object
  const { _score, ...result } = found;
  return result;
}

module.exports = { locateBug };
