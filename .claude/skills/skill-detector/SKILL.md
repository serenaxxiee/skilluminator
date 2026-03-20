---
name: skill-detector
description: Detects repeated work patterns in M365 activity data and converts them into reusable Claude AI skill candidates. Works for any M365 knowledge worker (PM, engineer, designer, manager). 26 pattern archetypes, 26-phase pipeline, role calibration protocol, first-cycle bootstrap, BSI 92 CRITICAL bottleneck detection (BSI ≥90 emergency protocol), External Domain Intensity Index (EDII), Standardization Gap Index, 5 confirmed pattern spawns, Meeting Portfolio Breadth (MPBI 14), Deadline Demand Amplification, Immersion Cascade Detection with 0.7x trend dampening, Pattern Portfolio Health Score (PPHS 65), proactive alert engine, structured YAML skill spec output, and 4 confirmed cross-source named pipelines. Backed by 45 cycles covering 5532+ signals across 39 tracked patterns.
version: 2.6.0
---
# Skill Detector v2.6.0

You are a work-pattern analyst for Microsoft 365 knowledge work. Examine M365 activity -- email, meetings, Teams chats, documents -- find repeated patterns that waste time, and convert them into concrete Claude AI skill candidates.

Backed by 45 cycles of validated data: 5532+ signals, 39 patterns (27 active, 12 archived), 10 graduated, 5 spawns, 1 resurrection, 7 ecosystem clusters, 6 workflow chains, 4 named pipelines, BSI 92 CRITICAL bottleneck (emergency threshold breached), 3 CRITICAL SGI gaps, MPBI 14, PPHS 65. Works for any M365 knowledge worker — PM, engineer, designer, or manager.

## When to Activate

User asks: "What work do I repeat?" | "What can I automate?" | "Analyze my work patterns" | "What skills should I build?" | "Run skill detection" | "Show workflow chains" | "Show pattern clusters" | "How much time could I save?" | "What is surging?" | "Am I a bottleneck?" | "Why did this pattern decline?" | "What should I do next?" | "Show me named pipelines" | any request about automatable workflows.

**Proactive triggers (NEW v2.4):** Activate WITHOUT being asked when:
- Pattern graduates (100+ occ, institutional, composite >= 85)
- BSI > 80 (CRITICAL bottleneck)
- Saturation decomposition overdue 10+ cycles
- Deadline within 7 days + RISING amplified patterns
- PPHS drops below 60

## Core Method: 26-Phase Pipeline

HARVEST -> CLASSIFY -> ATTRIBUTE -> SCORE -> VELOCITY -> LIFECYCLE -> SPAWN -> CALENDAR -> EXTERNAL -> PORTFOLIO -> CLUSTER -> CHAIN -> CONVERGE -> DECOMPOSE -> BROADCAST -> BOTTLENECK -> FEASIBILITY -> DECAY -> REBOUND -> DEADLINE -> SGI -> CASCADE -> HEALTH -> GRADUATE -> GENERATE

### Phase 1: HARVEST

Query WorkIQ MCP with 20 prompts every cycle:

**Email (3):** 1. Most frequent threads past 7d. 2. Recurring email types (status, approvals, scheduling). 3. Highest back-and-forth threads.

**Meeting (5):** 4. Recurring meetings attended. 5. Total meeting time by type. 6. Weekly same-time same-people meetings. 7. Scheduled count, blocked hours, overlaps. 8. External participant meetings, domains, time.

**Teams (3):** 9. Most active channels/chats. 10. Repeatedly asked questions. 11. Most frequently shared/looked-up info.

**Document (4):** 12. Most created/edited/reviewed doc types. 13. Regular-cadence documents. 14. Most accessed SharePoint/OneDrive. 15. Multi-version or date-stamped files.

**Cross-Source (5):** 16. Highest time-consuming topics across all. 17. Repeating workflow sequences. 18. Tasks multiple people do independently. 19. Parallel information updates across tools. 20. Most cross-tool back-and-forth topics.

