'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

const { locateBug }            = require('./bugLocator');
const { generateFix }          = require('./fixGenerator');
const { generateTest }         = require('./testGenerator');
const { verifyFix }            = require('./verifier');
const { analyseBlastRadius }   = require('./blastRadius');
const { calculateConfidence }  = require('./confidenceScorer');
const { generateIncidentReport } = require('./incidentReport');
const { recordFix, findMatchingPattern } = require('./bugMemory');
const { backupFile }           = require('./rollback');

/**
 * pipelineOrchestrator.js
 *
 * Coordinates the full FixForge pipeline for a single bug report.
 * Independent steps run concurrently via Promise.all.
 *
 * Pipeline per bug:
 *   1. locateBug  (must be first — all other steps depend on it)
 *   2. Promise.all([generateFix, generateTest, analyseBlastRadius])
 *   3. Promise.all([verifyFix, confidenceScore])  (fix+test needed first)
 *   4. generateIncidentReport + recordFix  (all previous results needed)
 */

/**
 * Reads all .js files from the sample-app directory.
 * @returns {{ [relPath: string]: string }}
 */
function readCodeFiles() {
  const codeFiles = {};
  const entries = fs.readdirSync(config.paths.sampleApp).filter(f => f.endsWith('.js'));
  for (const entry of entries) {
    const absPath = path.join(config.paths.sampleApp, entry);
    codeFiles[`sample-app/${entry}`] = fs.readFileSync(absPath, 'utf8');
  }
  return codeFiles;
}

/**
 * Reads all bug report files from the sample-app directory (bugreport*.md).
 * @returns {Array<{ reportFile: string, content: string }>}
 */
function readBugReports() {
  const entries = fs.readdirSync(config.paths.sampleApp)
    .filter(f => f.startsWith('bugreport') && f.endsWith('.md'))
    .sort();

  return entries.map(f => ({
    reportFile: f,
    content: fs.readFileSync(path.join(config.paths.sampleApp, f), 'utf8'),
  }));
}

/**
 * Wraps an async operation so that errors produce a partial result rather
 * than rejecting the whole pipeline.
 *
 * When fallback is a non-null object, the error is merged into it.
 * When fallback is a primitive (string, null, etc.) the fallback is returned as-is
 * to avoid spreading onto primitive values which corrupts the result.
 *
 * @template T
 * @param {() => T | Promise<T>} fn
 * @param {T} fallback
 * @returns {Promise<T>}
 */
async function safely(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    if (fallback !== null && typeof fallback === 'object') {
      return { ...fallback, error: err.message };
    }
    // For primitives (string, null, number) return fallback unchanged
    return fallback;
  }
}

/**
 * Runs the full pipeline for a single bug report.
 *
 * @param {string} bugReport   Contents of a bugreport.md
 * @param {{ [relPath: string]: string }} codeFiles
 * @returns {Promise<object>}  Merged result object for this bug
 */
