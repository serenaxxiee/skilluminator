// ── Skilluminator: Main entry point ─────────────────────────────────

import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runCycle, validateSetup } from "./cycle.js";
import { ensureDirs, readCycleHistory, DASHBOARD_PATH } from "./state.js";
import * as display from "./display.js";

// ── Load .env ───────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] ??= match[2].trim();
  }
}

const CYCLE_DELAY_MS = 10_000;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  display.startupBanner();

  // Pre-flight checks
  ensureDirs();
  display.success("Directories initialized");
  validateSetup();
  display.success("Claude Agent SDK found");

  // Resume cycle count from persisted history
  const history = readCycleHistory();
  let cycleNum = history.cycles.length;
  if (cycleNum > 0) {
    display.success(`Resuming from cycle ${cycleNum}`);
  }

  while (true) {
    cycleNum++;
    let result: { cycleNum: number } | null = null;

    try {
      const cycleResult = await runCycle(cycleNum);
      result = cycleResult;

      display.divider();
      display.success(`Dashboard: ${DASHBOARD_PATH}`);
      display.info("Harvest", cycleResult.harvestSummary.slice(0, 80));
      display.info("Refine", cycleResult.refineSummary.slice(0, 80));
      display.info("Duration", formatDuration(cycleResult.durationMs));
      display.info("Tokens", `${formatTokens(cycleResult.tokens.total)} (${formatTokens(cycleResult.tokens.input)} in / ${formatTokens(cycleResult.tokens.output)} out)`);
      if (cycleResult.prUrl) {
        display.info("PR", cycleResult.prUrl);
      }
      if (cycleResult.summarySent) {
        display.success("Teams summary sent for this batch");
      }
    } catch (err: any) {
      const cycleLabel = result?.cycleNum ?? cycleNum;
      display.failure(`Unhandled error in cycle ${cycleLabel}: ${err.message}`);
      console.error(err);
    }

    // ── Countdown to next cycle ───────────────────────────────────
    display.divider();
    for (let i = 10; i > 0; i--) {
      display.loopStatus(cycleNum, i);
      await sleep(1000);
      if (i > 1) {
        process.stdout.write("\x1B[1A\x1B[2K");
      }
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
