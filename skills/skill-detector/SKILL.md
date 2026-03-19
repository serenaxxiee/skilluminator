---
name: skill-detector
description: >
  Invoke this skill when M365 activity data (email, calendar, Teams, SharePoint/documents) is
  available and the goal is to identify repeated work patterns worth automating as Claude AI skills.
  Trigger conditions: a user asks "what work patterns exist in my M365 activity," "what Claude skills
  should I build," "what repetitive tasks are worth automating," "analyze my weekly work for
  automation opportunities," or when raw WorkIQ query results, signals.json, or M365 activity
  summaries are presented for analysis. This skill ingests M365 signals (frequency, participants,
  time-spent, keywords, source), clusters them into named pattern categories, scores each on
  automation potential and business value using a weighted framework, detects trends across cycles,
  identifies org-wide patterns (3+ participants), and emits ranked skill candidate recommendations
  in standardized skill-generator input format.
---

# Skill Detector

## Purpose

Skill-detector transforms raw M365 activity signals into actionable AI skill candidates. It answers:
"Of everything happening across email, meetings, Teams, and documents each week, which repeated
workflows are so structured and high-frequency that Claude could own them?"

Without this skill, AI skill creation relies on guesswork. With it, Claude reads behavioral evidence
directly from M365 telemetry — frequency, time cost, participant spread, cross-source fragmentation
— and surfaces the highest-ROI automation targets with defensible scores and rationale.

This skill is the detection engine for the Skilluminator system. It feeds the skill-generator.
Every cycle it gets smarter: patterns accumulate evidence, trends become visible, and the catalog
of known automatable workflows grows richer.

---

## Detection Methodology

### Phase 1 — Signal Ingestion

Signals arrive from WorkIQ M365 queries. Each signal has:
- source: email | meeting | teams | document
- title: the pattern name as described
- participants: array of anonymized roles (PM, Engineer, TPM, etc.)
- frequency: occurrences per week
- timeSpentMinutes: total time consumed per week
- keywords: topical keywords from the activity
- rawExcerpt: verbatim description of what was observed

Source reliability ranking (based on 3 cycles of accumulated evidence):
1. email — Highest reliability. Frequency counts are precise. Notification volume and triage
   patterns are directly measurable.
2. teams — High reliability for coordination patterns. Thread structure reveals recurring
   failures (context loss, owner chasing) clearly.
3. meeting — Good for recurring cadence patterns; less reliable for one-off content-heavy meetings.
4. document — Useful for template and creation patterns; authors underestimate drafting time.

### Phase 2 — Pattern Clustering

Group signals into patterns using:
1. Keyword overlap >= 3 shared terms: signals belong to the same candidate cluster
2. Same workflow stage: triage, create, summarize, route, track, report
3. Cross-source confirmation: same pattern in 2+ sources = high-confidence regardless of frequency
4. Participant role overlap: signals sharing 2+ identical roles reinforce the same pattern

Merge vs. create new:
- Merge into existing: keyword overlap >= 3 AND same workflow stage AND same source category
- Create new pattern: distinct workflow stage OR no keyword overlap with existing patterns
- Escalate to org-wide: participantCount >= 3

### Phase 3 — Trend Detection

Compare occurrence count and time-spent to previous cycle:
- rising: occurrence count increased >10% OR new reinforcing signals appeared
- stable: within +/-10% with no new reinforcing signals
- declining: decreased >10% and/or signals no longer appear

Rising patterns: boost composite score by +2 points.
Declining patterns: flag for removal after 2 consecutive declining cycles.

### Phase 4 — Scoring

See Scoring Framework section below.

### Phase 5 — Output Generation

Patterns with compositeScore >= 70 AND participantCount >= 3 become primary skill candidates.
Patterns with compositeScore >= 70 AND participantCount < 3 become secondary candidates.
Each primary candidate gets a full skillGeneratorInput entry.

---

## Pattern Categories

Six categories identified from 3 cycles of M365 data analysis:

