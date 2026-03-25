# Skilluminator
## Work Pattern Analyzer & Skill Candidate Detector

A Claude skill that analyzes your M365 work activity to discover which of your repeated work patterns are the best candidates for AI automation — and generates a visual dashboard of the findings.

Works with WorkIQ M365 data. Compatible with any role.

---

## HOW IT WORKS

Skilluminator runs a single analysis pass over your M365 activity for a specified time period. It does NOT accumulate data across runs — every run is a fresh analysis grounded entirely in what WorkIQ returns.

1. **HARVEST** — Query WorkIQ for your email, meetings, Teams chats, and documents
2. **EXTRACT** — Parse responses into structured signals (one per distinct behavior)
3. **CLUSTER** — Group signals into patterns that share source, topic, action, or trigger
4. **FILTER** — Check patterns against existing M365 automation and relevance thresholds
5. **SCORE** — Rate all surviving patterns on automation feasibility and business value
6. **GENERATE** — Produce a ranked list of skill candidates with plain-language explanations
7. **DASHBOARD** — Generate an HTML dashboard with analytics, clusters, and top skill candidates
8. **BUILD** — Offer to scaffold any top candidate via `/skill-creator`

---

## HARVEST — WorkIQ Queries

Run these queries against WorkIQ for the user's specified time range. Replace `{TIME_RANGE}` with the actual period (e.g., "past 7 days", "past 30 days", "in March 2026").

**Email:**
1. "What email threads did I send or receive most frequently {TIME_RANGE}? List subject patterns, sender/recipient groups, and approximate time spent."
2. "Are there recurring email types I write regularly (status updates, approvals, scheduling requests)? Show examples from {TIME_RANGE}."
3. "Which emails required the most back-and-forth {TIME_RANGE}, and what were the topics?"

**Meetings:**
4. "What recurring meetings did I attend {TIME_RANGE}? For each, describe the typical agenda type, attendee count, and duration."
5. "How much total meeting time {TIME_RANGE}, broken down by type (1:1, team sync, external, all-hands)?"
6. "Which meeting types happen on a regular cadence with roughly the same people?"

**Teams:**
7. "What Teams channels or chats was I most active in {TIME_RANGE}? What were the recurring topics?"
8. "Are there questions I get asked repeatedly in Teams chats? What topics come up most?"
9. "What types of information do I most frequently share or look up in Teams {TIME_RANGE}?"

**Documents:**
10. "What types of documents did I create, edit, or review most often {TIME_RANGE}?"
11. "Are there documents I update on a regular cadence (weekly/monthly reports, trackers, dashboards)?"
12. "What SharePoint sites or OneDrive folders do I access most frequently?"

**Cross-source:**
13. "Across email, meetings, and Teams, what topics consumed the most of my time {TIME_RANGE}?"
14. "Are there workflows that repeat across sources (e.g., receive email -> schedule meeting -> create document)?"
15. "What tasks do multiple people on my team do independently that could potentially be standardized?"

**Query handling:**
- If a query returns rich data (3+ distinct behaviors): proceed normally
- If a query returns sparse data (1-2 signals): note it and move on
- If a query errors: log the error, skip it, continue with remaining queries
- After all queries: report how many succeeded and how many errored

**Meeting attendance verification:**
Calendar invites do NOT equal attendance. WorkIQ can distinguish "invited" from "attended" using the `HasUserAttended` flag in meeting telemetry. Before building any meeting-based pattern, run a follow-up query:

> "Of these meetings, which ones did I actually attend (joined the call or was physically present) in {TIME_RANGE}? [list meeting titles]"

Only include meetings with confirmed attendance in patterns. If attendance can't be confirmed, note it as "attendance unconfirmed" and do NOT present it as a high-confidence pattern. This prevents false patterns like "Large Forum Passive Attendance" for meetings the user was invited to but never joined.

---

## SIGNAL EXTRACTION

For each WorkIQ response, extract structured signals:

```
source:         email | meeting | teams | document
title:          short description of the repeating behavior
participants:   roles involved (PM, Engineering Lead, etc.) — NEVER names
frequency:      times per week as reported by WorkIQ
timeSpentHours: hours spent on this behavior in the analyzed period, as reported by WorkIQ
keywords:       key terms from the WorkIQ response
rawExcerpt:     exact quote from WorkIQ response (anonymized)
```

