'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./utils/config');
const { runPipeline } = require('./utils/pipelineOrchestrator');
const { restoreBackup } = require('./utils/rollback');
const { getAllPatterns } = require('./utils/bugMemory');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(config.paths.publicDir));

// ---------------------------------------------------------------------------
// POST /api/pipeline  — run the full multi-bug pipeline
// ---------------------------------------------------------------------------
app.post('/api/pipeline', async (req, res) => {
  try {
    const result = await runPipeline();
    res.json(result);
  } catch (err) {
    console.error('Pipeline error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/rollback  — restore the original file from the most recent backup
// ---------------------------------------------------------------------------
app.post('/api/rollback', (req, res) => {
  // Validate body exists (express.json() skips bodies with wrong Content-Type)
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body must be JSON.' });
  }

  const { file } = req.body;
  if (!file || typeof file !== 'string' || file.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid "file" field in request body.' });
  }

  // Path traversal guard: resolve the path and ensure it stays inside sample-app/
  const absPath = path.resolve(file);
  const allowedDir = config.paths.sampleApp;
  if (!absPath.startsWith(allowedDir + path.sep) && absPath !== allowedDir) {
    return res.status(403).json({ error: 'File path is outside the allowed directory.' });
  }

  const result = restoreBackup(absPath);
  if (!result.restored) {
    return res.status(404).json({ restored: false, message: result.message });
  }
  res.json(result);
});

// ---------------------------------------------------------------------------
// GET /api/memory  — return all learned bug patterns
// ---------------------------------------------------------------------------
app.get('/api/memory', (req, res) => {
  try {
    const patterns = getAllPatterns();
    res.json({ patterns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
app.listen(config.port, () => {
  console.log(`FixForge running at http://localhost:${config.port}`);
});

module.exports = app;