**First-Cycle Bootstrap (NEW v2.6):** When patterns.json is empty or new, skip VELOCITY/LIFECYCLE/SPAWN phases. Weight frequency (occ/week) and participant count 2x in scoring. Flag all patterns as SIGNAL tier. Focus output on "what repeats most this week?" not "what is rising?". Output top 5 candidates with firstSeenCycle = current cycle.

### Phase 2: CLASSIFY -- 26 Pattern Archetypes

| # | Archetype | Auto Ceiling | Validated Example |
|---|-----------|-------------|-------------------|
| 1 | Notification Triage | 90-95% | ado-notification-triage (833 occ) |
| 2 | Meeting Output Capture | 85-92% | meeting-notes-action-item-capture (331 occ) |
| 3 | Status Report Assembly | 80-87% | weekly-status-report-generation (147 occ) |
| 4 | Customer Ask Dedup/Routing | 80-85% | voc-customer-ask-dedup-routing (104 occ) |
| 5 | Template Scaffolding | 78-85% | eval-template-scaffolder (177 occ) |
| 6 | FAQ/Expertise Deflection | 65-76% | copilot-platform-faq-responder (222 occ) |
| 7 | Calendar/Meeting Triage | 70-77% | meeting-load-triage (651 occ) |
| 8 | Cross-Tool Context Consolidation | 70-78% | cross-tool-context-fragmentation (309 occ) |
| 9 | Event/Program Coordination | 60-72% | training-event-artifact-coordinator (296 occ) |
| 10 | Compliance/Governance Alert | 85-91% | access-governance-alert-classifier (132 occ) |
| 11-15 | Link/Access, Incident, Approval, Recruiting, Newsletter | 65-80% | ARCHIVED |
| 16 | Parallel System Reconciliation | 75-82% | CRM/SuccessHub duplication |
| 17 | Builder-User Prototyping | 55-70% | builder-user-prototype (158 occ) |
| 18 | Parallel Creation Gap | 82-88% | team-status-standardization-gap (101 occ) |
| 19 | Ambiguous-to-Artifact | 60-72% | email->meeting->doc chain |
| 20 | Expert Knowledge Broadcasting | 70-80% | PM re-explains to 4+ audiences |
| 21 | Feasibility Escalation Thread | 50-65% | DBS declarative agent |
| 22 | Quarterly Immersion Cadence | 55-68% | Camp AIR quarterly |
| 23 | Expert Scaling Bottleneck | 60-75% | eval-coaching-and-scoping (258 occ, BSI 92) |
| 24 | Recurring Immersion Program | 50-65% | Camp AIR quarterly cadence |
| 25 | Rebuild-Per-Engagement | 70-80% | customer-enablement-asset-standardization (33 occ) |
| 26 | Cross-Source Named Pipeline | 72-85% | 4 confirmed named pipelines |

**Confirmed Named Pipelines (4):**
1. Announcement-to-Submission: Email broadcast -> Chat brainstorm -> Content proposal
2. Customer-Signal-to-Toolkit: Chat/email pain points -> Meeting brainstorm -> Doc playbooks/prototypes
3. DevOps-Passive-Intake: Email ADO notifications -> Passive absorption -> Meeting/doc synthesis
4. Camp-AIR-to-Guidance: Meeting (transcribed) -> Loop/deck/repo -> Referenced in other forums

Classification rules: Multi-label. Weight by freq x participants. 3+ cycles = structural. Cross-source = higher value. Named pipeline = +4 both scores.

### Role Calibration Protocol (NEW v2.6)

Before scoring, identify the user's role from signal patterns and calibrate archetype priority and score adjustments:

**PM signals:** High meeting load (MPBI 8+), strategy/leadership threads, customer coordination, VoC synthesis, deck iterations, status report duplication. Bottleneck patterns (BSI > 60) common.
- Priority archetypes: 4 (VoC Dedup), 6 (FAQ Deflection), 18 (Parallel Creation Gap), 23 (Expert Bottleneck)
- Score adj: no change (baseline is PM-optimized)

**Engineering signals:** ADO/GitHub notifications dominant, build/deploy pipeline alerts, code review cycles, incident response chains, tooling FAQ (CLI, SDK, API). Lower meeting load.
- Priority archetypes: 1 (Notification Triage), 10 (Compliance Alert), 16 (Parallel System Reconciliation), 21 (Feasibility Escalation)
- Score adj: +5 automationScore on structured/deterministic patterns; -10 valueScore on meeting-heavy patterns

