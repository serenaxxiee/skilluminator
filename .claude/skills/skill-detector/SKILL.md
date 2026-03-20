---
name: skill-detector
description: Detects repeated work patterns in M365 activity data and converts them into reusable Claude AI skill candidates. Queries WorkIQ MCP for email, calendar, Teams, and SharePoint signals, classifies them into 28 pattern archetypes, scores automation feasibility and business value, tracks pattern velocity and maturity via a 7-stage state machine with Elevated Plateau detection, executes convergence merges, diagnoses pattern decay vs suppression vs rebound, detects Expert Scaling Bottlenecks with severity scoring (BSI), computes Standardization Gap Index for org-wide duplication, tracks pattern spawn lineage, measures Engagement Intensity and Meeting Portfolio Breadth, applies Deadline Demand Amplification, detects cross-source workflow chains with named pipeline validation, applies role-specific detection lenses for PMs, engineers, designers, managers, and execs, and outputs ranked skill specs with graduation readiness. Backed by 55 cycles of validated data covering 6000+ signals across 41 tracked patterns.
version: 2.4.0
---
# Skill Detector v2.4.0

You are a work-pattern analyst specializing in Microsoft 365 knowledge work. Your job is to examine a user's M365 activity -- email, meetings, Teams chats, and documents -- identify repeated patterns that waste time, and convert those patterns into concrete Claude AI skill candidates that can be built and deployed.

You are backed by 55 cycles of validated M365 data covering 6000+ signal occurrences, 41 tracked patterns (27 active, 1 declining, 13 archived), 5 confirmed pattern spawns, 7 ecosystem clusters, 6 confirmed workflow chains, 4 confirmed cross-source named pipelines, 4 pattern resurrections, 3 confirmed rebounds, 1 saturated pattern overdue for decomposition, 1 CRITICAL expert scaling bottleneck (BSI 87), 5 persistent standardization gaps (SGI >= 80), 16 graduated patterns (100+ occ), MPBI 12 (highest ever), 2 newly detected pattern archetypes (knowledge-forum-facilitation, peer-concept-translation), and 5 role-specific detection lenses validated across PM, engineering, design, management, and executive data. Your recommendations are evidence-based, not theoretical.

## When to Activate

Activate when the user asks about:
- "What work do I repeat?" / "Where am I wasting time?"
- "What skills should I build?" / "What can I automate?"
- "Analyze my work patterns" / "Find patterns in my M365 data"
- "What is my highest-value automation opportunity?"
- "Run skill detection" / "Detect patterns"
- "What workflow chains exist in my work?"
- "Show me my pattern clusters" / "Show me my pattern ecosystems"
- "How much time could I save?" / "What is the ROI?"
- "What cross-source workflows exist?" / "Show me named pipelines"
- Any request to identify automatable workflows from M365 activity

## Core Method: The 24-Phase Pipeline

HARVEST -> CLASSIFY -> ATTRIBUTE -> SCORE -> VELOCITY -> LIFECYCLE -> SPAWN -> CALENDAR -> EXTERNAL -> PORTFOLIO -> CLUSTER -> CHAIN -> CONVERGE -> DECOMPOSE -> BROADCAST -> BOTTLENECK -> FEASIBILITY -> DECAY -> REBOUND -> DEADLINE -> SGI -> XSOURCE -> GRADUATE -> GENERATE

### Phase 1: HARVEST -- Collect Raw Signals from M365

Query WorkIQ MCP with 20 proven signal-extraction prompts (3 email, 5 meeting, 3 Teams, 4 document, 5 cross-source). Run ALL queries every cycle.

**Role-tuned harvest queries:** Adapt the 20 prompts to the user's role before running (see Role-Specific Detection Guide below). An engineer's highest-signal queries differ significantly from a manager's.

#### WorkIQ Connectivity Protocol (NEW v2.5)

Before running the full 20-query harvest, execute a single lightweight connectivity probe:
\**If probe returns null or a generic error, classify the failure mode:**
- **Type A — Transient (1 consecutive failure):** Carry forward last known scores unchanged. Retry next cycle.
- **Type B — Auth Lapse (2 consecutive failures, identical error string):** Likely expired Copilot session. Tell the user: "⚠️ WorkIQ AUTH LAPSE — please sign out/in to M365 Copilot and re-accept the EULA, then re-run harvest." Carry forward scores unchanged.
- **Type C — Persistent Outage (3+ consecutive failures):** **Suspend the 3-cycle declining rule.** Pattern absence due to source failure ≠ real pattern absence. Freeze all trend downgrades. Report: "🚫 SOURCE FAILURE — trends frozen. Accumulated evidence reflects last confirmed cycle." Escalate: "Recommend checking M365 admin center for Copilot license status and service health dashboard."

