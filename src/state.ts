// ── State management: typed JSON read/write for persistent state files ──

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");

export function ensureDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ── Interfaces ──────────────────────────────────────────────────────

export interface RawSignal {
  source: "email" | "meeting" | "teams" | "document";
  title: string;
  participants: string[];
  frequency: number;
  timeSpentMinutes: number;
  keywords: string[];
  rawExcerpt: string;
  capturedAt: string;
}

export interface SignalsState {
  cycleNum: number;
  harvestedAt: string;
  weekOf: string;
  signals: RawSignal[];
  workiqQueriesRun: string[];
}

export interface PatternEvidence {
  patternId: string;
  label: string;
  sources: string[];
  occurrenceCount: number;
  participantCount: number;
  timeSpentHoursTotal: number;
  automationScore: number;
  valueScore: number;
  candidateSkillName: string;
  firstSeenCycle: number;
  lastSeenCycle: number;
  trend: "rising" | "stable" | "declining";
  llmRationale: string;
}

export interface PatternsState {
  lastUpdatedCycle: number;
  totalCyclesRun: number;
  patterns: PatternEvidence[];
  skillGeneratorInput: {
    candidateSkills: Array<{
      name: string;
      description: string;
      triggerExamples: string[];
      valueProposition: string;
    }>;
  };
}

export interface CycleLog {
  cycleNum: number;
  timestamp: string;
  patternsDetected: number;
  newPatterns: number;
  topCandidate: string;
  topScore: number;
  highlights: string[];
  durationMs: number;
}

export interface CycleHistory {
  cycles: CycleLog[];
}

// ── File paths ──────────────────────────────────────────────────────

export const SIGNALS_PATH = path.join(DATA_DIR, "signals.json");
export const PATTERNS_PATH = path.join(DATA_DIR, "patterns.json");
export const SKILL_PATH = path.join(PROJECT_ROOT, ".claude", "skills", "skill-detector", "SKILL.md");
const ONEDRIVE_DIR = process.env.SKILLUMINATOR_ONEDRIVE_DIR ?? path.join(PROJECT_ROOT, "output");
export const DASHBOARD_PATH = path.join(ONEDRIVE_DIR, "dashboard.html");
export const HISTORY_PATH = path.join(DATA_DIR, "cycle-history.json");
export const SUMMARIES_PATH = path.join(ONEDRIVE_DIR, "summaries.md");

// ── Accessors ───────────────────────────────────────────────────────

export function readSignals(): SignalsState | null {
  try {
    if (!existsSync(SIGNALS_PATH)) return null;
    return JSON.parse(readFileSync(SIGNALS_PATH, "utf-8"));
  } catch {
    return null;
  }
}

export function writeSignals(state: SignalsState): void {
  writeFileSync(SIGNALS_PATH, JSON.stringify(state, null, 2), "utf-8");
}

export function readPatterns(): PatternsState | null {
  try {
    if (!existsSync(PATTERNS_PATH)) return null;
    return JSON.parse(readFileSync(PATTERNS_PATH, "utf-8"));
  } catch {
    return null;
  }
}

export function writePatterns(state: PatternsState): void {
  writeFileSync(PATTERNS_PATH, JSON.stringify(state, null, 2), "utf-8");
}

export function readSkillDetector(): string | null {
  try {
    if (!existsSync(SKILL_PATH)) return null;
    return readFileSync(SKILL_PATH, "utf-8");
  } catch {
    return null;
  }
}

export function readCycleHistory(): CycleHistory {
  try {
    if (!existsSync(HISTORY_PATH)) return { cycles: [] };
    return JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));
  } catch {
    return { cycles: [] };
  }
}

export function appendCycleLog(log: CycleLog): void {
  const history = readCycleHistory();
  history.cycles.push(log);
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");
}

export function appendSummaryLog(cycleNum: number, summaryMarkdown: string): void {
  const header = `\n---\n\n## Summary — Cycles ${cycleNum - 2}-${cycleNum} (${new Date().toISOString().slice(0, 10)})\n\n`;
  const existing = existsSync(SUMMARIES_PATH) ? readFileSync(SUMMARIES_PATH, "utf-8") : "# Skilluminator Summaries\n";
  writeFileSync(SUMMARIES_PATH, existing + header + summaryMarkdown + "\n", "utf-8");
}
