'use strict';

const path = require('path');

/**
 * config.js — single source of truth for all FixForge constants.
 * Import this wherever a path, port, or threshold is needed.
 */
const config = {
  port: 3000,

  paths: {
    sampleApp:       path.resolve('sample-app'),
    publicDir:       path.resolve('public'),
    incidentReports: path.resolve('incident-reports'),
    backups:         path.resolve('.fixforge-backups'),
    bugMemory:       path.resolve('bug-memory.json'),
  },

  jest: {
    bin: process.platform === 'win32'
      ? path.resolve('node_modules', '.bin', 'jest.cmd')
      : path.resolve('node_modules', '.bin', 'jest'),
    timeout: 30000,
    useShell: process.platform === 'win32',
  },

  confidence: {
    // Weights for the confidence score (must sum to 1.0)
    patternMatchWeight: 0.50,
    testPassWeight:     0.35,
    blastRadiusWeight:  0.15,
    // Blast radius: 0 affected files → full score; 5+ → 0 score for that component
    blastRadiusPenaltyPerSite: 0.05,
  },

  timeSaved: {
    // Rough industry estimate per resolved bug (minutes)
    minutesPerBug: 45,
  },
};

module.exports = config;