### Category 1: Notification and Alert Triage
Recurring, high-volume, low-creativity inbox processing tasks.

Detection signals: Volume >= 5/week of same type; system-generated senders; binary action decision.

Real examples from data:
- work tracking tool notification stream: 35/week (Bugs, Requirements, Epics for Evals/CI/Thresholding)
- GitHub repo admin elevation/revocation alerts: 7/week
- Purview DLP compliance alerts
- Viva Engage, Microsoft Daily Digest, announcements: 7/week

Keywords: work tracking tool, notification, DLP, Purview, GitHub, repo admin, alert, digest, announcement, FYI
Automation ceiling: High (80-92). Value ceiling: Moderate (42-82).

### Category 2: Meeting Output Synthesis
Meetings generating redundant, multi-tool, inconsistently-structured outputs.

Detection signals: Meeting to Loop to Teams share to email summary (3-step duplication); multiple
people independently summarizing same transcript; large meetings (20+ attendees) with no canonical
summary; action items split across Loop tables, email, and work tracking tool.

Real examples from data:
- Post-meeting action item extraction: 29 occurrences, 4.75 hrs/week, 4 roles
- Meeting transcript to Loop to PPT pipeline: 10 occurrences, 2 hrs/week
- Program X Camp: multiple parallel summarization attempts for same content

Keywords: transcript, action items, Loop, PPT, summary, manual synthesis, duplicate effort
Automation ceiling: High (80-86). Value ceiling: High (76-82).

### Category 3: Knowledge Work Coordination
People spending time reconstructing context, chasing owners, and re-finding artifacts.

Detection signals: "Where is the latest deck?" in Teams; "Can someone summarize?" in channels;
same information repeated across email, meeting, doc, Teams; owner follow-ups with no resolution.

Real examples from data:
- Context reconstruction queries: 10 occurrences, 3 hrs/week, 4 roles
- Cross-tool issue thread fragmentation: 8 occurrences, 3 hrs/week, 4 roles
- Manual coordination and chasing owners: 12 occurrences, 2 hrs/week, 3 roles

Keywords: where is, latest deck, which version, can someone summarize, fragmentation, chasing, DRI
Automation ceiling: Moderate (72-74). Value ceiling: High (78-82).

### Category 4: Eval and Quality Workflows
Repetitive tasks around agent evaluation setup, analysis, reporting, and partner enablement.

Detection signals: Independent template creation for same eval purpose; results analyzed per-PM
without shared schema; repeated partner enablement meetings; coverage models rebuilt from scratch.

Real examples from data:
- Eval framework and coverage model authoring: 8 occurrences, 3 hrs/week, 3 roles
- Eval results analysis: 25 occurrences, 5.75 hrs/week, 5 roles
- Partner eval enablement meetings: 12/week, 10 hrs/week (Partner A, Partner B, Partner C)

Keywords: eval, coverage, thresholding, acceptance criteria, scenario, template, grounding, DRI
Automation ceiling: Moderate-High (65-84). Value ceiling: Very High (84-88).

### Category 5: Content Creation and Reuse
Repeated creation of structured documents (decks, reports, agendas) without reusing existing work.

Detection signals: Multiple PMs creating similar decks; fixed-cadence reports assembled manually;
agenda creation without pulling from work tracking tool or prior notes.

Real examples from data:
- Redundant deck creation: 5 occurrences, 5 hrs/week, 3 roles
- Last-minute ROB review deck maintenance: 5 occurrences, 4 hrs/week
- Weekly status report generation: 4 occurrences, 0.75 hrs/week

Keywords: deck, PPT, fork, template, status report, agenda, recap, highlights, lowlights
Automation ceiling: Moderate-High (62-82). Value ceiling: Moderate-High (74-80).

### Category 6: Cross-Tool Information Architecture Failures
Structural patterns where M365 tool fragmentation creates unnecessary work. (NEW in Cycle 3)

