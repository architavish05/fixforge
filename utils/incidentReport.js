'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * incidentReport.js
 *
 * Generates a structured markdown incident report for a resolved bug and
 * writes it to incident-reports/{filename}_{timestamp}.md.
 */

/**
 * Builds the markdown string for an incident report.
 *
 * @param {object} p
 * @param {object} p.locate      Result from bugLocator
 * @param {object} p.fix         Result from fixGenerator
 * @param {object} p.blast       Result from blastRadius
 * @param {object} p.verify      Result from verifier
 * @param {object} p.confidence  Result from confidenceScorer
 * @param {string} p.bugReport   Original bug report text
 * @returns {string}
 */
function buildMarkdown({ locate, fix, blast, verify, confidence, bugReport }) {
  const now = new Date().toISOString();
  const timeSaved = verify.timeSavedEstimate || 'N/A';

  // Guard against missing callSites when blast is a partial error result
  const blastSummary = (blast && blast.summary) || 'Blast radius analysis unavailable.';
  const blastCallSites = (blast && Array.isArray(blast.callSites)) ? blast.callSites : [];

  return `# Incident Report — ${path.basename(locate.file)}

**Generated:** ${now}
**Confidence:** ${confidence.score}% (${confidence.label})

---

## Symptom (from bug report)

${bugReport.split('\n').slice(0, 10).join('\n')}

---

## Root Cause

- **File:** \`${locate.file}\`
- **Line:** ${locate.line}
- **Buggy code:** \`${locate.lineText}\`
- **Analysis:** ${locate.reasoning}

---

## Fix Applied

- **Before:** \`${(fix.buggyLine || '').trim()}\`
- **After:**  \`${(fix.fixedLine || '').trim()}\`
- **Description:** ${fix.description || 'N/A'}

---

## Test Result

**Status:** ${verify.passed ? '✅ PASSED' : '❌ FAILED'}

\`\`\`
${(verify.testOutput || '').trim()}
\`\`\`

---

## Blast Radius

${blastSummary}

${blastCallSites.length > 0
  ? blastCallSites.map(cs => `- \`${cs.file}:${cs.line}\` — \`${cs.lineText}\``).join('\n')
  : '_No additional call sites._'}

---

## Confidence Breakdown

| Component | Score |
|---|---|
| Pattern match | ${confidence.breakdown.patternScore}% |
| Tests passed  | ${confidence.breakdown.testScore}% |
| Blast radius  | ${confidence.breakdown.blastScore}% |
| **Overall**   | **${confidence.score}%** |

---

## Time Saved

**${timeSaved}**

---

*Report generated automatically by FixForge*
`;
}

/**
 * Generates and writes an incident report to disk.
 *
 * @param {object} params  Same shape as buildMarkdown params
 * @returns {{ markdown: string, filePath: string }}
 */
function generateIncidentReport(params) {
  const markdown = buildMarkdown(params);

  // Ensure output directory exists
  if (!fs.existsSync(config.paths.incidentReports)) {
    fs.mkdirSync(config.paths.incidentReports, { recursive: true });
  }

  const baseName = path.basename(params.locate.file, '.js');
  const timestamp = Date.now();
  const fileName = `${baseName}_${timestamp}.md`;
  const filePath = path.join(config.paths.incidentReports, fileName);

  fs.writeFileSync(filePath, markdown, 'utf8');

  return { markdown, filePath };
}

module.exports = { generateIncidentReport };