async function runSingleBugPipeline(bugReport, codeFiles) {
  // ── Step 1: Locate ──────────────────────────────────────────────────────────
  const locate = await safely(
    () => locateBug(bugReport, codeFiles),
    { file: 'unknown', line: -1, lineText: '', patternLabel: null, reasoning: 'Locate failed.' }
  );

  if (locate.line === -1) {
    return { locate, fix: { error: 'Skipped — bug not located.' }, test: {}, blast: {}, verify: {}, confidence: {}, incident: {} };
  }

  // Check bug memory for known patterns
  const memoryMatch = locate.patternLabel
    ? findMatchingPattern(locate.patternLabel)
    : null;

  // ── Step 2: Fix + Test generation + Blast radius (all independent) ─────────
  const [fix, testSource, blast] = await Promise.all([
    safely(() => generateFix(locate), { error: 'Fix generation failed.' }),
    safely(() => generateTest(locate), ''),
    safely(
      () => {
        // Extract function name from the file for blast radius scan
        const fnMatch = locate.lineText.match(/function\s+(\w+)|(\w+)\s*\(/);
        // Try to extract from reasoning: "function(s): foo(), bar()"
        const reasoningMatch = locate.reasoning.match(/function\(s\):\s*([\w(),\s]+)\./);
        let fnName = 'unknown';
        if (reasoningMatch) {
          fnName = reasoningMatch[1].trim().split(/[,\s()]+/).find(t => t.length > 0) || 'unknown';
        } else if (fnMatch) {
          fnName = fnMatch[1] || fnMatch[2] || 'unknown';
        }
        return analyseBlastRadius(fnName);
      },
      { fnName: 'unknown', callSites: [], summary: 'Blast radius analysis failed.' }
    ),
  ]);

  // Back up the file before any write (rollback safety net).
  // backupFile returns the backup path string on success; on error safely()
  // returns null (primitive fallback), so backupPath stays null on failure.
  let backupPath = null;
  if (fix.patchedSource && !fix.error) {
    backupPath = await safely(() => backupFile(path.resolve(locate.file)), null);
    // Ensure we never surface an error object as the backupPath
    if (typeof backupPath !== 'string') backupPath = null;
  }

  // ── Step 3: Verify fix + Confidence score (both need fix+test) ────────────
  const [verify, confidence] = await Promise.all([
    safely(
      () => verifyFix(fix, testSource),
      { passed: false, testOutput: '', timeSavedEstimate: 'N/A', error: 'Verify failed.' }
    ),
    safely(
      () => calculateConfidence({
        patternFound:    !!locate.patternLabel,
        patternInMemory: !!memoryMatch,
        testsPassed:     false, // will be overridden after verify; use optimistic for confidence calc
        callSiteCount:   (blast.callSites || []).length,
      }),
      { score: 0, label: 'Unknown', breakdown: {} }
    ),
  ]);

  // Recalculate confidence with actual test result
  const finalConfidence = await safely(
    () => calculateConfidence({
      patternFound:    !!locate.patternLabel,
      patternInMemory: !!memoryMatch,
      testsPassed:     verify.passed,
      callSiteCount:   (blast.callSites || []).length,
    }),
    confidence
  );

  // ── Step 4: Incident report + Memory update (need all previous) ────────────
  const [incident] = await Promise.all([
    safely(
      () => generateIncidentReport({
        locate,
        fix,
        blast: blast || { callSites: [], summary: '' },
        verify,
        confidence: finalConfidence,
        bugReport,
      }),
      { markdown: '', error: 'Incident report generation failed.' }
    ),
    // Update bug memory only on success
    safely(
      () => {
        if (verify.passed && locate.patternLabel && fix.description) {
          recordFix(locate.patternLabel, fix.description);
        }
      },
      null
    ),
  ]);

  return {
    locate,
    fix: {
      file:        fix.file,
      buggyLine:   fix.buggyLine,
      fixedLine:   fix.fixedLine,
      description: fix.description,
      error:       fix.error,
    },
    test:       { source: testSource },
    blast,
    verify:     { passed: verify.passed, testOutput: verify.testOutput, timeSavedEstimate: verify.timeSavedEstimate },
    confidence: finalConfidence,
    incident:   { markdown: incident.markdown, filePath: incident.filePath },
    memoryMatch,
    backupPath,
  };
}

/**
 * Main entry point: runs the pipeline for ALL bug reports concurrently.
 *
 * @returns {Promise<{
 *   results: object[],
 *   wallClockMs: number,
 *   estimatedSequentialMs: number,
 *   parallelismSummary: string
 * }>}
 */
async function runPipeline() {
  const codeFiles  = readCodeFiles();
  const bugReports = readBugReports();

  if (bugReports.length === 0) {
    throw new Error('No bugreport*.md files found in sample-app/.');
  }

  const startTime = Date.now();

  // All bugs run concurrently
  const results = await Promise.all(
    bugReports.map(({ reportFile, content }) =>
      runSingleBugPipeline(content, codeFiles).then(result => ({
        reportFile,
        ...result,
      }))
    )
  );

  const wallClockMs = Date.now() - startTime;
  const estimatedSequentialMs = wallClockMs * bugReports.length; // rough estimate

  const parallelismSummary =
    `Processed ${bugReports.length} bug${bugReports.length === 1 ? '' : 's'} concurrently ` +
    `in ${wallClockMs}ms (estimated sequential: ~${estimatedSequentialMs}ms).`;

  return { results, wallClockMs, estimatedSequentialMs, parallelismSummary };
}

module.exports = { runPipeline };