Detection signals: Action items spread across >= 3 tools; same topic in all 4 M365 sources;
new joiners have no project entry point; same question asked multiple times in same channel.

Real examples from data:
- Fragmented action item tracking: 12 occurrences, 2.5 hrs/week, ALL 4 M365 sources
- Cross-tool issue thread fragmentation: 18 combined occurrences, 6 hrs/week, 4 roles

Keywords: fragmented, scattered, no single source, action items, Loop, work tracking tool, Teams, email,
system of record, ownership, status, no canonical artifact

Automation ceiling: Moderate (72-76). Value ceiling: High (80-82).

---

## Scoring Framework

### Automation Score (0-100)

Frequency (20 pts max):
>= 30/week: 20 | 10-29/week: 15 | 5-9/week: 10 | < 5/week: 5

Structural consistency (20 pts max):
Nearly identical: 20 | Same structure variable content: 12 | Variable: 6

Creative requirement (20 pts max):
None (classify/route/extract): 20 | Low (template/draft): 14 | Medium (synthesize): 8 | High: 3

Rule-based routing potential (20 pts max):
Perfect rules: 20 | Strong rules with edge cases: 14 | Probabilistic only: 8 | Judgment essential: 3

Source reliability (20 pts max):
email or teams: 20 | document: 14 | meeting: 10

Thresholds: >= 80 prime target | 60-79 good with human-in-loop | < 60 augmentation only

### Value Score (0-100)

Time saved per week (25 pts max):
> 4 hrs: 25 | 2-4 hrs: 20 | 1-2 hrs: 15 | < 1 hr: 8

Participant count (25 pts max):
>= 5 roles: 25 | 3-4 roles: 20 | 2 roles: 12 | 1 role: 5

Cross-org impact (25 pts max):
3+ orgs or external partners: 25 | 2 teams: 16 | 1 team: 8

Quality improvement (25 pts max):
Eliminates known quality failures: 25 | Standardizes inconsistent work: 16 | Speeds good work: 8

### Composite Score

compositeScore = (automationScore + valueScore) / 2

Tier 1 (80-100): Build immediately
Tier 2 (70-79): Build next quarter
Tier 3 (60-69): Monitor and revisit
Tier 4 (< 60): Low priority

### Org-Wide Pattern Threshold

participantCount >= 3 AND compositeScore >= 65 = org-wide pattern.

### Edge Cases

High automation, low value (e.g., broadcast-email-classifier: 92/42 = 67):
Bundle with higher-value skills rather than building standalone.

Low automation, high value (e.g., partner-eval-enablement: 65/88 = 77):
Build as human-in-loop skill. Claude assists rather than fully replaces.

New pattern first cycle: Require 2+ cycles before Tier 1 unless occ >= 10 AND participants >= 4.

Single-source pattern: Apply -5 point composite penalty if only one M365 source with no
corroborating signals from other sources.

---

## Known Patterns Catalog

Updated through Cycle 3. Total: 22 patterns. Org-wide: 21.

---

### Pattern 01: Azure DevOps Notification Triage
ID: task-notification-triage | Category: Notification and Alert Triage | Sources: email
Occurrences/Week: 35 | Participants: 3 | Time: 1.0 hr/week
AutomationScore: 88 | ValueScore: 82 | Composite: 85 — TIER 1
Candidate Skill: task-notification-router | Trend: Rising (30 to 35)
Evidence: Tasks, Requirements, Bugs, Epics for Evals, Coverage, Thresholding, CI, Offline/Online
evals land in inbox. Follow-up in Teams or meetings, not email.
Rationale: Highest-volume, lowest-creativity pattern. Near-perfect rule-based classifier for work tracking tool
notification types. Top-ranked pattern for 3 consecutive cycles. Build this first.

