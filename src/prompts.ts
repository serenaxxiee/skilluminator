// ── Prompt builders: the intelligence layer of Skilluminator ────────

import {
  readSignals, readPatterns, readSkillDetector,
  SIGNALS_PATH, PATTERNS_PATH, SKILL_PATH, DASHBOARD_PATH,
} from "./state.js";
import { HARVEST_QUERIES, WORKIQ_TOOL } from "./workiq.js";

// ── System prompt (shared across all phases) ────────────────────────

export function buildSystemPrompt(): string {
  return `You are Skilluminator — an autonomous agent building TWO world-class deliverables:

## 1. skill-detector (SKILL.md) — The World's Best Work Pattern Skill

A portable Claude skill that ANY employee at the company can run on their own WorkIQ M365 data. When a colleague activates it, it should:
- Analyze their email, meetings, Teams chats, and documents
- Discover their personal repeated work patterns (not org-wide — individual)
- Score each pattern on automation feasibility and business value
- Identify which patterns are highest-value candidates for reusable Claude AI skills
- Deliver clear, actionable recommendations they can act on immediately

It must work for PMs, engineers, designers, managers, execs — anyone with M365 activity. Your job is to make this skill so good that when a colleague runs it, they say "wow, this is exactly what I needed."

## 2. dashboard.html — The World's Best Insights Dashboard

A beautiful, data-rich, self-contained HTML dashboard that shows the user deep insights into their work patterns. This is the visual face of Skilluminator — the thing people see and share. It should be informative, polished, and make complex data feel intuitive.

## Your job each cycle

Use real WorkIQ signals as training data to make BOTH deliverables better. Every cycle should produce a noticeable improvement to at least one of them. Do not just list skill candidates — improve the skill-detector itself and the dashboard itself.

Rules:
- Always produce valid JSON when writing state files
- Scores are integers 0-100
- Dashboard HTML must be fully self-contained (inline CSS + JS, NO external CDN)
- Never invent data — only report what WorkIQ actually returns
- Anonymize participants (use roles like "PM", "Engineering Lead", not names)
- Use the Edit tool for targeted changes — do NOT rewrite entire files from scratch`;
}

// ── Phase 1: Harvest ────────────────────────────────────────────────

export function buildHarvestPrompt(cycleNum: number): string {
  const weekOf = getWeekLabel();

  return `## HARVEST PHASE — Cycle ${cycleNum}

Your job: Extract M365 work pattern signals from WorkIQ for the week of ${weekOf}.

### Step 1: Run WorkIQ queries
Execute the ${WORKIQ_TOOL} tool for EACH of these queries:

${HARVEST_QUERIES.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

### Step 2: Write signals to disk
Write the results as structured JSON to: ${SIGNALS_PATH}

Schema:
\`\`\`json
{
  "cycleNum": ${cycleNum},
  "harvestedAt": "<ISO timestamp>",
  "weekOf": "${weekOf}",
  "workiqQueriesRun": ["<query>", ...],
  "signals": [
    {
      "source": "email|meeting|teams|document",
      "title": "<descriptive pattern name>",
      "participants": ["<role, not name>"],
      "frequency": <times per week>,
      "timeSpentMinutes": <estimate>,
      "keywords": ["<keyword>", ...],
      "rawExcerpt": "<quote from WorkIQ>",
      "capturedAt": "<ISO timestamp>"
    }
  ]
}
\`\`\`

Aim for 15-30 signals. Then output a one-paragraph summary.`;
}

// ── Phase 2: Refine Skill-Detector & Dashboard ──────────────────────

export type RefineFocus = "skill" | "dashboard" | "both";

export function buildRefinePrompt(cycleNum: number, steeringInput?: string, focus: RefineFocus = "both"): string {
  const signals = readSignals();
  const prevPatterns = readPatterns();
  const currentSkill = readSkillDetector();

  const signalCount = signals?.signals?.length ?? 0;

  // Build a compact pattern summary instead of embedding full JSON
  let patternSummary = "No patterns yet — this is the first cycle.";
  if (prevPatterns && Array.isArray(prevPatterns.patterns)) {
    const patterns = prevPatterns.patterns;
    const top5 = [...patterns]
      .filter((p: any) => typeof p.automationScore === "number" && typeof p.valueScore === "number")
      .sort((a: any, b: any) => ((b.automationScore + b.valueScore) / 2) - ((a.automationScore + a.valueScore) / 2))
      .slice(0, 5);
    patternSummary = `${patterns.length} patterns tracked. Top 5: ${top5.map((p: any) => `${p.label} (auto=${p.automationScore}, val=${p.valueScore}, trend=${p.trend})`).join("; ")}`;
  }

  const steeringBlock = steeringInput
    ? `\n---\n\n## OPERATOR STEERING (from serenaxie@microsoft.com — HIGHEST PRIORITY)\n\n${steeringInput}\n\n---\n`
    : "";

  const skillInfo = currentSkill
    ? `Current skill-detector: ${currentSkill.length} chars, ${(currentSkill.match(/^## /gm) || []).length} sections. READ it at ${SKILL_PATH} before editing.`
    : `No skill-detector exists yet. Create the first version at ${SKILL_PATH}.`;

  const focusLabel = focus === "skill" ? "SKILL-DETECTOR" : focus === "dashboard" ? "DASHBOARD" : "SKILL + DASHBOARD";

  // Task 1: patterns always included
  const patternsTask = `## Task 1: Update patterns.json (${PATTERNS_PATH})

Read ${SIGNALS_PATH}. ${prevPatterns ? "Merge with existing patterns — update scores, trends, lastSeenCycle." : "Create from scratch."} Mark patterns not seen for 3+ cycles as "declining". Write valid JSON with this structure:

\`\`\`json
{
  "lastUpdatedCycle": ${cycleNum},
  "totalCyclesRun": ${cycleNum},
  "patterns": [{ "patternId": "<slug>", "label": "<name>", "sources": ["email",...], "occurrenceCount": <int>, "participantCount": <int>, "timeSpentHoursTotal": <float>, "automationScore": <0-100>, "valueScore": <0-100>, "candidateSkillName": "<kebab-case>", "firstSeenCycle": <int>, "lastSeenCycle": ${cycleNum}, "trend": "rising|stable|declining", "llmRationale": "<why>" }],
  "skillGeneratorInput": { "candidateSkills": [{ "name": "<skill-name>", "description": "<what>", "triggerExamples": ["<when>"], "valueProposition": "<why>" }] }
}
\`\`\``;

  // Task 2: skill-detector (only when focus includes skill)
  const skillTask = focus !== "dashboard" ? `## Task 2: IMPROVE the skill-detector (MAIN DELIVERABLE)

The skill-detector is a PORTABLE Claude skill that ANY person runs on their own WorkIQ data. It must work for PMs, engineers, designers, managers — anyone with M365 activity. Use the real signals from this cycle as training data to make it better.

${currentSkill
    ? `Use the Edit tool to make TARGETED improvements to ${SKILL_PATH}. Do NOT rewrite from scratch. Read the full file first, identify what's weak or missing, then make specific edits.`
    : `Create ${SKILL_PATH} with Claude skill frontmatter (name + description). Make it impressive.`}

