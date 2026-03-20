const fs = require('fs');
const path = 'C:\\agent\\skilluminator\\.claude\\skills\\skill-detector\\SKILL.md';
let c = fs.readFileSync(path, 'utf8');

// 1. Update frontmatter version
c = c.replace('version: 2.7.0', 'version: 2.8.0');

// 2. Update header
c = c.replace('# Skill Detector v2.7.0', '# Skill Detector v2.8.0');

// 3. Update cycle count in intro paragraph
c = c.replace(
  'You are backed by 55 cycles of validated M365 data',
  'You are backed by 61 cycles of validated M365 data'
);

// 4. Update "and 5 role-specific detection lenses" in the intro paragraph
c = c.replace(
  'and 5 role-specific detection lenses validated across PM, engineering, design, management, and executive data. Your recommendations are evidence-based, not theoretical.',
  'and 5 role-specific detection lenses validated across PM, engineering, design, management, and executive data, and a First-Run/Cold-Start Protocol for new users (Phase 0 NEW v2.8). Your recommendations are evidence-based, not theoretical.'
);

// 5. Update pipeline name
c = c.replace(
  '## Core Method: The 24-Phase Pipeline',
  '## Core Method: The 25-Phase Pipeline'
);
c = c.replace(
  'HARVEST -> CLASSIFY -> ATTRIBUTE -> SCORE -> VELOCITY -> LIFECYCLE -> SPAWN -> CALENDAR -> EXTERNAL -> PORTFOLIO -> CLUSTER -> CHAIN -> CONVERGE -> DECOMPOSE -> BROADCAST -> BOTTLENECK -> FEASIBILITY -> DECAY -> REBOUND -> DEADLINE -> SGI -> XSOURCE -> GRADUATE -> GENERATE',
  'COLD-START -> HARVEST -> CLASSIFY -> ATTRIBUTE -> SCORE -> VELOCITY -> LIFECYCLE -> SPAWN -> CALENDAR -> EXTERNAL -> PORTFOLIO -> CLUSTER -> CHAIN -> CONVERGE -> DECOMPOSE -> BROADCAST -> BOTTLENECK -> FEASIBILITY -> DECAY -> REBOUND -> DEADLINE -> SGI -> XSOURCE -> GRADUATE -> GENERATE'
);

// 6. Insert Phase 0 before Phase 1
const phase0 = `### Phase 0: COLD-START -- First-Run Onboarding for New Users (NEW v2.8)

**Run this phase ONLY if the user has no prior pattern history (Cycle 1 / first time running skill-detector).**

A first-time user has no accumulated patterns, no baselines, and no trend history. This phase prevents them from getting a barren output and instead gives them immediate, actionable orientation.

#### Step 0a: Role and Context Intake (ask before harvesting)

Before running any WorkIQ queries, ask 3 quick intake questions:
1. "What is your primary role?" (PM / Engineer / Designer / Manager / Exec / Other)
2. "What is your single biggest time-drain this week?" (free-text, 1-2 sentences)
3. "Which M365 tool do you live in most?" (Email / Teams / Calendar / SharePoint / All)

Use answers to: (a) select the right Role Lens (see Role-Specific Detection Guide), (b) prioritize which harvest queries to lead with, and (c) pre-classify their stated pain into one of the 28 archetypes before WorkIQ runs.

**Pre-classify their stated pain immediately.** Map the free-text answer to the nearest archetype. Example: "I spend too much time summarizing meetings" -> Archetype 2 (Meeting Output Capture). Tell the user: "That sounds like Archetype 2 -- Meeting Output Capture. I will look for evidence of this pattern and score it."

#### Step 0b: Abbreviated 5-Query Quick Scan (cycle 1 only)

Run these 5 high-yield starter queries instead of all 15. They cover the widest archetype surface area fastest:

1. [EMAIL] "What email threads did I send or receive most frequently in the past 7 days? List subject patterns and approximate time spent."
2. [MEETINGS] "What recurring meetings did I attend this past week? For each, what was the agenda type and who attends?"
3. [TEAMS] "Are there questions I get asked repeatedly in Teams chats -- things people regularly come to me for?"
4. [DOCS] "What types of documents did I create, edit, or review most often this past week?"
5. [CROSS] "Are there workflows that seem to repeat -- where I do the same sequence of actions across email, meetings, and docs?"

Yield >= 3 (substantive answers from 3+ queries): proceed to Phase 2 CLASSIFY. Label all patterns WARNING LOW confidence (cycle 1, single-occurrence minimum).
Yield < 3: flag sparse data, use stated pain as primary detection seed, classify as LOW-confidence with explicit "verify next cycle" note.

#### Step 0c: Cold-Start Output Format

Output a simplified discovery summary BEFORE full Skill Spec Cards:

    FIRST SCAN SUMMARY ─────────────────────────────────────────
    [role] -- here is what I found in your first scan.

    TOP PATTERN CANDIDATES (cycle 1 -- all LOW confidence WARNING)
    1. <patternLabel> -- approximately <N> occurrences spotted
       Nearest archetype: <ArchetypeName> -- Auto ceiling: <NN>%
       What this means: <1 sentence plain-language explanation>
       Quick win: <1 concrete action they can take TODAY>
    2. <patternLabel> ...
    3. <patternLabel> ...

    NEXT STEPS
    - Run skill-detector again next week to confirm these patterns
    - Patterns need 3+ cycles before scores are fully reliable
    - Your highest-priority quick win right now: <single recommendation>
    ─────────────────────────────────────────────────────────────

**Cold-Start Principle:** Give the user ONE concrete thing they can do today, even with 1 cycle of data. A "monitor for 3 more cycles" output on cycle 1 feels like a dead end. Always pair low-confidence findings with an immediate action: "Even with limited data, you can try X now and we will validate it next week."

`;

