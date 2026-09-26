# FixForge — Autonomous Multi-Bug Debugging Pipeline

Built for the IBM Bob 2.0 Hackathon | Theme: *Build with purpose using IBM Bob 2.0*

## Problem

Developers spend significant time manually debugging issues — locating root causes, writing fixes, verifying they work, and checking for side effects. This process is slow, error-prone, and rarely documented well for the team.

## Solution

FixForge is an automated debugging pipeline built entirely inside **IBM Bob IDE**. Given one or more bug reports, it concurrently:

1. **Locates** the root cause in the codebase
2. **Generates a fix**
3. **Writes and runs a regression test** to prove the fix works
4. **Analyzes blast radius** — checks every other place the buggy function is used, to catch side effects before they ship
5. **Scores confidence** in the fix based on pattern strength, test results, and blast radius size
6. **Generates an incident report** (copyable markdown) summarizing the whole fix for team documentation
7. **Remembers bug patterns** across sessions, so recurring bug types get fixed faster and more confidently over time
8. **Supports rollback** — every fix is backed up before being applied, and can be reverted with one click

## How IBM Bob Was Used

- **Agent Mode**: Used throughout to autonomously plan, write, and structure the entire codebase from natural-language prompts
- **Parallel Tasks / Subagent-style processing**: Multiple bug reports are processed concurrently via `Promise.all`, with each bug's locate → fix → test → verify → blast-radius steps also running independent async steps in parallel — cutting total processing time roughly in half versus sequential handling
- **Document Understanding**: Users can upload a raw bug report (`.md`/`.txt`) and Bob-generated logic parses and acts on its contents directly
- **`/init`**: Used once at project start to generate `AGENTS.md`, giving Bob persistent project context across all following prompts without re-explaining the codebase each time

## Tech Stack

- Node.js + Express (backend)
- Jest (automated regression testing)
- Vanilla HTML/CSS/JS (frontend dashboard, no external UI frameworks)
- Local JSON file storage (bug pattern memory)

## How to Run

```bash
git clone https://github.com/architavish05/fixforge.git
cd fixforge
npm install
npm start
```

Then open `http://localhost:3000` in your browser and click **Run Pipeline**.

## Impact

In testing, FixForge reduced an estimated **45 minutes of manual debugging per bug** down to a live pipeline run of a few seconds — while also producing documentation (incident reports) and safety nets (rollback, blast radius checks) that manual debugging typically skips entirely.

## Bob Task Session Summaries

See `/bob_sessions` for screenshots of Bob IDE task session summaries used throughout development, as required by the hackathon submission guidelines.

## Team

Archita Vishwakarma
and
Aditya Tripathi