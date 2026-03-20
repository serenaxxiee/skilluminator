import chalk from "chalk";

// ── Box-drawing helpers ──────────────────────────────────────────────
const WIDTH = 72;

function pad(text: string, width: number): string {
  const visible = text.replace(/\x1B\[[0-9;]*m/g, "");
  return text + " ".repeat(Math.max(0, width - visible.length));
}

export function banner(title: string, subtitle?: string): void {
  const line = "=".repeat(WIDTH);
  console.log();
  console.log(chalk.cyan(`+${line}+`));
  console.log(chalk.cyan(`|`) + pad(chalk.bold.white(` ${title}`), WIDTH) + chalk.cyan(`|`));
  if (subtitle) {
    console.log(chalk.cyan(`|`) + pad(chalk.gray(` ${subtitle}`), WIDTH) + chalk.cyan(`|`));
  }
  console.log(chalk.cyan(`+${line}+`));
}

export function sectionHeader(title: string): void {
  console.log();
  console.log(chalk.yellow(`+-- ${title} ${"--".repeat(Math.max(0, Math.floor((WIDTH - title.length - 5) / 2)))}`));
}

export function sectionEnd(): void {
  console.log(chalk.yellow(`+${"--".repeat(Math.floor((WIDTH + 1) / 2))}`));
}

export function info(label: string, value: string): void {
  console.log(chalk.yellow(`|`) + ` ${chalk.bold.white(label)}: ${chalk.green(value)}`);
}

export function bullet(text: string): void {
  console.log(chalk.yellow(`|`) + `  ${chalk.gray("*")} ${text}`);
}

export function agentOutput(text: string): void {
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.trim()) {
      console.log(chalk.blue(`| `) + line);
    }
  }
}

export function success(message: string): void {
  console.log(chalk.green(`  [OK] ${message}`));
}

export function failure(message: string): void {
  console.log(chalk.red(`  [FAIL] ${message}`));
}

export function warning(message: string): void {
  console.log(chalk.yellow(`  [WARN] ${message}`));
}

export function divider(): void {
  console.log(chalk.gray(`  ${"--".repeat(Math.floor((WIDTH - 2) / 2))}`));
}

export function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export function elapsed(startMs: number): string {
  const seconds = Math.floor((Date.now() - startMs) / 1000);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export function cycleHeader(cycleNum: number): void {
  banner(
    `CYCLE #${cycleNum}`,
    `Started at ${timestamp()}`
  );
}

export function loopStatus(cycleNum: number, nextInSec: number): void {
  const bar = ".".repeat(nextInSec) + "#".repeat(Math.max(0, 10 - nextInSec));
  console.log(
    chalk.gray(`  [${timestamp()}] `) +
    chalk.dim(`Cycle ${cycleNum} complete. Next in ${nextInSec}s `) +
    chalk.cyan(bar)
  );
}

export function startupBanner(): void {
  console.log();
  console.log(chalk.magenta.bold(`
  +=============================================================+
  |                                                             |
  |   SKILLUMINATOR                                             |
  |   Autonomous M365 Work Pattern Detector                     |
  |                                                             |
  |   Powered by Claude Agent SDK + WorkIQ MCP                  |
  |                                                             |
  +=============================================================+`));
  console.log();
  console.log(chalk.gray(`  Started:     ${timestamp()}`));
  console.log(chalk.gray(`  Refine:      ${process.env.SKILLUMINATOR_REFINE_MODEL ?? "claude-sonnet-4-6"}`));
  console.log(chalk.gray(`  Harvest:     ${process.env.SKILLUMINATOR_HARVEST_MODEL ?? "claude-sonnet-4-6"}`));
  console.log(chalk.gray(`  Max turns:   refine=${process.env.SKILLUMINATOR_REFINE_MAX_TURNS ?? "25"}, harvest=${process.env.SKILLUMINATOR_HARVEST_MAX_TURNS ?? "15"}`));
  console.log(chalk.gray(`  Focus:       alternating (odd=skill, even=dashboard)`));
  console.log(chalk.gray(`  Git:         ${process.env.SKILLUMINATOR_SKIP_PR === "true" ? "direct to main" : "branch + PR + squash-merge"}`));
  console.log();
}
