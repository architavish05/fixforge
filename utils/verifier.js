'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const config = require('./config');

/**
 * verifier.js
 *
 * Writes the patched source and generated test to disk, runs Jest for that
 * test file, then restores the original so the pipeline stays repeatable.
 *
 * Supports any target file (not just calc.js) via the fix.file field.
 */

/**
 * Runs Jest for a single test file and returns output + exit code.
 *
 * @param {string} testFilePath  Absolute path of the .test.js file to run
 * @returns {{ stdout: string, exitCode: number }}
 */
function runJest(testFilePath) {
  // Normalise to forward-slash pattern for Jest's --testPathPattern
  const pattern = testFilePath.replace(/\\/g, '/');

  const result = spawnSync(
    config.jest.bin,
    ['--testPathPattern', pattern, '--no-coverage', '--colors=false'],
    {
      cwd: path.resolve('.'),
      encoding: 'utf8',
      timeout: config.jest.timeout,
      shell: config.jest.useShell,
    }
  );

  if (result.error) {
    return { stdout: `Jest spawn error: ${result.error.message}`, exitCode: 1 };
  }

  const stdout = (result.stdout || '') + (result.stderr ? '\n' + result.stderr : '');
  const exitCode = result.status !== null ? result.status : 1;
  return { stdout, exitCode };
}

/**
 * Writes the fix and test to disk, runs Jest, and restores the original.
 *
 * @param {{ file: string, patchedSource: string }} fix
 * @param {string} testSource  Jest test file contents
 * @returns {{
 *   passed: boolean,
 *   testOutput: string,
 *   timeSavedEstimate: string,
 *   testFile: string,
 *   patchedFile: string
 * }}
 */
function verifyFix(fix, testSource) {
  if (!fix || !fix.file) {
    throw new Error('verifyFix: fix object is missing or has no file property');
  }
  if (typeof testSource !== 'string' || testSource.trim() === '') {
    throw new Error('verifyFix: testSource must be a non-empty string');
  }

  const sourceFilePath = path.resolve(fix.file);
  const baseName = path.basename(sourceFilePath, '.js');
  const sourceDir  = path.dirname(sourceFilePath);
  const testFilePath = path.join(sourceDir, `${baseName}.test.js`);
  const backupPath   = sourceFilePath + '.bak';

  // Back up original — if this throws (file not found, permissions), let it propagate
  // so the caller's safely() wrapper captures it cleanly.
  fs.copyFileSync(sourceFilePath, backupPath);
  let backupCreated = true;

  let passed = false;
  let testOutput = '';

  try {
    if (fix.patchedSource) {
      fs.writeFileSync(sourceFilePath, fix.patchedSource, 'utf8');
    }
    fs.writeFileSync(testFilePath, testSource, 'utf8');

    const result = runJest(testFilePath);
    testOutput = result.stdout;
    passed = result.exitCode === 0;
  } finally {
    // Only restore source if the backup was actually created, to avoid masking
    // the original error with a secondary ENOENT on the missing backup.
    if (backupCreated && fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, sourceFilePath);
      fs.unlinkSync(backupPath);
    }
    // Always remove the generated test file — it tests buggy code and must not
    // persist on disk where `npm test` would pick it up and fail.
    try { fs.unlinkSync(testFilePath); } catch { /* ignore if already gone */ }
  }

  const minutesPerBug = config.timeSaved.minutesPerBug;
  const timeSavedEstimate = passed
    ? `~${minutesPerBug} minutes of manual debugging avoided`
    : 'N/A – fix did not pass tests';

  return {
    passed,
    testOutput,
    timeSavedEstimate,
    testFile: testFilePath,
    patchedFile: sourceFilePath,
  };
}

module.exports = { verifyFix };
