// ── MCP server configs: WorkIQ + Teams ──────────────────────────────

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** WorkIQ MCP config matching the user's ~/.claude/.mcp.json */
export function getWorkIQMcpConfig(): Record<string, any> {
  return {
    workiq: {
      command: "npx",
      args: ["-y", "@microsoft/workiq@latest", "mcp"],
    },
  };
}

/** Teams MCP config for posting summaries to team channel */
export function getTeamsMcpConfig(): Record<string, any> {
  const serverPath = path.join(__dirname, "teams-server.ts");
  const tsxBin = path.join(__dirname, "..", "node_modules", ".bin", "tsx");
  return {
    "teams-skilluminator": {
      command: tsxBin,
      args: [serverPath],
    },
  };
}

export const WORKIQ_TOOL = "mcp__workiq__ask_work_iq";
export const TEAMS_POST_TOOL = "mcp__teams-skilluminator__post_message";

/**
 * Single broad query focused on individual work patterns.
 */
export const HARVEST_QUERIES = [
  "Give me a comprehensive analysis of ALL my M365 activity from the past 7 days across email, meetings, Teams chats, and documents. For each source, list: the most frequent/recurring activities, estimated time spent, key participants (by role not name), and any repeating patterns or workflows. Include specific examples of recurring email types, meeting types, chat topics, and document types. Also identify cross-source workflows (e.g., email → meeting → document chains). Be thorough — I need at least 15 distinct activity patterns.",
] as const;
