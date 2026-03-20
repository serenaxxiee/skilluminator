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
  replyTo?: string;       // id of the post being replied to
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

const MAX_FEED_ENTRIES = 100;

function saveFeed(entries: FeedEntry[]): void {
  // Prune old entries but keep all replies to retained posts
  if (entries.length > MAX_FEED_ENTRIES) {
    const keep = entries.slice(-MAX_FEED_ENTRIES);
    const keepIds = new Set(keep.map((e) => e.id));
    // Also keep any replies whose parent is retained
    const extras = entries.filter((e) => e.replyTo && keepIds.has(e.replyTo) && !keepIds.has(e.id));
    entries = [...extras, ...keep];
  }
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
  replyTo?: string;       // which post this is in reply to (e.g. "cycle-5")
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
  const feed = loadFeed();
  const unconsumed = msgs.filter((m) => !m.consumed);
  return unconsumed.map((m) => {
    if (!m.replyTo) return m.message;
    // Include context: what post was this a reply to?
    const parent = feed.find((e) => e.id === m.replyTo);
    if (!parent) return `[Reply to ${m.replyTo}] ${m.message}`;
    const preview = parent.message.slice(0, 120).replace(/\n/g, " ");
    const label = parent.type === "agent" ? `Cycle ${parent.cycleNum}` : "your previous message";
    return `[Replying to ${label}: "${preview}..."]\n${m.message}`;
  });
}

export function markSteeringConsumed(): void {
  const msgs = loadSteering();
  for (const m of msgs) m.consumed = true;
  saveSteering(msgs);
}

