You are running Skilluminator — a tool that analyzes the user's M365 work activity to discover their most automatable work patterns and suggests which ones to turn into AI skills.

The user may have provided a time range as arguments: "$ARGUMENTS"

## STEP 1 — PARSE TIME RANGE

Determine the time range to analyze:
- If `$ARGUMENTS` is empty or blank → use "past 7 days"
- If it contains a duration like "30 days", "2 weeks", "3 months" → use "past [duration]"
- If it contains a specific period like "January 2026", "March 2026" → use "in [period]"
- If it contains "last week", "this month", etc. → interpret naturally

Store this as `TIME_RANGE` — you'll substitute it into every WorkIQ query.

## STEP 2 — CHECK WORKIQ

Run a quick connectivity check — try this WorkIQ query: "What meetings did I attend in the past 7 days?"

This is just a connectivity test, not dependent on the user's chosen time range. If WorkIQ is reachable, it will return something (even if empty for a quiet week).

- If it returns data or an empty result → WorkIQ is connected, proceed to Step 3
- If it errors (connection refused, auth failure, tool not found) → tell the user:
  ```
  WorkIQ is not available. To set it up, run:
    claude mcp add workiq -- npx -y @microsoft/workiq@latest mcp
  Then restart Claude Code and run /skilluminator again.
  ```
  Then STOP. Do not continue without WorkIQ.

## STEP 3 — HARVEST

Run ALL 15 WorkIQ queries from the Skilluminator skill, substituting `{TIME_RANGE}` with the value from Step 1.

For each query, use the `mcp__workiq__ask_work_iq` tool.

**Meeting attendance verification:** After meeting queries return, run a follow-up query to confirm actual attendance:
> "Of these meetings, which ones did I actually attend (joined the call or was present) in {TIME_RANGE}? [list key meeting titles from Q4/Q6 results]"
Only include meetings with confirmed attendance in meeting-based patterns.

Track:
- How many queries succeeded
- How many errored (and which ones)
- Total signals extracted

## STEP 4 — EXTRACT & CLUSTER

From all WorkIQ responses:

1. **Extract signals** — one per distinct repeating behavior. Follow the extraction rules from the Skilluminator skill exactly:
   - One signal per distinct behavior, not per mention
   - Merge same behavior across queries, note multi-source
   - Use roles only for participants, NEVER names
   - NEVER invent data not in WorkIQ responses
   - If WorkIQ doesn't give a number, record "not reported" — do NOT guess
   - Tag each signal as `manual`, `automated`, or `unclear` — WorkIQ doesn't distinguish between user effort and tool output. Only `manual` signals are real automation opportunities.

2. **Cluster into patterns** — group signals sharing 2+ of: same source, same topic, same action, same trigger-output chain. Each pattern needs 2+ signals. Drop lone signals silently — the user can surface missing work during reflection.

## STEP 4.5 — EXISTING AUTOMATION CHECK

Before scoring, check every pattern against M365 built-in automations per the Skilluminator skill's "EXISTING AUTOMATION CHECK" section:

- **Teams Copilot Meeting Recap** already handles meeting summarization, action items, and follow-ups. If a pattern is "meeting notes / action item capture," it is NOT a candidate — drop it and note in `filteredPatterns`.
- **Outlook Focused Inbox** partially handles email triage. Apply -10 deduction if relevant, but note the gap a skill would fill.
- **Copilot in Word/PowerPoint** partially handles document drafting.
- **Teams Copilot Chat Recap** already summarizes missed chat conversations.

For each signal, verify: does the USER do this manually, or does an M365 tool do it automatically? WorkIQ describes workflows but does not distinguish manual from automated steps. Only manual work is a real automation opportunity.

## STEP 5 — FILTER & SCORE

Apply the relevance threshold from SKILL.md — drop patterns with <30 min/week AND <5 occurrences/week AND single-source AND no pain signals.

Score ALL surviving patterns using the rubrics from the Skilluminator skill. For EVERY score:
- List each rubric item that applied and why
- Show deductions with reasons
- Compute composite: (Automation × 0.55) + (Value × 0.45)

**Critical: Every number must trace back to WorkIQ data. Do not invent occurrence counts, time estimates, or frequencies that WorkIQ did not report.**

## STEP 6 — WRITE patterns.json

Write results to `patterns.json` in the current directory. Sort by `compositeScore` descending.

