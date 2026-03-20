# Skilluminator — Find Your Automatable Work Patterns

Skilluminator analyzes your Microsoft 365 activity (emails, meetings, Teams,
documents) and identifies which of your repetitive work patterns are the best
candidates for AI automation. It scores each pattern and shows you where you
can get the most time back.

## Prerequisites

- **Node.js 18+** (for the dashboard generator)
- **WorkIQ MCP** (optional) — connects to M365 Copilot for automatic data
  harvesting. If unavailable, use the self-report interview mode instead.

## Option A: Generate a Dashboard from Existing Data

If you already have a `patterns.json` file (or someone shared theirs as a
template):

```bash
node scripts/generate-dashboard.js --input my-patterns.json
```

Open `output/dashboard.html` in your browser to see the results.

## Option B: Run the Skill Detector with Copilot CLI

1. Open `scripts/copilot-skill-detector.md` in this repo.
2. Copy the full prompt into GitHub Copilot Chat, or paste it into any AI
   assistant (Claude, ChatGPT, Copilot CLI via `gh copilot`).
3. The AI will walk you through either:
   - **WorkIQ mode** — automatic M365 data harvesting (if connected), or
   - **Self-report mode** — a 10-question interview about your work habits
4. At the end you get a `patterns.json` file. Save it and run:

```bash
node scripts/generate-dashboard.js --input patterns.json
```

5. Open `output/dashboard.html` to see your personal skill dashboard.

## What You Get

- A ranked list of your work patterns scored on **automation feasibility**
  and **business value**
- Estimated hours per week you could save for each pattern
- Concrete next steps: which patterns to automate first and how

The prompt file (`scripts/copilot-skill-detector.md`) is fully self-contained.
No setup beyond Node.js is required. Works for any role.