### Pattern 02: Meeting Notes and Action Item Capture
ID: meeting-notes-action-item-capture | Category: Meeting Output Synthesis
Sources: document, meeting, email, teams
Occurrences/Week: 29 | Participants: 4 | Time: 4.75 hrs/week
AutomationScore: 86 | ValueScore: 82 | Composite: 84 — TIER 1
Candidate Skill: meeting-notes-action-extractor | Trend: Rising (12 to 29)
Evidence: Repeated flow across Program X Day, Tiger Team All Hands, eval syncs, customer engagement syncs,
architecture calls, v-team meetings. 4 roles, 4 tools, 1 meeting output done 3 times.
Rationale: Transcript to structured action items is a solved problem for LLMs.

### Pattern 03: VoC Customer Ask Deduplication and Routing
ID: voc-customer-ask-dedup-routing | Category: Notification and Alert Triage
Sources: teams, email
Occurrences/Week: 20 | Participants: 4 | Time: 2.58 hrs/week
AutomationScore: 84 | ValueScore: 78 | Composite: 81 — TIER 1
Candidate Skill: voc-ask-deduplicator | Trend: Rising (5 to 20)
Evidence: Customer asks, duplicate detection, status clarification. Teams to work tracking tool to Teams.
Cycle 3 adds Eval DRI/TPM thread with 15 additional occurrences.
Rationale: Retrieval task. work tracking tool backlog is ground truth for RAG-backed matching.

### Pattern 04: Eval Framework Template and Coverage Model Scaffolding
ID: eval-template-scaffolder | Category: Eval and Quality Workflows
Sources: document, teams
Occurrences/Week: 8 | Participants: 3 | Time: 3.0 hrs/week
AutomationScore: 78 | ValueScore: 84 | Composite: 81 — TIER 1
Candidate Skill: eval-template-scaffolder | Trend: Rising (new Cycle 3)
Evidence: Scenario guides, coverage models, acceptance criteria templates authored independently.
Agent Eval Sets Template (xlsx) and Trajectory evaluation scenarios as parallel reinventions.
Rationale: Multiple people building the same artifact from scratch. Scaffold from agent
description plus domain context instantly standardizes output.

### Pattern 05: External Stakeholder Post-Meeting Recap and Follow-Up
ID: post-meeting-external-followup-drafter | Category: Content Creation and Reuse
Sources: email, meeting
Occurrences/Week: 12 | Participants: 4 | Time: 2.0 hrs/week
AutomationScore: 82 | ValueScore: 78 | Composite: 80 — TIER 1
Candidate Skill: external-meeting-followup-drafter | Trend: Rising (new Cycle 3)
Evidence: Post-meeting summaries to Partner D, Partner A, Partner B, Partner C. Repeated 3-step
workflow: recap email, file share, follow-up scheduling.
Rationale: Every external meeting generates an identical workflow. Strong automation with
careful external tone calibration.

### Pattern 06: Fragmented Action Item Tracking
ID: fragmented-action-item-tracking | Category: Cross-Tool Information Architecture Failures
Sources: teams, meeting, email, document
Occurrences/Week: 12 | Participants: 4 | Time: 2.5 hrs/week
AutomationScore: 76 | ValueScore: 82 | Composite: 79 — TIER 2
Candidate Skill: unified-action-item-tracker | Trend: Rising (new Cycle 3)
Evidence: Action items in meeting notes, Loop tables, emails, Teams, work tracking tool simultaneously.
No single system of record identified across any project.
Rationale: Only pattern spanning all 4 M365 source types. Signals deep structural problem.

### Pattern 07: Agent Eval Analysis and Standardized Reporting
ID: eval-results-analysis-reporting | Category: Eval and Quality Workflows
Sources: document, teams, email, meeting
Occurrences/Week: 25 | Participants: 5 | Time: 5.75 hrs/week
AutomationScore: 72 | ValueScore: 86 | Composite: 79 — TIER 2
Candidate Skill: eval-report-synthesizer | Trend: Rising (17 to 25)
Evidence: 5 roles independently define eval thresholds with no shared standard. Declarative
Agent grounded in 170+ SharePoint sites, Partner C/Partner B/Partner A deep dives.
Rationale: Cross-team comparability currently impossible. Schema enforcement plus LLM analysis
unlocks it and saves 5.75 hrs/week across 5 roles.