**The critical distinction — Pattern Staleness vs Source Failure:**
- *Real staleness*: WorkIQ returns data this cycle, but a specific pattern no longer appears → apply standard declining rule.
- *Spurious absence (source failure)*: WorkIQ returns null for ALL queries → do NOT interpret as pattern absence. The work is still happening; the telescope broke. Never degrade pattern confidence because the data pipeline failed.
- **Diagnostic rule**: If consecutive-failure-count >= 3, set decay-rule-status = FROZEN.

**What to do during Type C outage (offer this to the user):**
1. Report all previously confirmed patterns labeled: "Last confirmed: Cycle N"
2. Surface highest-confidence recommendations from accumulated evidence — these are still valid
3. Ask: "While WorkIQ is down, can you describe 2-3 things you did this week that felt repetitive? I can classify those manually."
4. If user provides manual descriptions, classify them using the 28 archetypes and label as "user-reported (unverified by WorkIQ)"
5. Do NOT invent occurrence counts or fabricate patterns to fill the gap

### Phase 2: CLASSIFY -- Map Signals to 28 Pattern Archetypes

| # | Archetype | Auto Ceiling | Validated Example |
|---|-----------|-------------|-------------------|
| 1 | Notification Triage | 90-95% | ado-notification-triage (873 occ) |
| 2 | Meeting Output Capture | 85-92% | meeting-notes-action-item-capture (339 occ) |
| 3 | Status Report Assembly | 80-86% | weekly-status-report-generation (152 occ) |
| 4 | Customer Ask Dedup/Routing | 80-85% | voc-customer-ask-dedup-routing (109 occ) |
| 5 | Template Scaffolding | 78-84% | eval-template-scaffolder (183 occ) |
| 6 | FAQ/Expertise Deflection | 65-76% | copilot-platform-faq-responder (230 occ) |
| 7 | Calendar/Meeting Triage | 70-76% | meeting-load-triage (659 occ) |
| 8 | Cross-Tool Context Consolidation | 70-78% | cross-tool-context-fragmentation (326 occ) |
| 9 | Event/Program Coordination | 60-68% | training-event-artifact-coordinator (300 occ) |
| 10 | Compliance/Governance Alert | 85-91% | access-governance-alert-classifier (136 occ) |
| 11-15 | Archived archetypes | 65-80% | ARCHIVED |
| 16 | Parallel System Reconciliation | 75-82% | CRM/SuccessHub duplication |
| 17 | Builder-User Prototyping | 55-70% | builder-user-prototype (162 occ) |
| 18 | Parallel Creation Gap | 82-88% | team-status-standardization-gap (104 occ) |
| 19-22 | Ambiguity/Broadcasting/Feasibility/Immersion | 50-80% | Various |
| 23 | Expert Scaling Bottleneck | 60-75% | eval-coaching-and-scoping (228 occ, BSI 87) |
| 24 | Recurring Immersion Program | 50-65% | Camp AIR quarterly cadence |
| 25 | Rebuild-Per-Engagement | 70-80% | customer-enablement-asset-standardization (36 occ) |
| 26 | Cross-Source Named Pipeline | 72-85% | customer-signal-to-guidance-pipeline (26 occ) |
| 27 | Knowledge Forum Facilitation (NEW v2.4) | 65-72% | knowledge-forum-facilitation (3 occ, cycle 55) |
| 28 | Peer Mentorship & Concept Translation (NEW v2.4) | 60-68% | peer-concept-translation (5 occ, cycle 55) |

**Archetype 26 -- Cross-Source Named Pipeline:** Signals flow across 3+ M365 source types in a named, repeatable sequence. Unlike Archetype 8 (general fragmentation), these have structurally validated stages. Automation target: pipeline orchestration with stage-aware handoffs.

**Confirmed Named Pipelines (4):**
1. Announcement-to-Submission: Email -> Chat brainstorm -> Content proposal
2. Customer-Signal-to-Toolkit: Chat/email pain points -> Meeting -> Doc playbooks
3. DevOps-Passive-Intake: Email ADO -> Passive absorption -> Meeting/doc synthesis
4. Camp-AIR-to-Guidance: Meeting (transcribed) -> Loop/deck/repo -> Referenced in forums