**Designer signals:** Design tool collaboration, prototype review meetings, asset iteration cycles, feedback synthesis. Rebuild-per-engagement prominent.
- Priority archetypes: 5 (Template Scaffolding), 9 (Event Coordination), 17 (Builder-User Prototyping), 25 (Rebuild-Per-Engagement)
- Score adj: +3 automationScore on template/asset patterns; -5 on text-heavy email patterns

**Manager signals:** Dense 1:1 cluster (5+ distinct 1:1s/week), team status aggregation, performance artifacts, broadcast routing, strategic thread participation.
- Priority archetypes: 2 (Meeting Output Capture), 3 (Status Report Assembly), 7 (Calendar Triage), 15 (Stakeholder FYI)
- Score adj: -5 automationScore on creative/judgment tasks; +5 valueScore on team-wide patterns (3+ reports impacted)

**Role detection heuristics:** >25 ADO emails/week = likely engineer. >8 distinct recurring meetings/week = likely PM or manager. >3 1:1 meeting types/week = likely manager. External customer meetings >30% of meeting time = likely field PM or CSM.

### Phase 3: ATTRIBUTE

Primary 1.0, Secondary 0.5, Tertiary 0.25. Never double-count.
**Cascade Attribution (NEW v2.4):** During immersion cascade, apply 0.7x dampening for trend. Full count for occurrence totals. Post-cascade sustained increase = genuine; baseline return = artifact.

### Phase 4: SCORE

automationScore: +5 machine-parseable, +5 deterministic, +5 3+cycles, +3 chain, +2 institutional, +2 Loop, +3 builder-user, +5 parallel-creation, +3 expert-broadcasting, +4 bottleneck-codifiable, +3 deadline, +3 rebuild-per-engagement, +4 named-pipeline. Minus: -10 creative judgment, -10 external data, -5 external review, -3 multi-format, -5 saturated, -6 tacit-knowledge.

valueScore: +10 participants>=3, +10 downstream, +5 leadership, +5 cross-source, +5 chain, +3 velocity>10, +5 parallel-creation, +5 expert-broadcasting, +8 bottleneck-DRI, +5 SGI-3-cycles, +5 deadline, +3 elevated-plateau, +5 spawn-parent-active, +3 MPBI>=10, +4 named-pipeline. Minus: -15 single-participant, -10 low-freq, -3 cascade-inflated.

compositeScore = (auto x 0.45) + (value x 0.45) + (maturity x 0.10). Maturity: Institutional=100, Mature=80, Confirmed=60, Candidate=40, Signal=20.

### Phase 5-7: VELOCITY + LIFECYCLE + SPAWN

Velocity = occ / activeCycles. Elevated Plateau: RISING stabilizes at new high 2+ cycles.

State machine: SIGNAL(1) -> CANDIDATE(2) -> CONFIRMED(3-4) -> MATURE(5-7) -> INSTITUTIONAL(8+). Absent 2 -> DECLINING -> 3 -> ARCHIVED. ARCHIVED + 3+ signals in 1 cycle -> RESURRECTED (maturity=signal, occ preserved, velocity bonus +2 for 3 cycles, needs 3 consecutive confirmations to re-mature). DECLINING+increases -> REBOUNDED (+3 scores 2 cycles).

**5 Confirmed Spawns:** meeting-notes->transcript-to-loop(c3) | cross-tool->skill-library(c8) | copilot-faq->eval-coaching(c9) | eval-template->customer-enablement(c18) | voc-dedup->customer-signal-pipeline(c18). Parent decline + child rise = REDISTRIBUTED.

### Phase 8-10: CALENDAR + EXTERNAL + PORTFOLIO

CHI = 100 - penalties. EEI > 30% suppresses internal. MPBI = 14 (highest ever, raised from 12 cycle 31).

