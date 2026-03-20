// ── Feed: interactive blog for agent updates + user steering ────────

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");

const FEED_PATH = path.join(DATA_DIR, "feed.json");
const STEERING_PATH = path.join(DATA_DIR, "steering.json");

const ONEDRIVE_DIR = process.env.SKILLUMINATOR_ONEDRIVE_DIR ?? path.join(PROJECT_ROOT, "output");
const FEED_HTML_PATH = path.join(ONEDRIVE_DIR, "feed.html");

const PORT = parseInt(process.env.SKILLUMINATOR_PORT ?? "3456", 10);

// ── Types ───────────────────────────────────────────────────────────

interface FeedEntry {
  id: string;
  type: "agent" | "user";
  cycleNum?: number;
  timestamp: string;
  message: string;
  prUrl?: string;
  patternsDetected?: number;
  topCandidate?: string;
  topScore?: number;
  durationMin?: number;
}

// ── Feed CRUD ───────────────────────────────────────────────────────

function loadFeed(): FeedEntry[] {
  try {
    if (existsSync(FEED_PATH)) return JSON.parse(readFileSync(FEED_PATH, "utf-8"));
  } catch { /* ignore */ }
  return [];
}

function saveFeed(entries: FeedEntry[]): void {
  writeFileSync(FEED_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

export function postAgentUpdate(opts: {
  cycleNum: number;
  message: string;
  prUrl?: string;
  patternsDetected: number;
  topCandidate: string;
  topScore: number;
  durationMin: number;
}): void {
  const feed = loadFeed();
  // Dedup by cycleNum
  const idx = feed.findIndex((e) => e.type === "agent" && e.cycleNum === opts.cycleNum);
  const entry: FeedEntry = {
    id: `cycle-${opts.cycleNum}`,
    type: "agent",
    cycleNum: opts.cycleNum,
    timestamp: new Date().toISOString(),
    message: opts.message,
    prUrl: opts.prUrl,
    patternsDetected: opts.patternsDetected,
    topCandidate: opts.topCandidate,
    topScore: opts.topScore,
    durationMin: opts.durationMin,
  };
  if (idx >= 0) feed[idx] = entry;
  else feed.push(entry);
  saveFeed(feed);
  writeFeedHtmlSnapshot(feed);
}

// ── Steering (user replies) ─────────────────────────────────────────

interface SteeringMessage {
  timestamp: string;
  message: string;
  consumed: boolean;
}

function loadSteering(): SteeringMessage[] {
  try {
    if (existsSync(STEERING_PATH)) return JSON.parse(readFileSync(STEERING_PATH, "utf-8"));
  } catch { /* ignore */ }
  return [];
}

function saveSteering(msgs: SteeringMessage[]): void {
  writeFileSync(STEERING_PATH, JSON.stringify(msgs, null, 2), "utf-8");
}

export function readUnconsumedSteering(): string[] {
  const msgs = loadSteering();
  const unconsumed = msgs.filter((m) => !m.consumed);
  return unconsumed.map((m) => m.message);
}

export function markSteeringConsumed(): void {
  const msgs = loadSteering();
  for (const m of msgs) m.consumed = true;
  saveSteering(msgs);
}

function addUserMessage(message: string): void {
  // Add to steering queue
  const steering = loadSteering();
  steering.push({ timestamp: new Date().toISOString(), message, consumed: false });
  saveSteering(steering);

  // Also add to feed
  const feed = loadFeed();
  feed.push({
    id: `user-${Date.now()}`,
    type: "user",
    timestamp: new Date().toISOString(),
    message,
  });
  saveFeed(feed);
  writeFeedHtmlSnapshot(feed);
}

// ── Static HTML snapshot (for OneDrive) ─────────────────────────────

function writeFeedHtmlSnapshot(feed: FeedEntry[]): void {
  const dir = path.dirname(FEED_HTML_PATH);
  mkdirSync(dir, { recursive: true });
  writeFileSync(FEED_HTML_PATH, buildHtml(feed), "utf-8");
}

// ── HTTP Server ─────────────────────────────────────────────────────

export function startFeedServer(): void {
  const server = createServer((req, res) => {
    // CORS for local dev
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "GET" && (req.url === "/" || req.url === "/feed")) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(buildHtml(loadFeed()));
      return;
    }

    if (req.method === "GET" && req.url === "/api/feed") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(loadFeed()));
      return;
    }

    if (req.method === "POST" && req.url === "/api/reply") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const { message } = JSON.parse(body);
          if (message?.trim()) {
            addUserMessage(message.trim());
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "empty message" }));
          }
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid JSON" }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, () => {
    console.log(`  Feed server: http://localhost:${PORT}`);
  });
}