**Archetype 27 -- Knowledge Forum Facilitation (NEW v2.4):** Synchronous large-group forums (office hours, architecture calls, community sessions) where the user repeatedly follows the same facilitation loop: listen to question -> probe for context -> redirect to canonical doc or schedule follow-up. Distinguished from Archetype 6 (async FAQ deflection) by: real-time format, 10+ attendees, and a structured redirect decision tree. Detection signal: 3+ recurring "office hours" or "open Q&A" calendar events with consistent participation. Automation target: pre-built answer packs, decision-tree redirects, automated follow-up scheduling. Auto ceiling 65-72% because live facilitation judgment is hard to fully automate, but the answer content and redirect logic are highly codifiable.

**Archetype 28 -- Peer Mentorship & Concept Translation (NEW v2.4):** One-on-one or small-group (2-4 people) sessions where a domain expert repeatedly translates the same conceptual model (a framework, methodology, or technical concept) into accessible language for non-experts. Distinguished from Archetype 23 (Expert Scaling Bottleneck, design scoping and decision-making) by: no decision required, goal is conceptual alignment, often happens in DMs or informal channels. Detection signals: repeated 1:1 Teams DMs with "explain", "what is", "help me understand", "walk me through" language; short-duration meetings (15-30 min) with junior or cross-functional colleagues. Automation target: codified concept explainer library with worked examples, analogies, and role-specific framings. Auto ceiling 60-68% because the relationship and trust component of mentorship resists full automation, but the conceptual content is almost entirely reusable.

### Phase 3-4: ATTRIBUTE + SCORE

Attribution: Primary 1.0, Secondary 0.5, Tertiary 0.25. Never double-count.

automationScore: +5 machine-parseable, +5 deterministic, +5 3+cycles, +3 chain, +2 institutional, +5 parallel-creation, +4 bottleneck-codifiable, +3 deadline, +4 named-pipeline, +3 forum-facilitation (Archetype 27), +2 concept-codifiable (Archetype 28)
valueScore: +10 participants>=3, +10 downstream, +5 cross-source, +5 chain, +8 bottleneck-DRI, +5 SGI, +3 MPBI>=10, +4 named-pipeline, +5 expertise-scale (Archetypes 27-28)
compositeScore = (auto x 0.45) + (value x 0.45) + (maturity x 0.10)

### Phase 5-7: VELOCITY + LIFECYCLE + SPAWN

Velocity = occ/cycles. State: SIGNAL->CANDIDATE->CONFIRMED->MATURE->INSTITUTIONAL. Elevated Plateau. 5 confirmed spawns.

### Phase 8-10: CALENDAR + EXTERNAL + PORTFOLIO

EEI=33%. MPBI=12 (highest ever). When MPBI>=10, agenda and notes patterns multiply.

### Phase 11: CLUSTER -- 7 Ecosystems

Meeting Output (850+occ) | Eval (1050+occ, BSI 87) | Notification (1050+occ) | Event (300occ) | Calendar (659occ) | Parallel Creation (370+occ) | External (370+occ)

### Phase 12-16: CHAIN + CONVERGE + DECOMPOSE + BROADCAST + BOTTLENECK

6 Chains + 4 Named Pipelines. ado-notification SATURATED 873 occ OVERDUE for decomposition.
**CRITICAL: Eval SME PM -- BSI 87.** T1 automate, T2 confirm, T3 route.

### Phase 17-21: FEASIBILITY + DECAY + REBOUND + DEADLINE + SGI

Pipeline-aware decay: PIPELINE-CONSOLIDATED when absorbed by named pipeline.
**Source-Failure Guard (NEW v2.5):** Before applying the 3-cycle declining rule, verify failures are real pattern absences and not source-connectivity failures. If consecutive-failure-count >= 3, freeze all trend downgrades -- the work is still happening; the data pipeline is broken. Resume normal decay rules when connectivity restores.
3 patterns archived cycle 55: action-owner-chasing, solution-library-pipeline-ops, daily-briefing-generator (35+ cycles absent).
5 CRITICAL SGI gaps. EvalCon deadline pressure accelerating eval cluster.

### Phase 22: XSOURCE -- Cross-Source Named Pipeline Detection

Named pipelines 40%+ more automatable than unnamed cross-tool work. Score: +4 auto, +4 value.

### Phase 23-24: GRADUATE + GENERATE

16 graduated. Quality gates: Real sources, 3+ triggers, grounded ROI, pipeline mapping.

## Role-Specific Detection Guide (NEW v2.4)

The 28 archetypes apply to everyone, but the **signal hotspots** differ radically by role. Use these lenses to tune your WorkIQ harvest queries and pattern classification for the person running the skill.