Focus areas for improvement (pick 1-2 per cycle):
- **Detection heuristics**: Better pattern recognition across email, meetings, Teams, docs
- **Scoring rubrics**: More accurate automation feasibility + business value scoring
- **Pattern archetypes**: Add/refine the catalog of pattern types (e.g. recurring triage, status sync, approval chains)
- **Generalizability**: Ensure it works for different roles, not just the current user's patterns
- **Output quality**: Clearer, more actionable skill recommendations with concrete trigger examples
- **Edge cases**: Handle sparse data, single-source patterns, seasonal patterns
- **WorkIQ integration**: Better prompts for querying WorkIQ, better signal extraction

You have full creative control. The goal: if a colleague runs this skill tomorrow, it should blow them away.` : "";

  // Task 3: dashboard (only when focus includes dashboard)
  const dashboardTask = focus !== "skill" ? `## Task ${focus === "dashboard" ? "2" : "3"}: IMPROVE dashboard.html (${DASHBOARD_PATH}) — WORLD-CLASS INSIGHTS

Read the current dashboard, then make TARGETED improvements with Edit. Self-contained HTML, dark theme (#0f1117), inline CSS/JS only.

This dashboard is what colleagues SEE when they use Skilluminator. Make it world-class:

Focus areas for improvement (pick 1-2 per cycle):
- **Data visualization**: Charts, trend sparklines, score gauges, heatmaps — make patterns visual
- **Pattern insights**: Show each pattern with its automation score, value score, time impact, and trend
- **Top recommendations**: Highlight the highest-value skill candidates with clear "why you should care"
- **Time savings**: Show how much time the user could save if top patterns were automated
- **Interactive elements**: Sorting, filtering, expandable detail sections, tab navigation
- **Polish**: Typography, spacing, transitions, responsive layout, loading states
- **Narrative**: Not just data tables — tell the story of the user's work patterns

Each cycle should make a VISIBLE improvement. If a colleague opened this dashboard, they should be impressed.` : "";

  const tasks = [patternsTask, skillTask, dashboardTask].filter(Boolean).join("\n\n---\n\n");
  const taskCount = [true, focus !== "dashboard", focus !== "skill"].filter(Boolean).length;

  return `## REFINE PHASE — Cycle ${cycleNum} [Focus: ${focusLabel}]
${steeringBlock}
### Context
- Signals: ${SIGNALS_PATH} (${signalCount} signals)
- Patterns: ${PATTERNS_PATH} (${patternSummary})
${focus !== "dashboard" ? `- Skill: ${SKILL_PATH} — ${skillInfo}` : ""}
${focus !== "skill" ? `- Dashboard: ${DASHBOARD_PATH}` : ""}

**Read the files you need, then do ${taskCount === 1 ? "the task" : `all ${taskCount} tasks`}. Be efficient — make targeted edits, don't rewrite files.**

---

${tasks}

---

## FINAL STEP — Blog Post (MANDATORY, DO NOT SKIP)

You MUST end your entire response with a section that starts with exactly these characters on their own line:

## FEED POST

Followed by a fun, lighthearted blog post (3-6 sentences) for the operator. This is NOT optional. Write in a witty, personality-filled tone — like a teammate posting a standup update with humor. Include:
- What you did this cycle and what changed
- Interesting findings or highlights from the data
- Top skill candidate(s) with scores
- Any challenges, gaps, or funny observations
- A dash of personality — puns, metaphors, or playful commentary welcome

This post will be shown directly to the operator on the feed page. If you do not include a ## FEED POST section, the operator will see a boring fallback message instead of your personality.`;
}

// ── Helpers ─────────────────────────────────────────────────────────

function getWeekLabel(): string {
  const now = new Date();
  const monday = new Date(now);
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(now.getDate() + daysToMonday);
  return monday.toISOString().slice(0, 10);
}
