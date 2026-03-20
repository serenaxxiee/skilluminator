// ── Cycle execution: phased agent invocation per cycle ──────────────

import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildSystemPrompt, buildHarvestPrompt,
  buildRefinePrompt, buildSummaryPrompt, buildSteeringPrompt,
} from "./prompts.js";
import { getWorkIQMcpConfig, getTeamsMcpConfig, WORKIQ_TOOL, TEAMS_POST_TOOL, TEAMS_READ_TOOL } from "./workiq.js";
import {
  readPatterns, readSignals, appendCycleLog,
  type CycleLog,
} from "./state.js";
import chalk from "chalk";
import * as display from "./display.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_JS = path.join(
  __dirname, "..", "node_modules",
  "@anthropic-ai", "claude-agent-sdk", "cli.js"
);

const USAGE_PATH = path.join(__dirname, "..", "data", "token-usage.json");

// ── Token usage tracking ────────────────────────────────────────────

interface PhaseUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolCalls: number;
}

interface CycleUsage {
  cycleNum: number;
  timestamp: string;
  harvest: PhaseUsage;
  refine: PhaseUsage;
  summary: PhaseUsage | null;
  total: PhaseUsage;
}

interface UsageHistory {
  cumulative: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCycles: number;
  };
  cycles: CycleUsage[];
}

function loadUsageHistory(): UsageHistory {
  try {
    if (existsSync(USAGE_PATH)) {
      return JSON.parse(readFileSync(USAGE_PATH, "utf-8"));
    }
  } catch { /* ignore */ }
  return {
    cumulative: { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCycles: 0 },
    cycles: [],
  };
}

function saveUsageHistory(history: UsageHistory): void {
  writeFileSync(USAGE_PATH, JSON.stringify(history, null, 2), "utf-8");
}

function extractUsage(msg: any): { input: number; output: number } {
  const usage = msg.usage ?? msg.result_meta?.usage ?? msg.data?.usage ?? msg.result?.usage ?? {};
  return {
    input: usage.input_tokens ?? usage.inputTokens ?? 0,
    output: usage.output_tokens ?? usage.outputTokens ?? 0,
  };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Git / PR helpers ────────────────────────────────────────────────

const PROJECT_ROOT = path.join(__dirname, "..");

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 30_000 }).trim();
  } catch (err: any) {
    display.warning(`git ${cmd.split(" ")[0]} failed: ${err.message.split("\n")[0]}`);
    return "";
  }
}

function gh(cmd: string): string {
  try {
    return execSync(`gh ${cmd}`, { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 60_000 }).trim();
  } catch (err: any) {
    display.warning(`gh ${cmd.split(" ")[0]} failed: ${err.message.split("\n")[0]}`);
    return "";
  }
}

function createCycleBranch(cycleNum: number): string {
  const branch = `cycle-${cycleNum}`;
  git("checkout main");
  git(`checkout -b ${branch}`);
  display.info("Git", `Created branch ${branch}`);
  return branch;
}