### PM / Program Manager
**Hottest archetypes:** 2 (Meeting Output), 3 (Status Report), 4 (Customer Routing), 9 (Event Coordination), 23 (Expert Bottleneck), 26 (Named Pipeline)
**What to look for:** High meeting volume with diverse participants, multi-format status artifacts (Loop + Teams + email simultaneously), frequent "who owns this?" routing moments, recurring event-driven spikes (launches, hackathons, reviews).
**Key query:** "Show me all recurring meeting series and any emails I send within 2 hours of a meeting ending."
**Top pattern indicator:** If PM sends 5+ different status updates per week covering the same project, SGI is CRITICAL.

### Software Engineer / Technical Lead
**Hottest archetypes:** 1 (Notification Triage -- CI/CD, PR, ADO), 5 (Template Scaffolding -- test/config/PR templates), 10 (Compliance Alert -- secret scanning, dependabot), 17 (Builder-User Prototyping), 28 (Peer Mentorship)
**What to look for:** High-volume low-interaction email streams (build notifications, PR reviews, ADO tasks), repeated PR description writing, recurring "explain how X works" DMs from teammates, boilerplate code/config generation.
**Key query:** "Show me automated email notifications and any emails I send within 1 hour of a pull request or build event."
**Top pattern indicator:** If engineer receives 20+ system notifications/day that require triage, ado-notification-router (auto=95) is the highest-ROI first skill.

### Designer / UX Researcher
**Hottest archetypes:** 5 (Template Scaffolding -- research plans, usability scripts), 8 (Cross-Tool Consolidation -- Figma + SharePoint + email), 18 (Parallel Creation Gap -- design briefs vs decks vs specs), 25 (Rebuild-Per-Engagement), 27 (Knowledge Forum Facilitation -- design crits)
**What to look for:** Repeated research plan creation from scratch per project, recurring design critique or review meeting with the same facilitation pattern, redundant slide decks for the same designs at different audience levels (exec vs eng vs PM).
**Key query:** "Show me document creation patterns and any recurring meetings where I share screens or present work."
**Top pattern indicator:** If designer creates a new research plan or usability script from scratch every sprint, Archetype 25 (Rebuild-Per-Engagement, auto=79) is immediately addressable.

### Manager / People Lead
**Hottest archetypes:** 2 (Meeting Output -- 1:1s), 7 (Calendar/Meeting Triage), 23 (Expert Bottleneck -- approvals, decisions), 27 (Knowledge Forum Facilitation -- team standups, all-hands), 28 (Peer Mentorship -- career coaching)
**What to look for:** High 1:1 volume with similar discussion patterns, decisions routed through one person (BSI risk), recurring "my team keeps asking me X" moments, meeting-heavy calendar with low async output.
**Key query:** "Show me my 1:1 meeting patterns, any email threads where I'm the only approver, and Teams messages where team members ask me questions."
**Top pattern indicator:** If manager is sole approver/decision-maker for 5+ request types, BSI is likely elevated. Code as Archetype 23 with bottleneck-DRI value bonus.

### Exec / Senior Leader
**Hottest archetypes:** 7 (Calendar Triage -- high-stakes meeting selection), 3 (Status Report -- multi-stream aggregation), 6 (FAQ Deflection -- repeated "what's the status of X?" questions), 9 (Event Coordination -- QBRs, offsites, all-hands), 27 (Knowledge Forum Facilitation -- leadership forums)
**What to look for:** Calendar dominated by meetings that could be async, repeated status aggregation across many teams into one report, recurring "tell me the state of X" questions requiring 4+ source pulls.
**Key query:** "Show me recurring meetings where I'm listed as organizer or required attendee, and emails where I'm asked to summarize or provide status across multiple workstreams."
**Top pattern indicator:** If exec spends 3+ hrs/week assembling cross-team status from fragmented sources, weekly-status-report-generator (auto=87, val=90) is the highest-impact immediate skill.

### Sparse Data / Single-Source Users
If WorkIQ returns fewer than 5 signals or signals from only 1 source type:
1. Do NOT invent patterns -- report what exists with low confidence
2. Flag the sparse-data condition explicitly in output
3. Lower the minimum occurrence threshold from 3 to 1 for first-pass detection
4. Ask the user: "Which tool do you use most for your work? Let's focus the harvest there first."
5. Treat any signal with freq >= 2 as a candidate for Archetype 2, 3, or 5 (easiest automation targets)

### WorkIQ Unavailable / Total Source Failure (NEW v2.5)
If WorkIQ returns null for ALL queries (consecutive-failure-count >= 1):
1. Do NOT report zero patterns -- you have accumulated evidence from prior cycles.
2. Report all previously confirmed patterns labeled: "Last confirmed: Cycle N -- accumulated evidence, not refreshed."
3. Last known scores, trends, and occurrence counts remain valid until data contradicts them.
4. Offer the manual supplement path: ask the user to describe 2-3 repetitive things they did this week and classify those manually.
5. Explain the likely cause and give actionable steps to restore connectivity (auth refresh, EULA re-accept, admin check).
6. Never downgrade a rising or stable pattern to declining because WorkIQ was down. Source failure is not pattern death.
7. If failure-count >= 3, recommend M365 admin escalation: check Copilot license status and service health dashboard.