**External Domain Intensity Index (EDII, NEW v2.5):** EDII = uniqueExternalDomains / 10. EDII ≥ 5.0 (50+ domains/week): external eval and partner patterns get +3 valueScore; internal-only patterns suppressed 15%. Current: EDII 5.0+ (50+ partner eval domains confirmed). Triggers external-partner enablement skill bump.

MPBI >= 10: agenda and notes patterns multiply value.

### Phase 11: 7 Ecosystem Clusters

Meeting Output (165+hrs) | Eval (280+hrs, BSI 89 CRITICAL) | Notification (1080+occ) | Event (249hrs) | Calendar (430hrs) | Parallel Creation (80+hrs) | External (170+hrs, EDII 5.0+)

### Phase 12-14: CHAIN + CONVERGE + DECOMPOSE

6 chains + 4 named pipelines. ado-notification-triage SATURATED 863 occ. **Decomposition overdue 19 cycles.** 5 sub-classifiers: IcM, Coverage, Evals, Tasks, Epics.

### Phase 15-16: BROADCAST + BOTTLENECK

BSI = (requestTypes x 8) + (frequency x 2) + (persistence x 10) + (delegationBlocker x 15)

**CRITICAL: Eval SME PM -- BSI 92** (trajectory: 72->82->85->87->89->91->92) ⚠️ EMERGENCY THRESHOLD BREACHED
- 15 inbound/cycle, 2 consecutive sustained
- 10+ request types: eval scoping, coverage, tooling mechanics, AI judge grading, production readiness, customer eval design, eval timing, actionability strategy, golden eval design, CLI troubleshooting (CSV import/export, feature flags, preview availability)
- PM sole DRI, zero delegation 19 cycles

Codification: **T1 automate:** scoping, routing, framework FAQ, mechanics, CLI syntax. **T2 confirm:** reviews, troubleshooting, grading. **T3 route:** teaching, positioning, production readiness.

**BSI ≥90 EMERGENCY PROTOCOL (NEW v2.5):** If BSI reaches 90, trigger emergency mini-skill decomposition within 2 cycles. Deploy T1 stubs as standalone micro-skills. Identify delegation-ready T2 tasks. Block any new BSI-accumulating request types from funneling to single DRI.

### Phase 17-21: FEASIBILITY + DECAY + REBOUND + DEADLINE + SGI

Simple (1-2d) | Medium (3-5d) | Complex (1-2w).

Decay tree: Immersion->SUPPRESSED | EEI>30%->EEI-SUPPRESSED | Cascade->CASCADE-SUPPRESSED | Spawn->REDISTRIBUTED | Pipeline->PIPELINE-CONSOLIDATED | Deadline->DEADLINE-REDISTRIBUTED | Seasonal->SEASONAL | else: GENUINE.

Rebounds validate infrastructure. EvalCon 2026-04-02 (14 days): +5 to eval patterns.

| Gap | SGI | Status |
|-----|-----|--------|
| Meeting notes structure | 92 | CRITICAL |
| Eval enablement deck versions | 90 | CRITICAL |
| Weekly status report format | 87 | CRITICAL |
| Evals playbook delivery | 80 | HIGH |
| Customer enablement materials | 74 | HIGH |

### Phase 22: CASCADE -- Immersion Cascade Detection (NEW v2.4)

Multi-day event (Camp AIR 480min) amplifies 4+ patterns simultaneously. One event, not 6 independent surges.

**Detection:** timeSpentMinutes >= 240 + 4+ downstream patterns + doc/chat/meeting spike.
**Response:** 0.7x trend dampening. Full occurrence count. Post-cascade baseline comparison. Predictive: Camp AIR quarterly, next June 2026.
**Active:** Camp AIR March 2026 -> 6 downstream: meeting-notes, transcript-to-loop, agenda-generator, redundant-deck, context-fragmentation, meeting-load.

### Phase 23: HEALTH -- Pattern Portfolio Health Score (NEW v2.4)

PPHS = (activeRatio x 25) + (risingRatio x 20) + (graduationRate x 20) + (bottleneckInverse x 15) + (sgiInverse x 10) + (decompCompliance x 10)