function addUserMessage(message: string, replyTo?: string): void {
  // Add to steering queue
  const steering = loadSteering();
  steering.push({ timestamp: new Date().toISOString(), message, replyTo, consumed: false });
  saveSteering(steering);

  // Also add to feed
  const feed = loadFeed();
  feed.push({
    id: `user-${Date.now()}`,
    type: "user",
    replyTo,
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
  writeFileSync(FEED_HTML_PATH, buildStaticHtml(feed), "utf-8");
}

function buildStaticHtml(feed: FeedEntry[]): string {
  const entries = [...feed].reverse();
  const replyMap = new Map<string, FeedEntry[]>();
  for (const e of feed) {
    if (e.replyTo) {
      if (!replyMap.has(e.replyTo)) replyMap.set(e.replyTo, []);
      replyMap.get(e.replyTo)!.push(e);
    }
  }
  const topLevel = entries.filter((e) => !e.replyTo);

  const entriesHtml = topLevel.map((e) => {
    const replies = replyMap.get(e.id) || [];
    const repliesHtml = replies.map((r) =>
      `<article class="entry reply-entry user-entry">
        <div class="entry-header"><span class="author user-author">Serena</span><span class="reply-badge">reply</span><span class="time">${timeAgo(r.timestamp)}</span></div>
        <div class="entry-body">${esc(r.message)}</div>
      </article>`
    ).join("\n");

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
      ${repliesHtml ? `<div class="replies">${repliesHtml}</div>` : ""}
    </article>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Skilluminator Moltbook (read-only)</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f1117;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:24px}
h1{font-size:26px;font-weight:800;background:linear-gradient(90deg,#818cf8,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
.subtitle{color:#666;font-size:13px;margin-bottom:20px}.subtitle a{color:#818cf8}
.readonly-banner{background:#2a2d3a;border:1px solid #3d2d6a;border-radius:10px;padding:10px 16px;margin-bottom:20px;font-size:13px;color:#c084fc;text-align:center}
.entry{border-radius:12px;padding:16px;margin-bottom:10px}
.agent-entry{background:#1a1d27;border:1px solid #2a2d3a}
.user-entry{background:#1e1b2e;border:1px solid #3d2d6a}
.entry-header{display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap}
.author{font-weight:700;font-size:14px}.agent-author{color:#818cf8}.user-author{color:#c084fc}
.cycle{font-size:12px;color:#fff;background:#818cf830;padding:1px 8px;border-radius:10px}
.reply-badge{font-size:11px;color:#c084fc;background:#c084fc20;padding:1px 6px;border-radius:8px}
.time{color:#555;font-size:12px}.duration{color:#818cf8;font-size:12px;margin-left:auto}
.entry-body{font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.entry-stats{display:flex;gap:10px;margin-top:8px;flex-wrap:wrap}
.stat{font-size:12px;color:#888;background:#12141c;padding:2px 8px;border-radius:8px}.stat.top{color:#22c55e}
.pr-link{font-size:12px;color:#818cf8;text-decoration:none;background:#818cf820;padding:2px 8px;border-radius:8px}
.replies{margin-top:10px;padding-left:16px;border-left:2px solid #3d2d6a}
.reply-entry{margin-bottom:6px;padding:10px 12px;border:none;background:#1e1b2e80}
.empty{text-align:center;color:#444;padding:48px 0}
.footer{text-align:center;color:#333;font-size:11px;padding:20px 0}
</style></head><body>
<h1>Skilluminator Moltbook</h1>
<p class="subtitle">${topLevel.length} posts &bull; <a href="dashboard.html">Dashboard</a></p>
<div class="readonly-banner">Read-only snapshot. To reply and steer the agent, open the Moltbook at <strong>http://localhost:${PORT}</strong></div>
${entriesHtml || '<div class="empty">No updates yet.</div>'}
<div class="footer">Snapshot generated ${new Date().toISOString().slice(0, 19).replace("T", " ")}</div>
</body></html>`;
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
      const MAX_BODY = 10_240; // 10KB
      let body = "";
      let tooBig = false;
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY) { tooBig = true; req.destroy(); }
      });
      req.on("end", () => {
        if (tooBig) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "payload too large" }));
          return;
        }
        try {
          const { message, replyTo } = JSON.parse(body);
          if (message?.trim()) {
            addUserMessage(message.trim(), replyTo || undefined);
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

  // Group replies under their parent posts
  const replyMap = new Map<string, FeedEntry[]>();
  for (const e of feed) {
    if (e.replyTo) {
      if (!replyMap.has(e.replyTo)) replyMap.set(e.replyTo, []);
      replyMap.get(e.replyTo)!.push(e);
    }
  }

  // Only show top-level entries (not replies) in the main feed
  const topLevel = entries.filter((e) => !e.replyTo);

  const entriesHtml = topLevel.map((e) => {
    const replies = replyMap.get(e.id) || [];
    const repliesHtml = replies.map((r) =>
      `<article class="entry reply-entry user-entry">
        <div class="entry-header"><span class="author user-author">Serena</span><span class="reply-badge">reply</span><span class="time">${timeAgo(r.timestamp)}</span></div>
        <div class="entry-body">${esc(r.message)}</div>
      </article>`
    ).join("\n");

    if (e.type === "user") {
      return `<article class="entry user-entry" data-id="${esc(e.id)}">
        <div class="entry-header"><span class="author user-author">Serena</span><span class="time">${timeAgo(e.timestamp)}</span></div>
        <div class="entry-body">${esc(e.message)}</div>
      </article>`;
    }

    return `<article class="entry agent-entry" data-id="${esc(e.id)}">
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
      <div class="entry-actions">
        <button class="reply-btn" onclick="openReply('${esc(e.id)}', 'Cycle ${e.cycleNum}')">Reply</button>
      </div>
      ${repliesHtml ? `<div class="replies">${repliesHtml}</div>` : ""}
      <div class="inline-reply" id="reply-${esc(e.id)}" style="display:none">
        <textarea placeholder="Reply to Cycle ${e.cycleNum}..." rows="2"></textarea>
        <div class="inline-reply-actions">
          <button onclick="sendInlineReply('${esc(e.id)}')">Send</button>
          <button class="cancel-btn" onclick="closeReply('${esc(e.id)}')">Cancel</button>
          <span class="reply-status"></span>
        </div>
      </div>
    </article>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Skilluminator Moltbook</title>
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
.reply-badge{font-size:11px;color:#c084fc;background:#c084fc20;padding:1px 6px;border-radius:8px}
.time{color:#555;font-size:12px}
.duration{color:#818cf8;font-size:12px;margin-left:auto}
.entry-body{font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.entry-stats{display:flex;gap:10px;margin-top:8px;flex-wrap:wrap}
.stat{font-size:12px;color:#888;background:#12141c;padding:2px 8px;border-radius:8px}
.stat.top{color:#22c55e}
.pr-link{font-size:12px;color:#818cf8;text-decoration:none;background:#818cf820;padding:2px 8px;border-radius:8px}
.entry-actions{margin-top:8px}
.reply-btn{background:none;border:1px solid #2a2d3a;border-radius:8px;color:#888;font-size:12px;padding:3px 12px;cursor:pointer;transition:all 0.15s}
.reply-btn:hover{color:#c084fc;border-color:#c084fc}
.replies{margin-top:10px;padding-left:16px;border-left:2px solid #3d2d6a}
.reply-entry{margin-bottom:6px;padding:10px 12px;border:none;background:#1e1b2e80}
.inline-reply{margin-top:10px;display:flex;flex-direction:column;gap:8px}
.inline-reply textarea{background:#12141c;border:1px solid #3d2d6a;border-radius:8px;color:#e0e0e0;font-family:inherit;font-size:13px;padding:8px 10px;resize:none;min-height:40px;max-height:100px;outline:none}
.inline-reply textarea:focus{border-color:#c084fc}
.inline-reply textarea::placeholder{color:#555}
.inline-reply-actions{display:flex;gap:8px;align-items:center}
.inline-reply-actions button{background:linear-gradient(135deg,#818cf8,#c084fc);border:none;border-radius:6px;color:#fff;font-weight:600;font-size:12px;padding:6px 14px;cursor:pointer}
.inline-reply-actions button:hover{opacity:0.9}
.inline-reply-actions button:disabled{opacity:0.5;cursor:default}
.cancel-btn{background:#2a2d3a !important}
.reply-status{font-size:12px;color:#22c55e;display:none}
.empty{text-align:center;color:#444;padding:48px 0}
.footer{text-align:center;color:#333;font-size:11px;padding:20px 0}
.status{font-size:12px;color:#22c55e;margin-left:8px;display:none}
</style>
</head>
<body>
<h1>Skilluminator Moltbook</h1>
<p class="subtitle">${topLevel.length} posts &bull; <a href="dashboard.html">Dashboard</a></p>

<div class="compose">
  <textarea id="msg" placeholder="Steer the agent... (general instruction for the next cycle)" rows="2"></textarea>
  <button id="send" onclick="sendReply()">Send</button>
  <span class="status" id="status">Sent!</span>
</div>

${entriesHtml || '<div class="empty">No updates yet. The agent will post here each cycle.</div>'}

<div class="footer">Auto-refreshes every 30s &bull; Skilluminator Moltbook</div>

<script>
const textarea = document.getElementById('msg');
const btn = document.getElementById('send');
const topStatus = document.getElementById('status');

textarea.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
});

textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
});

// General steering message (no replyTo)
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
      topStatus.style.display = 'inline';
      setTimeout(() => { topStatus.style.display = 'none'; }, 2000);
      softRefresh();
    }
  } catch(e) { alert('Failed to send: ' + e.message); }
  btn.disabled = false;
}

// Inline reply to a specific post
function openReply(postId, label) {
  document.querySelectorAll('.inline-reply').forEach(el => el.style.display = 'none');
  const box = document.getElementById('reply-' + postId);
  if (box) {
    box.style.display = 'flex';
    const ta = box.querySelector('textarea');
    if (ta) { ta.focus(); ta.placeholder = 'Reply to ' + label + '...'; }
  }
}

function closeReply(postId) {
  const box = document.getElementById('reply-' + postId);
  if (box) { box.style.display = 'none'; box.querySelector('textarea').value = ''; }
}

async function sendInlineReply(postId) {
  const box = document.getElementById('reply-' + postId);
  const ta = box.querySelector('textarea');
  const sendBtn = box.querySelector('button');
  const statusEl = box.querySelector('.reply-status');
  const msg = ta.value.trim();
  if (!msg) return;
  sendBtn.disabled = true;
  try {
    const r = await fetch('/api/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, replyTo: postId })
    });
    if (r.ok) {
      ta.value = '';
      statusEl.textContent = 'Sent!';
      statusEl.style.display = 'inline';
      setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
      softRefresh();
    }
  } catch(e) { alert('Failed to send: ' + e.message); }
  sendBtn.disabled = false;
}

// Enter to send in inline reply boxes
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.closest('.inline-reply')) {
    e.preventDefault();
    const postId = e.target.closest('.inline-reply').id.replace('reply-', '');
    sendInlineReply(postId);
  }
});

// Soft refresh: fetch new HTML, update feed area without losing textarea state
async function softRefresh() {
  try {
    const r = await fetch('/feed');
    if (!r.ok) return;
    const html = await r.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Save any in-progress text
    const openReplyId = document.querySelector('.inline-reply[style*="flex"]')?.id;
    const openReplyText = openReplyId ? document.querySelector('#' + openReplyId + ' textarea')?.value : '';
    const topText = textarea.value;
    // Replace feed entries
    const oldEntries = document.querySelectorAll('article.entry, .empty');
    const newContainer = doc.querySelectorAll('article.entry, .empty');
    const parent = oldEntries[0]?.parentNode;
    if (parent && newContainer.length) {
      oldEntries.forEach(el => el.remove());
      const footer = document.querySelector('.footer');
      newContainer.forEach(el => parent.insertBefore(el, footer));
    }
    // Update subtitle
    const newSub = doc.querySelector('.subtitle');
    const oldSub = document.querySelector('.subtitle');
    if (newSub && oldSub) oldSub.innerHTML = newSub.innerHTML;
    // Restore in-progress text
    textarea.value = topText;
    if (openReplyId && openReplyText) {
      const box = document.getElementById(openReplyId);
      if (box) { box.style.display = 'flex'; box.querySelector('textarea').value = openReplyText; }
    }
  } catch { /* silent */ }
}

// Auto-refresh every 30s — soft, preserves state
setInterval(softRefresh, 30000);
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