// ── HTML builder ────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildHtml(feed: FeedEntry[]): string {
  const entries = [...feed].reverse();

  const entriesHtml = entries.map((e) => {
    if (e.type === "user") {
      return `<article class="entry user-entry">
        <div class="entry-header"><span class="author user-author">Serena</span><span class="time">${timeAgo(e.timestamp)}</span></div>
        <div class="entry-body">${esc(e.message)}</div>
      </article>`;
    }
    return `<article class="entry agent-entry">
      <div class="entry-header">
        <span class="author agent-author">Skilluminator</span>
        <span class="cycle">Cycle ${e.cycleNum}</span>
        <span class="time">${timeAgo(e.timestamp)}</span>
        <span class="duration">${e.durationMin}min</span>
      </div>
      <div class="entry-body">${esc(e.message)}</div>
      <div class="entry-stats">
        <span class="stat">${e.patternsDetected} patterns</span>
        <span class="stat top">${esc(e.topCandidate ?? "none")} (${e.topScore})</span>
        ${e.prUrl ? `<a class="pr-link" href="${esc(e.prUrl)}" target="_blank">View PR</a>` : ""}
      </div>
    </article>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Skilluminator</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f1117;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:24px}
h1{font-size:26px;font-weight:800;background:linear-gradient(90deg,#818cf8,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
.subtitle{color:#666;font-size:13px;margin-bottom:20px}
.subtitle a{color:#818cf8}
.compose{background:#1a1d27;border:1px solid #2a2d3a;border-radius:12px;padding:16px;margin-bottom:24px;display:flex;gap:10px}
.compose textarea{flex:1;background:#12141c;border:1px solid #2a2d3a;border-radius:8px;color:#e0e0e0;font-family:inherit;font-size:14px;padding:10px;resize:none;min-height:44px;max-height:120px;outline:none}
.compose textarea:focus{border-color:#818cf8}
.compose textarea::placeholder{color:#555}
.compose button{background:linear-gradient(135deg,#818cf8,#c084fc);border:none;border-radius:8px;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;cursor:pointer;white-space:nowrap;align-self:flex-end}
.compose button:hover{opacity:0.9}
.compose button:disabled{opacity:0.5;cursor:default}
.entry{border-radius:12px;padding:16px;margin-bottom:10px}
.agent-entry{background:#1a1d27;border:1px solid #2a2d3a}
.user-entry{background:#1e1b2e;border:1px solid #3d2d6a}
.entry-header{display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap}
.author{font-weight:700;font-size:14px}
.agent-author{color:#818cf8}
.user-author{color:#c084fc}
.cycle{font-size:12px;color:#fff;background:#818cf830;padding:1px 8px;border-radius:10px}
.time{color:#555;font-size:12px}
.duration{color:#818cf8;font-size:12px;margin-left:auto}
.entry-body{font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.entry-stats{display:flex;gap:10px;margin-top:8px;flex-wrap:wrap}
.stat{font-size:12px;color:#888;background:#12141c;padding:2px 8px;border-radius:8px}
.stat.top{color:#22c55e}
.pr-link{font-size:12px;color:#818cf8;text-decoration:none;background:#818cf820;padding:2px 8px;border-radius:8px}
.empty{text-align:center;color:#444;padding:48px 0}
.footer{text-align:center;color:#333;font-size:11px;padding:20px 0}
.status{font-size:12px;color:#22c55e;margin-left:8px;display:none}
</style>
</head>
<body>
<h1>Skilluminator</h1>
<p class="subtitle">${entries.length} posts &bull; <a href="dashboard.html">Dashboard</a></p>

<div class="compose">
  <textarea id="msg" placeholder="Steer the agent... (your message becomes an instruction for the next cycle)" rows="2"></textarea>
  <button id="send" onclick="sendReply()">Send</button>
  <span class="status" id="status">Sent!</span>
</div>

${entriesHtml || '<div class="empty">No updates yet. The agent will post here each cycle.</div>'}

<div class="footer">Auto-refreshes every 30s &bull; Powered by Claude Opus 4.6</div>

<script>
const textarea = document.getElementById('msg');
const btn = document.getElementById('send');
const status = document.getElementById('status');

textarea.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
});

textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
});

async function sendReply() {
  const msg = textarea.value.trim();
  if (!msg) return;
  btn.disabled = true;
  try {
    const r = await fetch('/api/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    if (r.ok) {
      textarea.value = '';
      textarea.style.height = 'auto';
      status.style.display = 'inline';
      setTimeout(() => location.reload(), 500);
    }
  } catch(e) { alert('Failed to send: ' + e.message); }
  btn.disabled = false;
}

// Auto-refresh
setTimeout(() => location.reload(), 30000);
</script>
</body>
</html>`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
