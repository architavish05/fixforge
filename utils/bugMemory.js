'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * bugMemory.js
 *
 * Persists learned bug patterns to bug-memory.json so future pipeline runs
 * can match known fixes faster and boost confidence scores.
 *
 * Schema: Array<{ bugType: string, fixPattern: string, timesFixed: number, lastSeen: string }>
 */

/** @returns {Array} */
function loadMemory() {
  try {
    if (!fs.existsSync(config.paths.bugMemory)) return [];
    return JSON.parse(fs.readFileSync(config.paths.bugMemory, 'utf8'));
  } catch {
    return [];
  }
}

/** @param {Array} memory */
function saveMemory(memory) {
  fs.writeFileSync(config.paths.bugMemory, JSON.stringify(memory, null, 2), 'utf8');
}

/**
 * Returns all stored patterns.
 * @returns {Array<{ bugType: string, fixPattern: string, timesFixed: number, lastSeen: string }>}
 */
function getAllPatterns() {
  return loadMemory();
}

/**
 * Looks up whether a detected pattern already exists in memory.
 * Returns the matching entry or null.
 *
 * @param {string} detectedPattern  Pattern label from bugLocator
 * @returns {{ bugType: string, fixPattern: string, timesFixed: number, lastSeen: string } | null}
 */
function findMatchingPattern(detectedPattern) {
  const memory = loadMemory();
  return memory.find(entry => entry.bugType === detectedPattern) || null;
}

/**
 * Records a successfully fixed bug pattern.
 * Increments timesFixed if the pattern already exists; appends otherwise.
 *
 * @param {string} bugType      Pattern label from bugLocator (e.g. 'off-by-one denominator: ...')
 * @param {string} fixPattern   Short description of the applied fix
 */
function recordFix(bugType, fixPattern) {
  const memory = loadMemory();
  const existing = memory.find(e => e.bugType === bugType);
  if (existing) {
    existing.timesFixed += 1;
    existing.lastSeen = new Date().toISOString();
  } else {
    memory.push({
      bugType,
      fixPattern,
      timesFixed: 1,
      lastSeen: new Date().toISOString(),
    });
  }
  saveMemory(memory);
}

module.exports = { getAllPatterns, findMatchingPattern, recordFix };