c = c.replace('### Phase 1: HARVEST -- Collect Raw Signals from M365', phase0 + '### Phase 1: HARVEST -- Collect Raw Signals from M365');

// 7. Add Adaptive Query Sequencing inside Phase 1 after the yield scoring paragraph
const adaptive = `
#### Adaptive Query Sequencing (NEW v2.8)

Do not run all 15 queries blindly. Follow the signal. After the first 5 queries, check which source type returned the richest data and invest depth there before moving on.

**Query Yield Triage Matrix:**

| After first 5 queries -- if this source is richest | Run these next 3 queries |
|-----------------------------------------------------|--------------------------|
| Email (5+ threads) | Q2 (email types), Q3 (back-and-forth threads), Q13 (cross-source topics) |
| Meetings (5+ series) | Q6 (recurring patterns), Q5 (time breakdown by type), Q14 (workflow sequences) |
| Teams (5+ topics) | Q8 (repeated asks), Q9 (info sharing patterns), Q15 (org standardization gaps) |
| Documents (5+ doc types) | Q11 (cadenced docs), Q12 (SharePoint access), Q14 (workflow sequences) |
| All sources thin (fewer than 3 signals each) | Trigger Sparse Data protocol (see Role Guide below) |

**The double-down rule:** If a source returns 8+ substantive signals in early queries, run 1-2 additional deep-dive queries on that source before switching channels. The user's work concentrates in one channel -- mine it fully.

**Skip low-yield queries:** If a source category returns 0 substantive responses in its first query, skip its remaining 2 queries this cycle. Note in output: "[source] harvest sparse this cycle -- queries skipped. Will retry next cycle."

`;

c = c.replace('**Scoring signal yield:** After running all 15, count', adaptive + '**Scoring signal yield:** After running all 15, count');

// 8. Add Anti-pattern 23
c = c.replace(
  'misleads the user about build readiness.\n\n## Pattern Dependency Graph',
  'misleads the user about build readiness.\n23. Cold-Start Over-Caution (NEW v2.8) -- do not give a first-time user a fully-deferred output ("come back in 3 cycles"). Even 1 cycle of data is enough to identify the highest-probability archetype and give one concrete quick-win action. Uncertainty is not a reason for silence; it is a reason for clearly-labelled, low-confidence, immediately-actionable guidance.\n\n## Pattern Dependency Graph'
);

// 9. Add Principle 43
c = c.replace(
  'Score correctness and score confidence are orthogonal dimensions (NEW v2.6).\n\n## ROI',
  'Score correctness and score confidence are orthogonal dimensions (NEW v2.6).\n43. Adaptive harvest beats rote harvest -- follow the signal, not the script. If one source type is producing rich data, invest depth there before moving on. Running all 15 queries when 5 of them are clearly empty wastes cycles and dilutes user attention. Intelligent sequencing is part of the analysis (NEW v2.8).\n\n## ROI'
);

// 10. Update ROI line
c = c.replace(
  '28-archetype full table v2.7)',
  '28-archetype full table v2.7, First-Run Cold-Start Protocol v2.8, Adaptive Query Sequencing v2.8, 25-phase pipeline v2.8)'
);

// 11. Add changelog row
c = c.replace(
  '59 cycles. $1.50M+/yr. |',
  '59 cycles. $1.50M+/yr. |\n| 2.8.0 | 61 | Phase 0 COLD-START: First-Run Onboarding Protocol -- role/context intake (3 questions), 5-query quick scan, archetype pre-classification of stated pain, Cold-Start Output Format with immediate quick-win recommendation, Cold-Start Principle (never fully defer a cycle-1 user). Phase 1 HARVEST: Adaptive Query Sequencing with Query Yield Triage Matrix and double-down rule -- follow the signal, skip low-yield sources, invest depth in richest channels. 25-phase pipeline. Anti-pattern 23 (Cold-Start Over-Caution). Principle 43 (Adaptive harvest). 61 cycles. $1.50M+/yr. |'
);

fs.writeFileSync(path, c, 'utf8');
console.log('SKILL.md v2.8.0 written. Length:', c.length);
