#!/usr/bin/env node

/**
 * Teams Channel MCP Server — Skilluminator
 *
 * Posts summaries to the team Teams channel via Azure CLI auth + Graph API.
 * Minimal version: only post_message (no read/reply needed for summaries).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "node:child_process";

// ── Channel Configuration (from env vars) ────────────────────────
const TEAM_ID = process.env.TEAMS_TEAM_ID ?? "";
const CHANNEL_ID = process.env.TEAMS_CHANNEL_ID ?? "";

const GRAPH_BASE = "https://graph.microsoft.com/beta";
const CHANNEL_URL = `${GRAPH_BASE}/teams/${TEAM_ID}/channels/${encodeURIComponent(CHANNEL_ID)}`;

// ── Helpers ───────────────────────────────────────────────────────

function getSignature(): string {
  const timestamp = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return `<br><hr style="border:none;border-top:1px solid #ddd;margin:12px 0 6px"><span style="font-size:11px;color:#888">&#x1F916; <b>Skilluminator</b> &middot; ${timestamp}</span>`;
}

function markdownToHtml(md: string): string {
  // Simple markdown-to-HTML for Teams (bold, italic, headings, lists, code)
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

function getAccessToken(): string {
  try {
    return execSync(
      "az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv",
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
  } catch {
    throw new Error(
      "Failed to get Azure CLI token. Run `az login` first."
    );
  }
}

async function callGraph(path: string, options: { method?: string; body?: string } = {}): Promise<any> {
  const response = await fetch(`${CHANNEL_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Graph API ${response.status}: ${body}`);
  }

  return response.json();
}

// ── MCP Server ────────────────────────────────────────────────────

const server = new McpServer({
  name: "teams-skilluminator",
  version: "1.0.0",
});

server.tool(
  "post_message",
  "Post a message to the team Teams channel. Use markdown formatting.",
  {
    message: z.string().describe(
      "Message content in markdown format. Use **bold**, *italic*, ## headings, - lists, `code`."
    ),
    subject: z
      .string()
      .optional()
      .describe("Optional thread subject/title"),
  },
  async ({ message, subject }) => {
    const signed = markdownToHtml(message) + getSignature();
    const body: any = { body: { contentType: "html", content: signed } };
    if (subject) {
      body.subject = subject;
    }

    const result = await callGraph("/messages", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      content: [
        { type: "text" as const, text: `Message posted to team. Thread ID: ${result.id}` },
      ],
    };
  }
);

// ── Start ─────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