**Rules:**
- One signal per distinct behavior, not per mention
- Same behavior across 2+ queries → merge into one signal, note multi-source
- Participants: use roles only (PM, Engineering Lead) — NEVER real names
- NEVER invent data not present in WorkIQ responses
- If WorkIQ gives a range (e.g., "2-4 hours"), use the midpoint
- If WorkIQ doesn't give a number, mark as "not reported" — do NOT estimate
- **Manual vs automated:** WorkIQ describes what happens in the user's M365 workflow but does NOT distinguish between manual effort and automated tool output. When extracting signals, tag each as `manual`, `automated`, or `unclear`. For example, "meeting notes are generated after meetings" is likely automated by Teams Copilot — tag as `automated`. "User writes status update emails" is manual. Only `manual` signals represent real automation opportunities.

---

## PATTERN CLUSTERING

Group signals into patterns when they share 2+ of:
- Same source type (email, meeting, teams, document)
- Same topic domain (status updates, triage, coordination, reporting)
- Same action verb (write, triage, schedule, summarize, review)
- Same trigger-output chain (receive X → produce Y)

Each pattern requires at least 2 signals AND those signals must share at least 2 of the 4 clustering criteria above. A single signal is not a pattern — drop it silently. The user will have a chance to surface missing work during the Surface & Reflect step.

---

## EXISTING AUTOMATION CHECK

Before scoring, check every pattern against M365 built-in automations that already handle the work. If a pattern is substantially covered by an existing tool, it is NOT a good skill candidate — even if it scores high on automation and frequency.

**Known M365 built-in automations to check:**

| Built-in Feature | What It Already Does | Patterns to Flag |
|---|---|---|
| **Teams Copilot Meeting Recap** | Auto-generates meeting summaries, action items, and follow-ups from transcripts | Meeting summarization, action item extraction, meeting notes distribution |
| **Outlook Focused Inbox** | Separates important email from low-priority/automated notifications | Email triage (partial — still applies for fine-grained classification) |
| **Copilot in Word/PowerPoint** | Drafts, summarizes, and reformats documents from prompts | Document drafting (partial — applies for first-draft generation) |
| **Viva Insights** | Tracks meeting load, focus time, and collaboration patterns | Time-tracking and workload visibility |
| **Teams Copilot Chat Recap** | Summarizes missed Teams chat conversations | Chat summarization, catching up on threads |
| **Loop Components** | Real-time collaborative task tracking in Teams/Outlook | Shared task/action tracking across channels |