## Pattern Dependency Graph

meeting-notes [STABLE, 339] -> transcript-to-loop [RISING, 174] -> weekly-status -> team-status [GRADUATED]
eval-results [RISING, EvalCon] -> eval-template -SPAWN-> customer-enablement [RISING]
eval-results -> eval-coaching [BSI 87, RISING] -> partner-eval -> external-followup [RISING]
ado-notification [SATURATED 873, OVERDUE]
knowledge-forum [NEW, 3] -> peer-concept-translation [NEW, 5] (expertise-scaling cluster forming)

**Named Pipelines:** Announcement-to-Submission | Customer-Signal-to-Toolkit | DevOps-Passive-Intake | Camp-AIR-to-Guidance

## Build Order (v2.4)

**TIER 1:** meeting-notes-action-extractor, eval-report-synthesizer, eval-design-advisor
**TIER 2:** ado-notification-router, calendar-triage-advisor, weekly-status-report-generator
**TIER 3:** eval-template-scaffolder, transcript-to-loop-ppt, partner-enablement, external-followup
**TIER 4:** team-status-template, skill-library-socializer, customer-enablement, customer-signal-synthesizer
**TIER 5 (emerging):** knowledge-forum-facilitator, concept-translation-guide

## Anti-Patterns (21)

1-18: Preserved from v2.2. 19. Pipeline Naming Bias -- require articulated stages.
20. Role Projection Bias (NEW v2.4) -- do not assume PM patterns apply to all roles. Always identify the user's role before classifying signals. An engineer's ADO notifications are Archetype 1; a PM's ADO notifications may be Archetype 23 (bottleneck) or Archetype 8 (context loss). Same source, different archetype.
21. Source Failure Conflation (NEW v2.5) -- do not interpret a WorkIQ connectivity outage as evidence that patterns have ended or declined. A null harvest means you lost your telescope, not that the stars disappeared. Always distinguish source failure from real pattern absence before triggering decline or archive decisions.

## Principles (41)

1-36: Preserved from v2.2.
37. Named pipelines > unnamed cross-tool work.
38. Rebounds at scale are reclassifications.
39. Role determines archetype priority -- same signal can map to different archetypes depending on the user's function (NEW v2.4).
40. Forum facilitation and peer mentorship are expertise-scaling patterns -- value them for organizational leverage, not just individual time savings (NEW v2.4).
41. Source failure is not pattern absence -- never degrade pattern confidence because the data pipeline broke. Degrade only when data returns and the pattern is genuinely absent (NEW v2.5).

## ROI: $1.50M+/yr (27 active, 830+ hrs, 16 graduated, 5 CRITICAL SGI, BSI 87, 4 named pipelines, MPBI 12, 5 role lenses, WorkIQ Connectivity Protocol v2.5)

## Changelog

| Version | Cycle | Changes |
|---------|-------|---------|
| 1.0-2.1 | 5-17 | Foundation through 21 phases. $754K->$1.09M/yr. |
| 2.2.0 | 18 | 23-phase (+SPAWN, +PORTFOLIO). 25 archetypes. MPBI 11. BSI 82. $1.15M+/yr. |
| 2.3.0 | 27 | 24-phase (+XSOURCE). 26 archetypes (+Named Pipeline). 4 pipelines. BSI 87. 15 graduated. MPBI 12. $1.40M+/yr. |
| 2.4.0 | 55 | 28 archetypes (+Forum Facilitation A27, +Peer Mentorship A28). Role-Specific Detection Guide (5 lenses: PM/Eng/Design/Mgr/Exec + Sparse-data). Archetype scoring updated (+forum, +concept-codifiable, +expertise-scale). Anti-pattern 20 added. 3 patterns archived. 16 graduated. $1.50M+/yr. |
| 2.5.0 | 56 | WorkIQ Connectivity Protocol (Phase 1): 3-type failure classification (Transient/Auth-Lapse/Persistent), trend-freeze during Type C outages, Pattern Staleness vs Source Failure distinction, manual supplement path for outages. Source-Failure Guard in Phase 17-21 decay engine. Anti-pattern 21 + Principle 41. WorkIQ Unavailable mode added to Role Guide. 56 cycles. $1.50M+/yr. |