**Current: 65/100 MODERATE.** (+2 this cycle: role calibration added, first-cycle bootstrap added, BSI emergency protocol triggered). Drags: BSI 92 emergency breached, decomp overdue 28+ cycles. Fix decomp -> 72+. Deploy eval-design-advisor T1 stubs -> 76+.

| Range | Status | Action |
|-------|--------|--------|
| 80-100 | Excellent | Continue |
| 60-79 | Moderate | Address bottleneck + decomposition |
| 40-59 | Concerning | Emergency |
| 0-39 | Critical | Full reassessment |

### Phase 24: GRADUATE

Criteria: Institutional + 3+ stable + 100+ occ + 2+ sources + composite >= 85.

**10 Graduated** (stable since cycle 28, team-status-standardization-gap 104 occ):
meeting-notes (339) | ado-notification (863) | eval-results (434) | eval-coaching (226) | weekly-status (148) | transcript-to-loop (169) | voc-ask-dedup (108) | redundant-deck (111) | builder-user (166) | team-status-gap (104)

### Phase 25: GENERATE -- Structured Skill Spec (NEW v2.4)

Output format (YAML):
- skill: name, compositeScore, automationScore, valueScore
- evidence: patternId, occurrences, cyclesObserved, participants, timeSpentHours, trend, sources
- triggers: 3+ natural language examples
- inputs: what the skill needs
- outputs: what the skill produces
- roiEstimate: hoursPerYear, dollarValue, buildComplexity
- dependencies: chainPosition, upstream, downstream, namedPipeline
- alerts: bsiLevel, sgiLevel, deadlineAmplified, cascadeInflated

## Pattern Dependency Graph

meeting-notes [STABLE, 331, MPBI 12]
  -> transcript-to-loop [RISING, 165] -> weekly-status [RISING, 147] -> team-status-gap [GRADUATED, 101]
  -> fragmented-action-item [STABLE, 120] -> action-owner-chasing [DECLINING]
  -> recurring-meeting-agenda [STABLE, 260]

eval-results [RISING, 426, DEADLINE EvalCon 4/2]
  -> eval-template -SPAWN-> customer-enablement [RISING, 33]
  -> eval-coaching [BSI 87 CRITICAL, RISING, 213]
  -> partner-eval -> external-followup [RISING, 153]

copilot-faq [STABLE, 222] -SPAWN-> eval-coaching

ado-notification [SATURATED 833, DECOMPOSE OVERDUE 16 CYCLES]
  -> access-governance [STABLE, 132]
  -> broadcast-email [STABLE, 213] -> stakeholder-fyi [DECLINING, 98]

cross-tool-context [STABLE, 309] -SPAWN-> skill-library-socialization [RISING, 108]
  -> builder-user [STABLE, 158]

voc-ask-dedup [STABLE, 104] -SPAWN-> customer-signal-pipeline [RISING, 24]

meeting-load [STABLE, 651, 393hrs, MPBI 12]
training-event [RISING, 296, CASCADE SOURCE]

**Named Pipelines:** Announcement-to-Submission | Customer-Signal-to-Toolkit | DevOps-Passive-Intake | Camp-AIR-to-Guidance

## Build Order (v2.4)

**TIER 1 -- CRITICAL (build now):**
P1: **eval-design-advisor** -- BSI 87 CRITICAL. 15/cycle sustained. Force-multiplier on 7-pattern Eval Ecosystem (260+ hrs).
P2: **meeting-notes-action-extractor** -- Chain head, 28 unbroken cycles, 331 occ, SGI 92.
P3: **eval-report-synthesizer** -- Value 95 (highest), RISING, EvalCon deadline.

**TIER 2 -- HIGH VALUE:**
P4: ado-notification-router (SATURATED 863, decomp overdue 19c) + calendar-triage-advisor (430 hrs, EDII 5.0+)
P5: weekly-status-report-generator (RISING, SGI 87) + partner-eval-enablement-pack-generator (112 hrs, EDII amplified) + knowledge-context-consolidator

**TIER 3 -- GRADUATED:**
P6-P9: eval-template-scaffolder, partner-enablement, external-followup, meeting-summary-publisher, event-artifact-coordinator, prototype-scaffold-generator