function commitAndCreatePR(cycleNum: number, refineSummary: string, patternsDetected: number, topCandidate: string): string {
  const branch = `cycle-${cycleNum}`;

  git("add -A");

  const status = git("status --porcelain");
  if (!status) {
    display.warning("No changes to commit this cycle");
    git("checkout main");
    return "";
  }

  const commitMsgPath = path.join(PROJECT_ROOT, ".git", "CYCLE_COMMIT_MSG");
  const safeRefine = refineSummary.slice(0, 300).replace(/["\n\r]/g, " ");
  writeFileSync(commitMsgPath, `cycle ${cycleNum}: refine skill-detector\n\n${safeRefine}\n\nPatterns: ${patternsDetected} | Top: ${topCandidate}`, "utf-8");
  try {
    execSync(`git commit -F .git/CYCLE_COMMIT_MSG`, {
      cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 30_000,
    });
  } catch (err: any) {
    display.warning(`Commit failed: ${err.message.split("\n")[0]}`);
    git("checkout main");
    return "";
  }

  git(`push -u origin ${branch}`);

  const prBodyPath = path.join(PROJECT_ROOT, ".git", "PR_BODY");
  writeFileSync(prBodyPath, `## Cycle ${cycleNum}\n\n${safeRefine}\n\n- Patterns: ${patternsDetected}\n- Top: ${topCandidate}\n\n*Automated by Skilluminator*`, "utf-8");

  const prUrl = gh(`pr create --title "Cycle ${cycleNum}: refine skill-detector" --body-file .git/PR_BODY --base main --head ${branch}`);

  if (prUrl) {
    display.success(`PR created: ${prUrl}`);
    gh(`pr merge ${branch} --squash --delete-branch`);
  }

  git("checkout main");
  git("pull origin main");

  return prUrl;
}

// ── Signal freshness check ──────────────────────────────────────────

function signalAgeHours(): number {
  const signals = readSignals();
  if (!signals?.harvestedAt) return 999;
  return (Date.now() - new Date(signals.harvestedAt).getTime()) / (1000 * 3600);
}

// ── Exports ─────────────────────────────────────────────────────────

export interface CycleResult {
  cycleNum: number;
  harvestSummary: string;
  refineSummary: string;
  summarySent: boolean;
  durationMs: number;
  tokens: { input: number; output: number; total: number };
  prUrl: string;
}

export function validateSetup(): void {
  if (!existsSync(CLI_JS)) {
    console.error(`Claude Agent SDK CLI not found at: ${CLI_JS}`);
    console.error("Run: npm install @anthropic-ai/claude-agent-sdk");
    process.exit(1);
  }
}

export async function runCycle(cycleNum: number): Promise<CycleResult> {
  const startMs = Date.now();
  display.cycleHeader(cycleNum);

  const workiqMcp = getWorkIQMcpConfig();
  const teamsMcp = getTeamsMcpConfig();
  const systemPrompt = buildSystemPrompt();

  const baseOptions: any = {
    cwd: "C:/agent/skilluminator",
    pathToClaudeCodeExecutable: CLI_JS,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    model: "claude-opus-4-6",
    systemPrompt,
  };

  let harvestTokens = { input: 0, output: 0 };
  let refineTokens = { input: 0, output: 0 };
  let summaryTokens = { input: 0, output: 0 };

  // ── Phase 0: Steering (every 3 cycles) ────────────────────────
  let steeringInput = "";
  if (cycleNum % 3 === 1 || cycleNum <= 3) {
    display.sectionHeader("Phase 0: Checking Teams for Steering Input");
    try {
      for await (const message of query({
        prompt: buildSteeringPrompt(cycleNum),
        options: {
          ...baseOptions,
          tools: [],
          allowedTools: [TEAMS_READ_TOOL],
          disallowedTools: ["AskUserQuestion"],
          mcpServers: teamsMcp,
        },
      })) {
        const msg = message as any;
        if ("result" in msg) {
          steeringInput = msg.result ?? "";
        }
      }
      if (steeringInput && !steeringInput.toLowerCase().includes("no steering input")) {
        display.info("Steering", "Found operator instructions");
        display.agentOutput(steeringInput.slice(0, 300));
      } else {
        steeringInput = "";
        display.info("Steering", "No operator instructions");
      }
    } catch (err: any) {
      display.warning(`Steering check failed: ${err.message.split("\n")[0]}`);
    }
    display.sectionEnd();
  } else {
    display.sectionHeader("Phase 0: Steering — skipped (runs every 3 cycles)");
    display.sectionEnd();
  }

  // ── Phase 1: Harvest (when signals are stale >24h) ────────────
  const ageHrs = signalAgeHours();
  let harvestSummary = "";
  let harvestToolCalls = 0;

  if (ageHrs < 24) {
    const existingSignals = readSignals();
    display.sectionHeader("Phase 1: Harvest SKIPPED — signals fresh");
    display.info("Signals", `${existingSignals?.signals?.length ?? 0} signals, ${ageHrs.toFixed(1)}h old`);
    harvestSummary = `Reusing ${existingSignals?.signals?.length ?? 0} signals (${ageHrs.toFixed(1)}h old)`;
    display.sectionEnd();
  } else {
    display.sectionHeader(`Phase 1: Harvesting M365 Signals (signals ${ageHrs >= 999 ? "missing" : `${ageHrs.toFixed(0)}h old`})`);

    try {
      for await (const message of query({
        prompt: buildHarvestPrompt(cycleNum),
        options: {
          ...baseOptions,
          tools: ["Write", "Bash"],
          allowedTools: ["Write", "Bash", WORKIQ_TOOL],
          disallowedTools: ["AskUserQuestion"],
          mcpServers: workiqMcp,
        },
      })) {
        const msg = message as any;

        if ("result" in msg) {
          harvestSummary = msg.result ?? "";
          const u = extractUsage(msg);
          harvestTokens.input += u.input;
          harvestTokens.output += u.output;
          display.agentOutput(harvestSummary.slice(0, 500));
          continue;
        }

        if (msg.usage) {
          const u = extractUsage(msg);
          harvestTokens.input += u.input;
          harvestTokens.output += u.output;
        }

        const content = msg.message?.content ?? msg.content;
        if (msg.type === "assistant" && content) {
          for (const block of content) {
            if (block.type === "tool_use") {
              harvestToolCalls++;
              const inputPreview = JSON.stringify(block.input ?? {}).slice(0, 80);
              console.log(
                chalk.yellow(`  [${harvestToolCalls}] `) +
                chalk.bold.white(block.name ?? "unknown") +
                chalk.gray(` ${inputPreview}${inputPreview.length >= 80 ? "..." : ""}`)
              );
            }
            if (block.type === "text" && block.text?.trim()) {
              const firstLine = block.text.split("\n").find((l: string) => l.trim()) ?? "";
              if (firstLine) {
                console.log(chalk.blue(`  | `) + firstLine.trim().slice(0, 120));
              }
            }
          }
        }
      }
      display.success(`Harvest complete — ${harvestToolCalls} tool calls`);
      display.info("Tokens (harvest)", `${formatTokens(harvestTokens.input)} in / ${formatTokens(harvestTokens.output)} out`);
    } catch (err: any) {
      display.failure(`Harvest error: ${err.message}`);
      harvestSummary = `Error: ${err.message}`;
    }
    display.sectionEnd();
  }

  // ── Phase 2: Refine (on a cycle branch) ───────────────────────
  display.sectionHeader("Phase 2: Refine Skill-Detector & Dashboard");
  const cycleBranch = createCycleBranch(cycleNum);
  let refineSummary = "";
  let refineToolCalls = 0;

  try {
    for await (const message of query({
      prompt: buildRefinePrompt(cycleNum, steeringInput || undefined),
      options: {
        ...baseOptions,
        tools: ["Read", "Write", "Edit", "Bash", "Glob"],
        allowedTools: ["Read", "Write", "Edit", "Bash", "Glob"],
        disallowedTools: ["AskUserQuestion"],
      },
    })) {
      const msg = message as any;

      if ("result" in msg) {
        refineSummary = msg.result ?? "";
        const u = extractUsage(msg);
        refineTokens.input += u.input;
        refineTokens.output += u.output;
        display.agentOutput(refineSummary.slice(0, 800));
        continue;
      }

      if (msg.usage) {
        const u = extractUsage(msg);
        refineTokens.input += u.input;
        refineTokens.output += u.output;
      }

      const content = msg.message?.content ?? msg.content;
      if (msg.type === "assistant" && content) {
        for (const block of content) {
          if (block.type === "tool_use") {
            refineToolCalls++;
            const inputPreview = JSON.stringify(block.input ?? {}).slice(0, 80);
            console.log(
              chalk.yellow(`  [${refineToolCalls}] `) +
              chalk.bold.white(block.name ?? "unknown") +
              chalk.gray(` ${inputPreview}${inputPreview.length >= 80 ? "..." : ""}`)
            );
          }
          if (block.type === "thinking" && block.thinking && refineToolCalls === 0) {
            const firstLine = block.thinking.split("\n").find((l: string) => l.trim()) ?? "";
            if (firstLine) {
              console.log(chalk.magenta(`  ~ ${firstLine.trim().slice(0, 100)}`));
            }
          }
        }
      }
    }
    display.success(`Refine complete — ${refineToolCalls} tool calls`);
    display.info("Tokens (refine)", `${formatTokens(refineTokens.input)} in / ${formatTokens(refineTokens.output)} out`);
  } catch (err: any) {
    display.failure(`Refine error: ${err.message}`);
    refineSummary = `Error: ${err.message}`;
  }
  display.sectionEnd();

  // ── Phase 2b: Commit & PR ─────────────────────────────────────
  display.sectionHeader("Phase 2b: Git Commit & Pull Request");
  let prUrl = "";
  try {
    const raw = readPatterns();
    const patCount = raw ? (Array.isArray(raw.patterns) ? raw.patterns.length : 0) : 0;
    const topCand = (() => {
      if (!raw || !Array.isArray(raw.patterns)) return "none";
      const sorted = raw.patterns
        .filter((p: any) => typeof p.automationScore === "number" && typeof p.valueScore === "number")
        .sort((a: any, b: any) => ((b.automationScore + b.valueScore) / 2) - ((a.automationScore + a.valueScore) / 2));
      return sorted[0]?.candidateSkillName ?? "none";
    })();
    prUrl = commitAndCreatePR(cycleNum, refineSummary, patCount, topCand);
  } catch (err: any) {
    display.failure(`PR creation error: ${err.message}`);
    git("checkout main");
  }
  display.sectionEnd();

  // ── Phase 3: Teams update ─────────────────────────────────────
  let summarySent = false;
  let summaryToolCalls = 0;
  {
    display.sectionHeader("Phase 3: Sending Summary to Teams");
    try {
      for await (const message of query({
        prompt: buildSummaryPrompt(cycleNum, prUrl, refineSummary),
        options: {
          ...baseOptions,
          tools: ["Write"],
          allowedTools: ["Write", TEAMS_POST_TOOL],
          disallowedTools: ["AskUserQuestion"],
          mcpServers: teamsMcp,
        },
      })) {
        const msg = message as any;
        if ("result" in msg) {
          display.agentOutput((msg.result ?? "").slice(0, 500));
          const u = extractUsage(msg);
          summaryTokens.input += u.input;
          summaryTokens.output += u.output;
        }
        if (msg.usage) {
          const u = extractUsage(msg);
          summaryTokens.input += u.input;
          summaryTokens.output += u.output;
        }
        const content = msg.message?.content ?? msg.content;
        if (msg.type === "assistant" && content) {
          for (const block of content) {
            if (block.type === "tool_use") {
              summaryToolCalls++;
              console.log(
                chalk.yellow(`  [Teams] `) +
                chalk.bold.white(block.name ?? "unknown")
              );
            }
          }
        }
      }
      summarySent = true;
      display.success("Summary sent to Teams");
      display.info("Tokens (summary)", `${formatTokens(summaryTokens.input)} in / ${formatTokens(summaryTokens.output)} out`);
    } catch (err: any) {
      display.failure(`Summary error: ${err.message}`);
    }
    display.sectionEnd();
  }

  // ── Token usage totals ────────────────────────────────────────
  const totalInput = harvestTokens.input + refineTokens.input + summaryTokens.input;
  const totalOutput = harvestTokens.output + refineTokens.output + summaryTokens.output;
  const totalTokens = totalInput + totalOutput;

  display.sectionHeader("Token Usage");
  display.info("Harvest", `${formatTokens(harvestTokens.input)} in / ${formatTokens(harvestTokens.output)} out`);
  display.info("Refine", `${formatTokens(refineTokens.input)} in / ${formatTokens(refineTokens.output)} out`);
  display.info("Teams", `${formatTokens(summaryTokens.input)} in / ${formatTokens(summaryTokens.output)} out`);
  display.info("Cycle Total", `${formatTokens(totalInput)} in / ${formatTokens(totalOutput)} out = ${formatTokens(totalTokens)} total`);

  const history = loadUsageHistory();
  const cycleUsage: CycleUsage = {
    cycleNum,
    timestamp: new Date().toISOString(),
    harvest: { inputTokens: harvestTokens.input, outputTokens: harvestTokens.output, totalTokens: harvestTokens.input + harvestTokens.output, toolCalls: harvestToolCalls },
    refine: { inputTokens: refineTokens.input, outputTokens: refineTokens.output, totalTokens: refineTokens.input + refineTokens.output, toolCalls: refineToolCalls },
    summary: { inputTokens: summaryTokens.input, outputTokens: summaryTokens.output, totalTokens: summaryTokens.input + summaryTokens.output, toolCalls: summaryToolCalls },
    total: { inputTokens: totalInput, outputTokens: totalOutput, totalTokens, toolCalls: harvestToolCalls + refineToolCalls + summaryToolCalls },
  };
  history.cycles.push(cycleUsage);
  history.cumulative.inputTokens += totalInput;
  history.cumulative.outputTokens += totalOutput;
  history.cumulative.totalTokens += totalTokens;
  history.cumulative.totalCycles = cycleNum;
  saveUsageHistory(history);

  display.info("Cumulative", `${formatTokens(history.cumulative.totalTokens)} total across ${history.cumulative.totalCycles} cycles`);
  display.sectionEnd();

  // ── Log this cycle ────────────────────────────────────────────
  const durationMs = Date.now() - startMs;

  let patternsDetected = 0;
  let newPatterns = 0;
  let topCandidate = "none";
  let topScore = 0;

  try {
    const raw = readPatterns();
    if (raw) {
      const allPatterns: any[] = Array.isArray(raw.patterns) ? raw.patterns : [];
      patternsDetected = allPatterns.length;
      newPatterns = allPatterns.filter((p: any) => p.firstSeenCycle === cycleNum).length;

      const sorted = allPatterns
        .filter((p: any) => typeof p.automationScore === "number" && typeof p.valueScore === "number")
        .sort((a: any, b: any) => ((b.automationScore + b.valueScore) / 2) - ((a.automationScore + a.valueScore) / 2));

      if (sorted.length > 0) {
        topCandidate = sorted[0].candidateSkillName ?? sorted[0].patternId ?? "unknown";
        topScore = Math.round((sorted[0].automationScore + sorted[0].valueScore) / 2);
      }
    }
  } catch { /* patterns file may not match expected schema */ }

  const cycleLog: CycleLog = {
    cycleNum,
    timestamp: new Date().toISOString(),
    patternsDetected,
    newPatterns,
    topCandidate,
    topScore,
    highlights: [harvestSummary.slice(0, 100), refineSummary.slice(0, 100)],
    durationMs,
  };
  appendCycleLog(cycleLog);

  return {
    cycleNum,
    harvestSummary: harvestSummary.slice(0, 300),
    refineSummary: refineSummary.slice(0, 300),
    summarySent,
    durationMs,
    tokens: { input: totalInput, output: totalOutput, total: totalTokens },
    prUrl,
  };
}