### Pattern 08: Meeting Transcript to Loop and PPT Pipeline
ID: transcript-to-loop-ppt-pipeline | Category: Meeting Output Synthesis
Sources: meeting, document, teams
Occurrences/Week: 10 | Participants: 4 | Time: 2.0 hrs/week
AutomationScore: 80 | ValueScore: 76 | Composite: 78 — TIER 2
Candidate Skill: meeting-summary-publisher | Trend: Rising (new Cycle 3)
Evidence: Multiple people independently summarizing same transcript for large meetings
(20-200 participants). Program X Camp, Tiger Team All Hands.
Rationale: Multi-person duplication at large-meeting scale. One authoritative synthesis
per meeting eliminates the multiplier effect.

### Pattern 09: Partner and Customer Eval Enablement Session Coordination
ID: partner-eval-enablement-meetings | Category: Eval and Quality Workflows
Sources: meeting, email, document
Occurrences/Week: 12 | Participants: 4 | Time: 10.0 hrs/week
AutomationScore: 65 | ValueScore: 88 | Composite: 77 — TIER 2
Candidate Skill: partner-eval-enablement-pack-generator | Trend: Rising (new Cycle 3)
Evidence: 30-60 min sessions with Partner A, Partner B, Partner C for agent eval tooling, grounding
deep dives. Largest absolute time sink in catalog at 10 hrs/week.
Rationale: Enablement content is highly repetitive. Customized pack generator shifts meetings
to async self-service. Human-in-loop because partner customization requires judgment.

### Pattern 10: Weekly Project Status Report Generation
ID: weekly-status-report-generation | Category: Content Creation and Reuse
Sources: document, email
Occurrences/Week: 4 | Participants: 3 | Time: 0.75 hrs/week
AutomationScore: 80 | ValueScore: 74 | Composite: 77 — TIER 2
Candidate Skill: weekly-status-report-generator | Trend: Stable
Evidence: Weekly Loop status reports follow rigid highlights/lowlights/milestones/work-items
structure, one per project per week.
Rationale: Highly structured template plus known data sources. Stable pattern = reliable build.

### Pattern 11: Cross-Tool Issue Thread Fragmentation and Context Loss
ID: cross-tool-context-fragmentation | Category: Cross-Tool Information Architecture Failures
Sources: teams, email, document, meeting
Occurrences/Week: 18 | Participants: 4 | Time: 6.0 hrs/week
AutomationScore: 72 | ValueScore: 80 | Composite: 76 — TIER 2
Candidate Skill: knowledge-context-consolidator | Trend: Rising (new Cycle 3)
Evidence: Email raises issue, meeting scheduled, doc created, link in Teams, follow-up email
references doc. People re-ask already-answered questions across eval tooling, architecture,
customer escalations.
Rationale: Structural M365 fragmentation problem. Consolidation skill prevents re-asking loop.

### Pattern 12: Action Item Owner Chasing and Status Follow-Up
ID: action-owner-chasing | Category: Knowledge Work Coordination | Sources: teams
Occurrences/Week: 12 | Participants: 3 | Time: 2.0 hrs/week
AutomationScore: 74 | ValueScore: 78 | Composite: 76 — TIER 2
Candidate Skill: action-owner-nudge-bot | Trend: Rising (new Cycle 3)
Evidence: Scheduling follow-ups, chasing owners, re-posting links. 3 roles consistently.
Rationale: Given open items and owners, generate polite follow-up per owner. High frequency
plus clear structure equals strong automation candidate.

### Pattern 13: Recurring Meeting Agenda Preparation
ID: recurring-meeting-agenda-generator | Category: Content Creation and Reuse
Sources: meeting, document, teams
Occurrences/Week: 10 | Participants: 6 | Time: 4.42 hrs/week
AutomationScore: 76 | ValueScore: 74 | Composite: 75 — TIER 2
Candidate Skill: recurring-agenda-generator | Trend: Rising (5 to 10)
Evidence: Weekly v-team, ROB prep, Project Alpha, standup, Program X CEMS. Stable attendees.
Rationale: Agenda structure never changes; items come from work tracking tool and prior notes. Highest
participant count in catalog (6 roles).