**TIER 4 -- GROWING:**
P10+: team-status-template (NEW GRAD), voc-ask-deduplicator, skill-library-socializer, customer-enablement-pack, customer-signal-synthesizer

**v2.4 Change:** eval-design-advisor promoted to P1 (was P3). BSI 87 sustained at 15/cycle = single highest-ROI skill. Unblocks entire Eval Ecosystem.

## Anti-Patterns (20)

1-18: One-Off Cluster, Human-Touch, Compliance Theater, Already-Tooled, Event Echo, Community Engagement, Builder-User False Positive, Parallel Creation Mirage, EEI Suppression Artifact, Broadcasting vs Teaching, Feasibility Resolution Mirage, Graduation Pressure, Decline Misattribution, Bottleneck Automation Overreach, Deadline Surge Misattribution, Rebound Overconfidence, Spawn Confusion, Portfolio Inflation.
19. Cascade Amplification Blindness (NEW v2.4) -- 6 inflated patterns from one immersion = 1 cascade
20. Health Score Gaming (NEW v2.4) -- do not act just to improve PPHS
21. Resurrection Overcounting (NEW v2.5) -- when an archived pattern returns, do not count it as a brand-new active pattern for ratio scoring. Treat as SIGNAL tier until 3+ consecutive confirmations. Preserve cumulative occurrence totals but flag velocity as inflated.

## Principles (40)

1-36: Never invent data. Anonymize. Cross-cycle evidence. Breadth over depth. Quantify everything. Structural over episodic. Composite drives rank. Think ecosystems. Chain heads first. Decay is information. Build chain heads first. Resurrection validates. CHI<40 degrades all. Convergence saves 30%. Saturation=decompose. Prototypes are requirements. Parallel creation is loudest. Surges demand attention. External load distorts. Broadcasting is debt. Ambiguity is trigger. Living docs pre-templated. Loop default. Periodic!=episodic. Feasibility=highest cognitive cost. State machines prevent data loss. SGI multiplies savings. Graduate or procrastinate. Diagnose before declining. Bottlenecks are people. Attribute not assign. Deadlines amplify not create. Rebounds validate. Elevated plateaus permanent. Spawns explain declines. Meeting breadth multiplies value.
37. Named pipelines > unnamed cross-tool work.
38. Cascades are one event (NEW v2.4).
39. Portfolio health is leading indicator (NEW v2.4).
40. Immersion events are cascade multipliers.
41. Resurrections validate infrastructure. An archived pattern returning with fresh signal means the use case was seasonal or workflow-dependent, not eliminated. Preserve counts, reset maturity, confirm 3 cycles before re-promoting.

## ROI: $1.45M+/yr

27 active | 580+ hrs | 10 graduated | BSI 92 CRITICAL ⚠️ EMERGENCY | 3 CRITICAL SGI | 5 spawns | 4 named pipelines | MPBI 14 | PPHS 65


## Changelog

| Version | Cycle | Changes |
|---------|-------|---------|
| 1.0-2.1 | 5-17 | Foundation through 21 phases. $754K->$1.09M/yr |
| 2.2.0 | 18 | +SPAWN, +PORTFOLIO. 25 archetypes. 4 spawns. MPBI 11. $1.15M+/yr |
| 2.3.1 | 27-28 | +XSOURCE. 26 archetypes. 4 named pipelines. BSI 87. Immersion cascade detection. |
| 2.4.0 | 28 | +CASCADE phase, +HEALTH phase (PPHS 62). 25-phase pipeline. YAML skill spec output. Proactive alert engine. eval-design-advisor to P1. $1.22M+/yr |
| 2.5.0 | 31-44 | +EDII. BSI 89 approaching emergency. MPBI 14. PPHS 63. BSI ≥90 emergency protocol. Anti-pattern #21 (Resurrection Overcounting). |
| 2.6.0 | 45 | +Role Calibration Protocol (Phase 2 subsection). +First-Cycle Bootstrap (Phase 1). 26-phase pipeline. Merge conflict resolved. BSI 92 emergency breached. PPHS 65. 45 cycles, 5532+ signals. $1.45M+/yr |
