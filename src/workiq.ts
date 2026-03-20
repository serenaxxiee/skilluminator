// ── MCP server config: WorkIQ ────────────────────────────────────────

/** WorkIQ MCP config matching the user's ~/.claude/.mcp.json */
export function getWorkIQMcpConfig(): Record<string, any> {
  return {
    workiq: {
      command: "npx",
      args: ["-y", "@microsoft/workiq@latest", "mcp"],
    },
  };
}

export const WORKIQ_TOOL = "mcp__workiq__ask_work_iq";

/**
 * Single broad query focused on individual work patterns.
 */
export const HARVEST_QUERIES = [
  "Give me a comprehensive analysis of ALL my M365 activity from the past 7 days across email, meetings, Teams chats, and documents. For each source, list: the most frequent/recurring activities, estimated time spent, key participants (by role not name), and any repeating patterns or workflows. Include specific examples of recurring email types, meeting types, chat topics, and document types. Also identify cross-source workflows (e.g., email → meeting → document chains). Be thorough — I need at least 15 distinct activity patterns.",
] as const;