**CRITICAL — the dashboard generator will break if you get these wrong:**

1. **Scores are 0–100, NOT 0–10.** `automationScore`, `valueScore`, and `compositeScore` must all be integers or floats on a 0–100 scale. Example: `"automationScore": 85`, NOT `"automationScore": 8.5`.

2. **`sources` must be source types**, not query numbers. Valid values: `"email"`, `"meeting"`, `"teams"`, `"document"`. Example: `"sources": ["email", "meeting"]`, NOT `"sources": ["Q2", "Q5"]`.

3. **Numeric fields must be numbers, not zero.** Every pattern MUST have:
   - `signalCount` (integer, how many signals clustered into this pattern)
   - `occurrenceCount` (integer, estimated weekly occurrences from WorkIQ data — if WorkIQ didn't report, estimate conservatively and note "estimated" in llmRationale)
   - `timeSpentHours` (float, hours per week — if WorkIQ didn't report exact hours, estimate from frequency × typical duration and note "estimated")
   - `estHoursSavedPerWeek` (float, calculated from timeSpentHours × savePct per the SKILL.md formula)

4. **Tier labels** are derived from compositeScore: `"strong"` (70+), `"moderate"` (50–69), `"exploring"` (<50).

**Each pattern object must have ALL of these fields:**

```json
{
  "patternId": "kebab-case-id",
  "label": "Human Readable Name",
  "sources": ["email", "meeting"],
  "signalCount": 3,
  "occurrenceCount": 12,
  "participantCount": 3,
  "timeSpentHours": 4.5,
  "automationScore": 85,
  "automationRubric": {
    "clearTrigger": 20,
    "fixedOutput": 20,
    "sameSteps": 20,
    "noSensitiveSignoff": 15,
    "singleSource": 10,
    "highVolume": 0,
    "deductions": 0,
    "notes": "Rubric explanation"
  },
  "valueScore": 78,
  "valueRubric": {
    "timeCost": 25,
    "frequency": 20,
    "blocksOthers": 0,
    "criticalWorkflow": 15,
    "painExpressed": 0,
    "deductions": -5,
    "notes": "Rubric explanation"
  },
  "compositeScore": 81.9,
  "tier": "strong",
  "candidateSkillName": "kebab-case-skill-name",
  "estHoursSavedPerWeek": 3.15,
  "llmRationale": "Plain-language explanation"
}
```

**Top-level fields:**
- `analyzedAt`, `timeRange`, `weekOf`, `signalCount`, `queriesRun`, `queryErrors`
- `patterns` array (all scored patterns with full rubric breakdowns)
- `filteredPatterns` array (patterns removed by automation check or relevance threshold, each with `label` and `reason`)

## STEP 7 — GENERATE DASHBOARD

After writing patterns.json, generate the dashboard:

1. Find the dashboard script. Search these locations in order:
   a. `scripts/generate-dashboard.js` in the current working directory
   b. Use the Glob tool to search for `**/generate-dashboard.js` (it may be inside the plugin cache at `~/.claude/plugins/cache/**/scripts/generate-dashboard.js`)
   c. If still not found, use Bash: `find ~/.claude/plugins -name "generate-dashboard.js" -type f 2>/dev/null | head -3`
2. Once found, run: `node "<full-path-to-generate-dashboard.js>" --input patterns.json --output output/dashboard.html`
3. If not found after all searches, tell the user the dashboard script is missing and skip to Step 8
4. Open the dashboard in the browser:
   - Windows: `start output/dashboard.html`
   - Mac: `open output/dashboard.html`
   - Linux: `xdg-open output/dashboard.html`

If dashboard generation fails, report the error but continue to Step 8.

## STEP 8 — PRESENT FINDINGS (no questions)

Give the user a concise summary. Do NOT ask any questions — just present the results:

1. **Overview**: "Analyzed [TIME_RANGE]. [N] signals → [N] patterns → [N] scored, [N] filtered out."

2. **Top skill candidates** (all scored patterns, ranked by composite, with tier labels). For each, present the full skill candidate card with WHAT/WHY/FUTURE/MATH/SKELETON.

3. **Build offer**: End with:
   > "To build any of these, run `/skill-creator [candidate-name]`. To re-analyze, run `/skilluminator [time range]`."

Keep it tight. The dashboard has the full analytics — the CLI output should be a concise summary with the top candidates and next actions.