**How to apply:**
1. For each pattern, ask: "Is the MANUAL work in this pattern already handled by an M365 built-in feature?"
2. If **fully covered** (e.g., meeting summarization by Teams Copilot): Do NOT present as a pattern. Drop it with a note in the output metadata: "Filtered: [pattern] — already automated by [feature]."
3. If **partially covered** (e.g., email triage — Focused Inbox helps but doesn't do fine-grained ADO classification): Apply the `-10 Already partially automated` value deduction AND note what the gap is that a skill would fill.
4. If **not covered**: Score normally.

**Important:** When WorkIQ reports behaviors like "extracts meeting outcomes" or "summarizes chat threads," determine whether the USER does this manually or whether an M365 tool does it automatically. WorkIQ describes what happens in the user's workflow — it does not distinguish between manual and automated steps. A signal that says "meeting notes are produced after meetings" could mean the user writes them OR that Teams Copilot generates them. Do NOT assume manual effort without evidence.

---

## RELEVANCE THRESHOLD

Before scoring, drop patterns that are too thin to be meaningful. A pattern must meet at least ONE of:
- Time cost >= 30 min/week (reported by WorkIQ)
- Occurrence >= 5 per week
- Cross-source (signals from 2+ M365 tools)
- WorkIQ explicitly flags pain, overload, or high cognitive load

Patterns that fail all four criteria are noise — normal work overhead, not candidates for automation. Drop them silently.

---

## SCORING

### Automation Score (0-100)

Measures how rule-based and repetitive the pattern is. High score = an AI agent can do this reliably.

| Rubric Item | Points | Criteria |
|---|---|---|
| Clear trigger | +20 | The pattern starts from a specific, observable event (email arrives, meeting ends, notification fires) |
| Fixed output format | +20 | The output is always the same structure (template, summary, classification, status update) |
| Same steps every time | +20 | The process doesn't branch based on subjective judgment |
| No sensitive sign-off | +15 | Doesn't require human approval for compliance, legal, or privacy reasons |
| Single source | +10 | Only involves one M365 tool (email only, or docs only) |
| High volume | +10 | Occurs 20+ times per week in the analyzed period |
| **Deductions** | | |
| Requires nuanced judgment | -20 | Strategic decisions, creative work, sensitive negotiations |
| Involves external parties | -10 | Customers, partners, vendors with unpredictable inputs |
| Multi-system without API | -10 | Requires manual copy-paste between disconnected tools |
| Low volume (<5/week) | -10 | Too infrequent to justify automation investment |

**Ceiling rule:** No pattern scores above 95. Reserve at least 5 points for human review overhead.

### Value Score (0-100)

Measures how much this pattern costs you and how much automating it would help.

| Rubric Item | Points | Criteria |
|---|---|---|
| High time cost | +25 | Takes 2+ hours per week in the analyzed period |
| High frequency | +20 | Occurs 10+ times per week |
| Blocks others | +20 | Other people are waiting on this output before they can proceed |
| Critical workflow | +15 | Part of a workflow that directly impacts delivery, quality, or compliance |
| Pain expressed | +10 | User or WorkIQ data indicates frustration, overload, or complaints about this task |
| **Deductions** | | |
| Low impact if skipped | -15 | Nothing bad happens if this is done a day late |
| Already partially automated | -10 | Tools already handle some of this |
| Affects only one person | -5 | No downstream impact on others |

### Composite Score

```
Composite = (Automation × 0.55) + (Value × 0.45)
```

Score ALL patterns that passed the filter and relevance threshold. Generate a skill candidate card for every pattern. Use the composite score to rank and tier them:

- **Strong candidate (70+):** High automation potential AND high value. Build this first.
- **Moderate candidate (50–69):** Automatable but may need a human-in-the-loop design, or the time savings are modest. Worth building if the strong candidates are done.
- **Worth exploring (below 50):** The user says it's painful, but automation is hard or the pattern is low-volume. Consider partial automation, templates, or process changes instead of a full skill.

### Hours Saved Estimate

```
Est. hours saved/week = timeSpentHours × savePct
```

Where `savePct` is determined by automation score:
- Auto >= 90 → 80% saveable
- Auto 80-89 → 70% saveable
- Auto 70-79 → 55% saveable
- Auto 60-69 → 40% saveable
- Auto < 60  → 20% saveable

**Transparency note:** `savePct` is a heuristic, not a measured outcome. `timeSpentHours` comes from WorkIQ data for the analyzed period. Always show the formula so users can verify. Label estimates clearly: "Estimated X hrs/week saveable (based on Y hrs observed, Z% automation estimate)."

---

## OUTPUT SCHEMA

Write results to `patterns.json`:

```json
{
  "analyzedAt": "<ISO timestamp>",
  "timeRange": "<what was analyzed, e.g. 'past 7 days'>",
  "weekOf": "<ISO date>",
  "signalCount": 0,
  "queriesRun": 15,
  "queryErrors": [],
  "patterns": [
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
        "notes": "Trigger: weekly meeting ends. Output: structured notes. No deductions."
      },
      "valueScore": 78,
      "valueRubric": {
        "timeCost": 25,
        "frequency": 20,
        "blocksOthers": 0,
        "criticalWorkflow": 15,
        "painExpressed": 0,
        "deductions": -5,
        "notes": "4.5 hrs/week is significant. Doesn't block others directly. -5: affects only one person."
      },
      "compositeScore": 81.9,
      "tier": "strong",
      "candidateSkillName": "kebab-case-skill-name",
      "estHoursSavedPerWeek": 3.15,
      "llmRationale": "Plain-language explanation of why this pattern was identified and scored this way"
    }
  ],
  "filteredPatterns": [
    {
      "label": "Meeting Summarization",
      "reason": "Already automated by Teams Copilot Meeting Recap"
    }
  ],
  "unflaggedPatterns": [
    {
      "label": "Pattern the user did not select as a pain point",
      "reason": "User said: not a real time sink"
    }
  ]
}
```

Sort patterns by `compositeScore` descending. Include all scored patterns.

---

## SKILL CANDIDATE CARDS

For **every user-flagged pattern**, generate an output card. Include the tier label based on composite score:

```
═══════════════════════════════════════════════════════
SKILL CANDIDATE: [skill-name]
Pattern: [Label]                            Rank: #N
Tier: [STRONG CANDIDATE | MODERATE CANDIDATE | WORTH EXPLORING]
═══════════════════════════════════════════════════════

SCORES
  Automation:  NN/100
    [list each rubric item that contributed, e.g. "+20 clear trigger (meeting ends)"]
  Value:       NN/100
    [list each rubric item that contributed]
  Composite:   NN.N/100

───────────────────────────────────────────────────────
WHY THIS MATTERS

  WHAT:   [What does this skill do for you? Plain English, one sentence.]
  WHY:    [Why should you care? Name the specific pain it eliminates.]
  FUTURE: [What does your work look like with this skill? Before/after.]

───────────────────────────────────────────────────────
THE MATH (transparent)

  Time observed:      X.X hrs in [time range]
  Automation estimate: NN% saveable (based on auto score NN)
  Est. savings:       ~X.X hrs/week
  Formula:            timeSpentHours(X.X) × savePct(NN%) = X.X hrs

───────────────────────────────────────────────────────
TRIGGER EXAMPLES
  - [specific observable event from the data]
  - [another specific event]

SAMPLE CLAUDE PROMPTS
  > [prompt 1 the user could try right now]
  > [prompt 2]

SKILL SKELETON
  TRIGGER:  [specific event]
  INPUT:    [what data to provide]
  STEPS:    1. [step]  2. [step]  3. [step]
  OUTPUT:   [what the skill produces]

RECOMMENDATION
  [For STRONG: "Build this skill. Here's the skeleton."
   For MODERATE: "Consider a lighter approach first — e.g., a template,
   a Power Automate rule, or a pinned FAQ — before building a full skill."
   For WORTH EXPLORING: "This is hard to fully automate. Try: [specific
   partial solution — template, checklist, delegation, process change]."]

TRY IT NOW
  [One specific action the user can take today. Be concrete.]
═══════════════════════════════════════════════════════
```

---

## BUILD — Skill Creator Integration

After presenting scored candidates, offer to build any candidate the user wants:

> "Want to build any of these skills? Pick a candidate and I'll run `/skill-creator` to scaffold it."

If the user picks a candidate, invoke `/skill-creator` with context from the skill candidate card:
- The **SKILL SKELETON** (trigger, input, steps, output)
- The **candidateSkillName**
- The **llmRationale** and **WHAT/WHY/FUTURE** from the card
- Any relevant WorkIQ data (signals, examples, frequency)

This closes the loop: Skilluminator discovers what to automate → user validates → Skill Creator builds it.

---

## RULES

1. **NEVER invent data.** Every number must come from WorkIQ responses. If WorkIQ didn't report it, don't make it up.
2. **NEVER accumulate across runs.** Each run is independent. No reading prior patterns.json.
3. **Show your work.** Every score must show which rubric items applied and why.
4. **Anonymize always.** Use roles (PM, Engineering Lead), never real names.
5. **Be honest about estimates.** Label heuristics as heuristics. Show formulas.
6. **No questions asked.** Run the full pipeline end-to-end without asking the user to validate or flag patterns. Score everything that passes filters, generate the dashboard, and present top candidates directly. The user reviews the output, not the intermediate steps.
7. **Plain language first.** Lead with what the pattern means for the person, not the scores.
8. **Check existing automation.** Before proposing a skill, verify the work isn't already handled by M365 built-in features. WorkIQ doesn't distinguish manual from automated steps.
9. **Verify attendance, not just invites.** Calendar data shows invitations. Use WorkIQ attendance telemetry to confirm the user actually joined before building meeting-based patterns.
