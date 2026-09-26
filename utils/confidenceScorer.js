'use strict';

const config = require('./config');

/**
 * confidenceScorer.js
 *
 * Calculates a 0–100% confidence score for a fix based on:
 *   - Pattern match strength (was the pattern in memory? was it a strong regex match?)
 *   - Number of tests passed vs expected
 *   - Blast radius size (more call sites = more risk = lower confidence)
 */

/**
 * @param {object} params
 * @param {boolean} params.patternFound       Was the bug matched by a known regex pattern?
 * @param {boolean} params.patternInMemory    Was the pattern previously seen in bug memory?
 * @param {boolean} params.testsPassed        Did all generated tests pass?
 * @param {number}  params.callSiteCount      Number of call sites in blast radius
 * @returns {{ score: number, label: string, breakdown: object }}
 */
function calculateConfidence({ patternFound, patternInMemory, testsPassed, callSiteCount }) {
  const w = config.confidence;

  // Pattern match component: 1.0 if found + in memory, 0.8 if found only, 0 if not found
  const patternScore = patternFound
    ? (patternInMemory ? 1.0 : 0.8)
    : 0.0;

  // Tests component: 1.0 if passed, 0.0 if not
  const testScore = testsPassed ? 1.0 : 0.0;

  // Blast radius component: starts at 1.0, drops 0.05 per call site beyond the definition itself
  // (the buggy function's own definition is expected to appear once)
  const extraSites = Math.max(0, callSiteCount - 1);
  const blastScore = Math.max(0, 1.0 - extraSites * w.blastRadiusPenaltyPerSite);

  const raw =
    patternScore * w.patternMatchWeight +
    testScore    * w.testPassWeight +
    blastScore   * w.blastRadiusWeight;

  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));

  const label =
    score >= 90 ? 'High' :
    score >= 65 ? 'Medium' :
    'Low';

  return {
    score,
    label,
    breakdown: {
      patternScore: Math.round(patternScore * 100),
      testScore: Math.round(testScore * 100),
      blastScore: Math.round(blastScore * 100),
    },
  };
}

module.exports = { calculateConfidence };