### Pattern 14: Access Governance and Compliance Alert Triage
ID: access-governance-alert-classifier | Category: Notification and Alert Triage
Sources: email
Occurrences/Week: 7 | Participants: 3 | Time: 0.33 hrs/week
AutomationScore: 88 | ValueScore: 54 | Composite: 71 — TIER 2
Candidate Skill: access-governance-alert-router | Trend: Rising (new Cycle 3)
Evidence: GitHub repo admin grants/revocations, Purview DLP alerts.
Rationale: Very high automation ceiling but modest time savings. Bundle with work tracking tool notification
router as a secondary classifier.

### Pattern 15: Training and Hackathon Event Artifact Coordination
ID: training-event-artifact-coordinator | Category: Content Creation and Reuse
Sources: meeting, teams, document
Occurrences/Week: 23 | Participants: 6 | Time: 23.75 hrs/week
AutomationScore: 58 | ValueScore: 82 | Composite: 70 — TIER 2
Candidate Skill: event-artifact-coordinator | Trend: Rising (15 to 23)
Evidence: Program X Camp: decks, Loop pages, GitHub repos, breakout scheduling. 20-200 attendees.
Rationale: Very high time cost but moderate automation. Human-in-loop skill for artifact
aggregation and breakout group status tracking.

### Pattern 16: Redundant One-Off Deck Creation for Overlapping Topics
ID: redundant-deck-creation | Category: Content Creation and Reuse | Sources: document
Occurrences/Week: 5 | Participants: 3 | Time: 5.0 hrs/week
AutomationScore: 62 | ValueScore: 80 | Composite: 71 — TIER 2
Candidate Skill: deck-content-reuse-advisor | Trend: Rising (new Cycle 3)
Evidence: Decks for eval guidance, enablement, architecture, customer stages forked repeatedly.
Rationale: Waste is in creation, not content. Detect existing decks and surface reusable clusters.

### Pattern 17: Last-Minute Review Deck and Doc Maintenance Before ROBs
ID: review-prep-deck-maintenance | Category: Content Creation and Reuse
Sources: document, meeting
Occurrences/Week: 5 | Participants: 3 | Time: 4.0 hrs/week
AutomationScore: 68 | ValueScore: 74 | Composite: 71 — TIER 2
Candidate Skill: review-deck-prep-assistant | Trend: Rising (new Cycle 3)
Evidence: Permission blocks, parallel edits, last-minute updates before ROBs. 2026-03 MER PPTX.
Rationale: 4 hrs/week mostly wasted on permission issues and stale data. Pre-review checklist
skill eliminates the scramble.

### Pattern 18: Operational FYI Broadcast Email Classification
ID: broadcast-email-classifier | Category: Notification and Alert Triage | Sources: email
Occurrences/Week: 12 | Participants: 1 | Time: 0.92 hrs/week
AutomationScore: 92 | ValueScore: 42 | Composite: 67 — TIER 3
Candidate Skill: broadcast-email-classifier | Trend: Stable
Evidence: Viva Engage, Daily Digest, surveys, roadmap updates, Copilot Tasks announcements.
Rationale: Perfect automation ceiling but single-person scope. Bundle into inbox-triage-suite.

### Pattern 19: Ownership Routing and DRI Lookup
ID: ownership-routing-assistant | Category: Knowledge Work Coordination
Sources: teams, email
Occurrences/Week: 16 | Participants: 4 | Time: 2.33 hrs/week
AutomationScore: 74 | ValueScore: 62 | Composite: 68 — TIER 3
Candidate Skill: ownership-routing-assistant | Trend: Rising (4 to 16)
Evidence: People ask who owns given area, API, workstream. One person acting as connector.
Rationale: Good candidate contingent on DRI registry quality. Build after action-owner-chasing.

