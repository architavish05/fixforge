# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

- **Runtime:** Node.js (CommonJS, `'use strict'`)
- **Server:** Express 4 on port 3000 (configured in `utils/config.js`)
- **Test runner:** Jest 29

## Commands

| Purpose | Command |
|---|---|
| Install deps | `npm install` |
| Start server | `npm start` |
| Run all tests | `npm test` |
| Run single test file | `npx jest --testPathPattern="sample-app/calc.test.js" --no-coverage` |

## Architecture

```
POST /api/pipeline  →  utils/pipelineOrchestrator.js
  ├─ readCodeFiles() + readBugReports()   (all bugreport*.md in sample-app/)
  ├─ For each bug, concurrently:
  │   1. locateBug()                      utils/bugLocator.js
  │   2. Promise.all([
  │       generateFix()                   utils/fixGenerator.js
  │       generateTest()                  utils/testGenerator.js
  │       analyseBlastRadius()            utils/blastRadius.js  ])
  │   3. Promise.all([
  │       verifyFix()                     utils/verifier.js
  │       calculateConfidence()           utils/confidenceScorer.js  ])
  │   4. generateIncidentReport()         utils/incidentReport.js
  │      recordFix()                      utils/bugMemory.js
  └─ Returns { results[], wallClockMs, parallelismSummary }

POST /api/rollback  →  utils/rollback.js  restoreBackup()
GET  /api/memory    →  utils/bugMemory.js getAllPatterns()
```

- **Constants:** All ports, paths, timeouts, and confidence weights are in `utils/config.js`
- **Sample bugs:** `sample-app/calc.js` (off-by-one in `average()`) + `sample-app/stringUtils.js` (`>=` vs `>` in `truncate()`)
- **Tests:** `testGenerator.js` dispatches by source file basename; add a new template function for each new module
- **Verifier:** Writes patched file + test, runs Jest via `spawnSync`, then **restores the original** — pipeline is repeatable
- **Bug memory:** `bug-memory.json` at workspace root, written after each successful fix

## Critical Gotchas

- On Windows, Jest `.cmd` requires `shell: true` in `spawnSync` — handled in `utils/verifier.js` via `config.jest.useShell`
- `verifier.js` supports any target file (not just calc.js) — the test file is co-located next to the source (e.g. `sample-app/calc.test.js`)
- `locateBug()` scores candidates **globally across all files** and picks the highest scorer — not just the first file with a hit
- `bugLocator.js` returns a `patternLabel` field; downstream modules (`confidenceScorer`, `bugMemory`) key off this
- `pipelineOrchestrator.js` uses `safely()` to wrap every step — failures produce `{ error }` partial results instead of crashing
- Rollback backups are stored in `.fixforge-backups/`; incident reports in `incident-reports/` — both auto-created
- `jest` is in `devDependencies` — `npm install` (not `--production`) required before pipeline runs

## Features Added (v2)

1. **Parallel multi-bug processing** — all `bugreport*.md` files in `sample-app/` run concurrently via `Promise.all`
2. **Blast radius analysis** — `utils/blastRadius.js` scans for call sites of the buggy function
3. **Incident reports** — markdown reports written to `incident-reports/` with "Copy" button in UI
4. **Confidence scoring** — 0–100% badge per fix, weighted by pattern match + test pass + blast radius
5. **Rollback safety net** — `backupFile()` runs before any patch; `POST /api/rollback` restores from `.fixforge-backups/`
6. **Bug pattern memory** — `bug-memory.json` learns fix patterns; matched patterns get a memory-boost notice in the UI