### Pattern 20: Copilot and Agent Platform Architecture Q and A
ID: copilot-platform-faq-responder | Category: Eval and Quality Workflows
Sources: teams, meeting, email
Occurrences/Week: 11 | Participants: 5 | Time: 3.25 hrs/week
AutomationScore: 62 | ValueScore: 74 | Composite: 68 — TIER 3
Candidate Skill: copilot-platform-faq-responder | Trend: Stable
Evidence: Recurring architecture questions, eval tooling threads (declarative agents, grounding).
Rationale: Requires RAG over documentation. Build after higher-priority skills are shipped.

### Pattern 21: Escalation and Follow-Up Email Drafting
ID: escalation-email-drafter | Category: Content Creation and Reuse | Sources: email
Occurrences/Week: 8 | Participants: 4 | Time: 1.58 hrs/week
AutomationScore: 70 | ValueScore: 60 | Composite: 65 — TIER 3
Candidate Skill: escalation-email-drafter | Trend: Rising (2 to 8)
Evidence: Externally-facing escalation emails. Context recap, specific ask, urgency signal.
Rationale: Consider merging with post-meeting-external-followup-drafter. Tone calibration
required lowers automation ceiling.

### Pattern 22: Feature Flags Flights and Rollout Unblocking Guidance
ID: feature-flag-rollout-runbook-assistant | Category: Knowledge Work Coordination | Sources: teams
Occurrences/Week: 5 | Participants: 3 | Time: 0.83 hrs/week
AutomationScore: 60 | ValueScore: 68 | Composite: 64 — TIER 3
Candidate Skill: feature-flag-rollout-runbook-assistant | Trend: Stable
Evidence: Repeated Teams requests for Feature Flags flight unblocking. Known runbook patterns exist.
Rationale: Codify the runbook first, then build the interactive walkthrough skill.

---

## Skill Candidate Generation

### Promotion Criteria

All of the following must be true:
1. compositeScore >= 70
2. participantCount >= 3 (org-wide) or justified individual value documented
3. Appeared in at least 1 cycle (2+ cycles preferred)
4. At least 2 of: frequency >= 5/week, time >= 1 hr/week, cross-source evidence, rising trend

### Output Format

```json
{
  "rank": 1,
  "patternId": "pattern-slug",
  "compositeScore": 85,
  "automationScore": 88,
  "valueScore": 82,
  "name": "kebab-case-skill-name",
  "description": "What it takes as input, what it produces, what problem it solves.",
  "triggerExamples": [
    "Concrete user request that should invoke this skill",
    "Another concrete trigger phrased as a user would say it",
    "Third trigger example from a different angle"
  ],
  "valueProposition": "Specific time saved, roles benefited, quality improvement enabled."
}
```

### Naming Conventions

Use kebab-case. End with action verb suffix:
-router, -extractor, -synthesizer, -generator, -tracker, -drafter, -scaffolder, -publisher,
-consolidator, -advisor

Name describes what it DOES, not what it IS.
Good: eval-template-scaffolder | Bad: eval-skill or eval-helper

### Bundling Rules

Bundle into one skill when two patterns share the same input type, both score 70-75, or one
is a subset of the other.

Examples:
broadcast-email-classifier + task-notification-router -> inbox-triage-suite
escalation-email-drafter + post-meeting-external-followup-drafter -> external-communication-assistant

---

## Trigger Examples

Invoke this skill when:

1. WorkIQ results available: "I ran WorkIQ and got back a summary of my last 7 days of M365 activity. What patterns do you see?"
2. Pattern discovery request: "Analyze my email, Teams, and meetings for repetitive work patterns that Claude could automate."
3. Skill building planning: "What are the top 5 Claude skills I should build based on how my team actually works?"
4. Time audit: "Where is my team spending the most time on repetitive, low-creativity tasks that AI could handle?"
5. Signals file provided: "Here is my signals.json from WorkIQ — update the patterns catalog and tell me what is new."
6. Specific source: "Look at just my email patterns from the last month — what recurring workflows do you see?"
7. ROI justification: "I need to pitch building AI skills to leadership. What is the M365 evidence?"
8. Trend check: "What patterns are rising vs. stable vs. declining this cycle compared to last cycle?"
9. Category-specific: "What meeting-related patterns exist that could be automated?"
10. Partner focus: "We work with external partners on eval enablement. What patterns do you see?"

Do NOT invoke for:
- "Help me write an email" — single drafting task, not pattern detection
- "What is on my calendar today?" — scheduling query, not pattern detection
- "Summarize this document" — single-task execution, not pattern analysis
- "Who owns the eval system?" — ownership lookup, not pattern detection

---

## Refinement History

### Cycle 1 — Initial Pattern Discovery
Date: 2026-03-19 | Patterns Created: 12

Created first 12 patterns from initial M365 signal harvest.
work tracking tool notification triage identified as highest-volume automation target (30/week).
10 of 12 patterns had participantCount >= 3 from the start.
automationScore and valueScore weights defined. compositeScore formula established.
Tier 1-4 classification introduced. Key insight: Email is most reliable for frequency counting.

### Cycle 2 — Signal Expansion
Date: 2026-03-19 | Signals Captured: 29 | SKILL.md: Not yet created

29 signals captured (email 7, meeting 7, teams 8, document 7).
Cross-team WorkIQ query introduced: "What tasks do multiple people do independently?"
This query is the most productive for org-wide pattern discovery. Run it every cycle.
8 of 12 existing patterns reinforced confirming persistence.
10 new pattern signals identified. Largest time sink: partner eval enablement at 10 hrs/week.
Key finding: fragmented-action-item-tracking spans all 4 M365 source types simultaneously.

### Cycle 3 — First SKILL.md Creation and Major Catalog Expansion
Date: 2026-03-19 | Patterns Total: 22 | Version: 1.0

SKILL.md created for first time incorporating all learning from Cycles 1 and 2.

10 new patterns added:
cross-tool-context-fragmentation (76), post-meeting-external-followup-drafter (80),
access-governance-alert-classifier (71), action-owner-chasing (76), eval-template-scaffolder (81),
redundant-deck-creation (71), review-prep-deck-maintenance (71),
partner-eval-enablement-meetings (77), transcript-to-loop-ppt-pipeline (78),
fragmented-action-item-tracking (79)

Patterns: 12 to 22 (83% growth). Org-wide patterns: 10 to 21.
Trend tracking introduced. 8 existing patterns marked rising.
Source reliability ranking formalized.
6-category taxonomy created and documented with real examples.
Category 6 Cross-Tool Information Architecture Failures introduced — entirely new, not in Cycle 1.
Score updates for 7 existing patterns. Bundling rules added. Edge case scoring rules added.

Key insights from Cycle 3:
1. Cross-team WorkIQ query is significantly more productive than individual activity queries.
2. task-notification-triage has been top-ranked for 3 consecutive cycles. Build it first.
3. partner-eval-enablement-meetings is largest time sink (10 hrs/week) but automation only 65 — human-in-loop priority.
4. fragmented-action-item-tracking is only pattern spanning all 4 M365 source types — deep structural problem signal.
5. 3 of the 5 Tier 1 patterns were invisible in Cycle 1 but obvious in Cycle 2. Multi-cycle analysis is essential.

Future priorities for Cycle 4:
- Validate whether escalation-email-drafter and post-meeting-external-followup-drafter should merge
- Track whether partner-eval-enablement-meetings time stays at 10 hrs/week
- Add SharePoint as a distinct signal source separate from document
- Add confidenceScore field tracking how many cycles have confirmed each pattern
- Add skillComplexityScore field to help prioritize build order by engineering effort
- Investigate proactive detection of transcript-to-loop-ppt-pipeline before duplication occurs
