#!/usr/bin/env node
/**
 * generate-dashboard.js
 *
 * Reads patterns.json (single-run Skilluminator output) and generates
 * a self-contained HTML dashboard. No external dependencies.
 *
 * Supports two modes:
 *   - "scored" (default): Full dashboard with KPIs, charts, rubric breakdowns.
 *   - "discovery": Interactive pattern cards for Surface & Reflect validation.
 *     Patterns are unscored; user selects which ones to keep via checkboxes.
 *
 * Usage:
 *   node scripts/generate-dashboard.js [--input patterns.json] [--output output/dashboard.html]
 *
 * RULES:
 *   - Every data point in the dashboard comes from patterns.json
 *   - No fabricated or hardcoded data points
 *   - No accumulation across runs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// ─── CLI args ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  var args = { input: 'patterns.json', output: 'output/dashboard.html' };
  for (var i = 2; i < argv.length; i++) {
    if (argv[i] === '--input'  && argv[i + 1]) args.input  = argv[++i];
    if (argv[i] === '--output' && argv[i + 1]) args.output = argv[++i];
  }
  return args;
}

var args = parseArgs(process.argv);
var inputPath  = resolve(args.input);
var outputPath = resolve(args.output);

// ─── Read patterns.json ──────────────────────────────────────────────────────
var raw;
try { raw = readFileSync(inputPath, 'utf8'); }
catch (err) { console.error('ERROR: Cannot read ' + inputPath + ': ' + err.message); process.exit(1); }

var data;
try { data = JSON.parse(raw); }
catch (err) { console.error('ERROR: Invalid JSON in ' + inputPath + ': ' + err.message); process.exit(1); }

var mode = data.mode || 'scored';

var patterns = data.patterns || [];
var timeRange = data.timeRange || 'unknown period';
var weekOf = data.weekOf || (data.analyzedAt ? data.analyzedAt.slice(0, 10) : 'unknown');
var analyzedAt = data.analyzedAt || 'unknown';
var signalCount = data.signalCount || 0;
var queriesRun = data.queriesRun || 0;
var queryErrors = data.queryErrors || [];
var filteredPats = data.filteredPatterns || [];
var unflaggedPats = data.unflaggedPatterns || [];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function num(v, d) { return typeof v === 'number' ? v : (d || 0); }
function str(v, d) { return typeof v === 'string' ? v : (d || ''); }
function arr(v) { return Array.isArray(v) ? v : []; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function pct(n) { return Math.min(100, Math.max(0, n)); }

// ─── Compute derived values (scored mode only) ──────────────────────────────
function tierOf(p) { var c = num(p.compositeScore); return c >= 70 ? 'strong' : c >= 50 ? 'moderate' : 'exploring'; }
function tierLabel(t) { return t === 'strong' ? 'Strong Candidate' : t === 'moderate' ? 'Moderate Candidate' : 'Worth Exploring'; }
function tierColor(t) { return t === 'strong' ? 'var(--green)' : t === 'moderate' ? 'var(--amber)' : 'var(--muted)'; }
var candidates = patterns.filter(function(p) { return num(p.compositeScore) >= 70; });
var strong = patterns.filter(function(p) { return tierOf(p) === 'strong'; });
var moderate = patterns.filter(function(p) { return tierOf(p) === 'moderate'; });
var exploring = patterns.filter(function(p) { return tierOf(p) === 'exploring'; });
var totalHours = patterns.reduce(function(s, p) { return s + num(p.timeSpentHours); }, 0);
var totalSaveable = patterns.reduce(function(s, p) { return s + num(p.estHoursSavedPerWeek); }, 0);
var maxAuto = patterns.reduce(function(m, p) { return Math.max(m, num(p.automationScore)); }, 0);

// Source distribution
var srcCounts = {};
patterns.forEach(function(p) {
  arr(p.sources).forEach(function(s) { srcCounts[s] = (srcCounts[s] || 0) + 1; });
});

var srcClass = { email:'se', meeting:'sm', teams:'sv', document:'sd' };

// ─── Build HTML ──────────────────────────────────────────────────────────────
var h = '';

h += '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
h += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">\n';
h += '<title>Skilluminator' + (mode === 'discovery' ? ' - Discovery' : '') + '</title>\n';

// ─── CSS ─────────────────────────────────────────────────────────────────────
h += '<style>\n';
h += '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n';
h += ':root { --bg:#0f1117; --card:#1a1b2e; --card2:#12131f; --purple:#818cf8; --pink:#c084fc; --green:#22c55e; --amber:#f59e0b; --red:#ef4444; --text:#e2e8f0; --muted:#94a3b8; --border:#2d2f4a; }\n';
h += "body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; min-height:100vh; }\n";
h += '.hdr { padding:2.5rem 2rem 1.5rem; background:linear-gradient(135deg,#0f1117,#1a1020,#0f1117); border-bottom:1px solid var(--border); display:flex; flex-wrap:wrap; align-items:center; gap:1rem; }\n';
h += '.hdr-l { flex:1; min-width:260px; }\n';
h += ".gtitle { font-size:clamp(2rem,5vw,3.2rem); font-weight:800; background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#818cf8); background-size:300% 100%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:gs 5s linear infinite; letter-spacing:-.02em; }\n";
h += '@keyframes gs { 0%{background-position:0% 50%} 100%{background-position:300% 50%} }\n';
h += '.hsub { color:var(--muted); font-size:.9rem; margin-top:.35rem; } .hsub span { color:var(--purple); font-weight:600; }\n';
h += '.badge { display:inline-block; background:linear-gradient(135deg,#818cf820,#c084fc20); border:1px solid #818cf840; border-radius:2rem; padding:.5rem 1.2rem; font-size:.85rem; font-weight:600; color:var(--purple); }\n';
h += '.main { padding:0 2rem 3rem; max-width:1400px; margin:0 auto; }\n';
h += '.stitle { font-size:.7rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin:2rem 0 1rem; padding-bottom:.4rem; border-bottom:1px solid var(--border); }\n';
h += '.krow { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin-top:1.5rem; }\n';
h += '@media(max-width:900px) { .krow { grid-template-columns:repeat(2,1fr); } }\n';
h += '@media(max-width:480px) { .krow { grid-template-columns:1fr; } }\n';
h += '.kcard { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1.4rem 1.6rem; position:relative; overflow:hidden; transition:transform .2s; }\n';
h += '.kcard:hover { transform:translateY(-2px); box-shadow:0 8px 30px #818cf820; }\n';
h += ".kcard::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--purple),var(--pink)); }\n";
h += '.klbl { font-size:.72rem; font-weight:600; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); }\n';
h += '.kval { font-size:clamp(2.2rem,4vw,3rem); font-weight:800; background:linear-gradient(135deg,var(--purple),var(--pink)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; line-height:1.1; margin:.4rem 0 .25rem; }\n';
h += '.ksub { font-size:.75rem; color:var(--muted); }\n';
h += '.charts { display:grid; grid-template-columns:3fr 2fr; gap:1.5rem; }\n';
h += '@media(max-width:1000px) { .charts { grid-template-columns:1fr; } }\n';
h += '.cc { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1.4rem; }\n';
h += '.ctit { font-size:.78rem; font-weight:700; color:var(--text); margin-bottom:1rem; }\n';
h += 'table { width:100%; border-collapse:collapse; font-size:.83rem; }\n';
h += 'thead tr { background:#12131f; }\n';
h += 'th { padding:.75rem 1rem; text-align:left; font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); border-bottom:1px solid var(--border); }\n';
h += 'tbody tr { border-bottom:1px solid #1e2035; transition:background .15s; }\n';
h += 'tbody tr:hover { background:#1e2240; }\n';
h += 'td { padding:.7rem 1rem; }\n';
h += '.rk { font-weight:700; color:var(--purple); font-size:1rem; }\n';
h += '.pn { font-weight:600; } .ps { font-size:.7rem; color:var(--muted); font-family:monospace; }\n';
h += '.sb { display:inline-block; font-size:.62rem; font-weight:600; padding:.15rem .45rem; border-radius:3px; margin:.1rem .15rem .1rem 0; text-transform:uppercase; letter-spacing:.05em; }\n';
h += '.se { background:#1d4ed820; color:#60a5fa; border:1px solid #1d4ed840; }\n';
h += '.sm { background:#15803d20; color:#4ade80; border:1px solid #15803d40; }\n';
h += '.sv { background:#5b21b620; color:#a78bfa; border:1px solid #5b21b640; }\n';
h += '.sd { background:#b4530920; color:#fb923c; border:1px solid #b4530940; }\n';
h += '.bb { background:#2d2f4a; border-radius:4px; height:8px; overflow:hidden; width:110px; }\n';
h += '.bf { height:8px; border-radius:4px; }\n';
h += '.sl { font-size:.75rem; font-weight:700; margin-left:.4rem; }\n';
h += '.tip { position:fixed; background:#1e2240; border:1px solid var(--border); border-radius:8px; padding:.6rem .9rem; font-size:.75rem; pointer-events:none; max-width:280px; z-index:100; display:none; box-shadow:0 8px 24px #00000060; line-height:1.6; }\n';
h += '.tip strong { color:var(--purple); display:block; margin-bottom:.2rem; }\n';
h += '.dleg { display:flex; flex-direction:column; gap:.5rem; margin-top:.5rem; }\n';
h += '.dli { display:flex; align-items:center; gap:.5rem; font-size:.78rem; }\n';
h += '.dd { width:10px; height:10px; border-radius:50%; flex-shrink:0; }\n';
h += '.rubric { font-size:.72rem; color:var(--muted); line-height:1.6; }\n';
h += '.rubric-item { display:flex; justify-content:space-between; padding:.15rem 0; }\n';
h += '.rubric-pts { color:var(--green); font-weight:600; min-width:35px; text-align:right; }\n';
h += '.rubric-pts.neg { color:var(--red); }\n';
h += '.detail { background:var(--card2); border:1px solid var(--border); border-radius:10px; padding:1.2rem; margin-bottom:1rem; }\n';
h += '.detail-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:.8rem; }\n';
h += '.detail-name { font-size:1rem; font-weight:700; }\n';
h += '.detail-score { font-size:1.4rem; font-weight:800; background:linear-gradient(135deg,var(--purple),var(--pink)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }\n';
h += '.detail-desc { font-size:.85rem; line-height:1.6; margin-bottom:.8rem; }\n';
h += '.detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }\n';
h += '@media(max-width:700px) { .detail-grid { grid-template-columns:1fr; } }\n';
h += '.footer { text-align:center; padding:2rem; border-top:1px solid var(--border); font-size:.72rem; color:var(--muted); }\n';

// ─── Discovery mode CSS ───────────────────────────────────────────────────────
if (mode === 'discovery') {
  h += '\n/* ── Discovery mode styles ── */\n';

  // Discovery card grid
  h += '.disc-grid { display:grid; grid-template-columns:1fr; gap:1.2rem; margin-top:1.2rem; padding-bottom:5rem; }\n';
  h += '@media(min-width:900px) { .disc-grid { grid-template-columns:1fr 1fr; } }\n';

  // Discovery card
  h += '.disc-card { background:var(--card); border:2px solid var(--border); border-radius:14px; padding:1.5rem; position:relative; transition:border-color .25s, box-shadow .25s; cursor:pointer; }\n';
  h += '.disc-card:hover { border-color:#818cf860; }\n';
  h += '.disc-card.selected { border-color:var(--purple); box-shadow:0 0 20px #818cf840, 0 0 40px #818cf815; }\n';

  // Checkbox styling for dark theme
  h += '.disc-check { position:absolute; top:1.2rem; right:1.2rem; }\n';
  h += '.disc-check input[type="checkbox"] { appearance:none; -webkit-appearance:none; width:22px; height:22px; border:2px solid var(--border); border-radius:5px; background:var(--card2); cursor:pointer; position:relative; transition:all .2s; }\n';
  h += '.disc-check input[type="checkbox"]:hover { border-color:var(--purple); }\n';
  h += '.disc-check input[type="checkbox"]:checked { background:var(--purple); border-color:var(--purple); }\n';
  h += '.disc-check input[type="checkbox"]:checked::after { content:"\\2713"; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-size:14px; font-weight:700; }\n';

  // Card heading
  h += '.disc-label { font-size:1.1rem; font-weight:700; margin-bottom:.6rem; padding-right:2.5rem; }\n';

  // Sources in card
  h += '.disc-sources { margin-bottom:1rem; }\n';

  // Card section titles
  h += '.disc-stit { font-size:.68rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--purple); margin:1rem 0 .4rem; }\n';

  // Description
  h += '.disc-desc { font-size:.85rem; line-height:1.65; color:var(--text); margin-bottom:.2rem; }\n';

  // Signals list
  h += '.disc-signals { list-style:none; padding:0; }\n';
  h += '.disc-signals li { font-size:.82rem; color:var(--text); padding:.25rem 0 .25rem 1.2rem; position:relative; line-height:1.5; }\n';
  h += '.disc-signals li::before { content:"\\2022"; color:var(--purple); position:absolute; left:0; font-size:1.1rem; line-height:1.3; }\n';

  // Numbers row
  h += '.disc-nums { display:flex; gap:1.5rem; flex-wrap:wrap; }\n';
  h += '.disc-num { background:var(--card2); border:1px solid var(--border); border-radius:8px; padding:.6rem 1rem; }\n';
  h += '.disc-num-val { font-size:1.3rem; font-weight:800; color:var(--purple); }\n';
  h += '.disc-num-lbl { font-size:.65rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin-top:.1rem; }\n';

  // Reflection questions
  h += '.disc-reflect { margin-top:1rem; background:linear-gradient(135deg,#818cf808,#c084fc08); border:1px solid #818cf825; border-radius:8px; padding:.8rem 1rem; }\n';
  h += '.disc-reflect-title { font-size:.65rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--pink); margin-bottom:.4rem; }\n';
  h += '.disc-reflect ol { padding-left:1.2rem; margin:0; }\n';
  h += '.disc-reflect li { font-size:.78rem; color:var(--muted); line-height:1.7; }\n';

  // Sticky footer bar
  h += '.disc-footer { position:fixed; bottom:0; left:0; right:0; background:#12131fF0; backdrop-filter:blur(10px); border-top:2px solid var(--purple); padding:.8rem 2rem; display:flex; align-items:center; justify-content:center; gap:1.5rem; z-index:200; }\n';
  h += '.disc-footer-count { font-size:.95rem; font-weight:700; color:var(--text); }\n';
  h += '.disc-footer-count span { color:var(--purple); }\n';
  h += '.disc-footer-btn { background:linear-gradient(135deg,var(--purple),var(--pink)); color:#fff; border:none; padding:.6rem 1.6rem; border-radius:8px; font-size:.85rem; font-weight:700; cursor:pointer; transition:opacity .2s, transform .15s; }\n';
  h += '.disc-footer-btn:hover { opacity:.9; transform:translateY(-1px); }\n';
  h += '.disc-footer-btn:active { transform:translateY(0); }\n';
  h += '.disc-footer-msg { font-size:.82rem; color:var(--green); font-weight:600; opacity:0; transition:opacity .3s; }\n';
  h += '.disc-footer-msg.show { opacity:1; }\n';
}

h += '</style>\n</head>\n<body>\n';

// ─── Header ──────────────────────────────────────────────────────────────────
h += '<div class="hdr">\n';
h += '  <div class="hdr-l">\n';
h += '    <div class="gtitle">Skilluminator</div>\n';

if (mode === 'discovery') {
  h += '    <div class="hsub">Surface &amp; Reflect &nbsp;&middot;&nbsp; <span>' + esc(timeRange) + '</span> &nbsp;&middot;&nbsp; Week of <span>' + esc(weekOf) + '</span></div>\n';
} else {
  h += '    <div class="hsub">Analyzed <span>' + esc(timeRange) + '</span> &nbsp;&middot;&nbsp; Week of <span>' + esc(weekOf) + '</span> &nbsp;&middot;&nbsp; Generated <span>' + analyzedAt.slice(0, 10) + '</span></div>\n';
}

h += '  </div>\n';

if (mode === 'discovery') {
  h += '  <div><div class="badge">' + signalCount + ' Signals &nbsp;&middot;&nbsp; ' + patterns.length + ' Patterns Found</div></div>\n';
} else {
  h += '  <div><div class="badge">' + signalCount + ' Signals &nbsp;&middot;&nbsp; ' + patterns.length + ' Flagged &nbsp;&middot;&nbsp; ' + strong.length + ' Strong &nbsp;&middot;&nbsp; ' + moderate.length + ' Moderate</div></div>\n';
}

h += '</div>\n';

// ─── Query errors alert ──────────────────────────────────────────────────────
if (queryErrors.length > 0) {
  h += '<div style="background:linear-gradient(90deg,#451a0380,#78350f80);border:1px solid #f59e0b60;border-left:3px solid var(--amber);margin:1rem 2rem;padding:.75rem 1.2rem;border-radius:8px;font-size:.82rem;color:#fde68a">';
  h += '<strong>' + queryErrors.length + ' WorkIQ query error(s):</strong> ' + queryErrors.map(esc).join(', ') + '. Some data may be incomplete.';
  h += '</div>\n';
}

// ─── Main content ────────────────────────────────────────────────────────────
h += '<div class="main">\n';

// ═══════════════════════════════════════════════════════════════════════════════
// DISCOVERY MODE
// ═══════════════════════════════════════════════════════════════════════════════
if (mode === 'discovery') {

  h += '<div class="stitle">Patterns We Found &mdash; Select the ones that feel like real pain points</div>\n';
  h += '<div class="disc-grid">\n';

  patterns.forEach(function(p) {
    var pid = esc(str(p.patternId || p.label));
    var desc = str(p.description);
    var signals = arr(p.signals);
    var occ = num(p.occurrenceCount);
    var hrs = p.timeSpentHours;
    var hrsDisplay = (typeof hrs === 'number' && hrs > 0) ? hrs.toFixed(1) + 'h' : 'not quantified';
    var hrsNote = str(p.timeSpentNote);

    h += '<div class="disc-card" data-pid="' + pid + '" onclick="toggleCard(this)">\n';

    // Checkbox
    h += '  <div class="disc-check"><input type="checkbox" value="' + pid + '" onclick="event.stopPropagation(); toggleCard(this.closest(\'.disc-card\'))"></div>\n';

    // Label
    h += '  <div class="disc-label">' + esc(str(p.label)) + '</div>\n';

    // Sources badges
    h += '  <div class="disc-sources">';
    arr(p.sources).forEach(function(s) {
      h += '<span class="sb ' + (srcClass[s] || '') + '">' + esc(s) + '</span>';
    });
    h += '</div>\n';

    // WHAT WE FOUND
    if (desc) {
      h += '  <div class="disc-stit">What We Found</div>\n';
      h += '  <div class="disc-desc">' + esc(desc) + '</div>\n';
    }

    // SPECIFIC EXAMPLES
    if (signals.length > 0) {
      h += '  <div class="disc-stit">Specific Examples</div>\n';
      h += '  <ul class="disc-signals">\n';
      signals.forEach(function(sig) {
        h += '    <li>' + esc(String(sig)) + '</li>\n';
      });
      h += '  </ul>\n';
    }

    // BY THE NUMBERS
    h += '  <div class="disc-stit">By the Numbers</div>\n';
    h += '  <div class="disc-nums">\n';
    h += '    <div class="disc-num"><div class="disc-num-val">' + occ + '</div><div class="disc-num-lbl">Occurrences</div></div>\n';
    h += '    <div class="disc-num"><div class="disc-num-val">' + esc(hrsDisplay) + '</div><div class="disc-num-lbl">Time Spent' + (hrsNote ? ' (' + esc(hrsNote) + ')' : '') + '</div></div>\n';
    h += '  </div>\n';

    // REFLECTION QUESTIONS
    h += '  <div class="disc-reflect">\n';
    h += '    <div class="disc-reflect-title">Reflect</div>\n';
    h += '    <ol>\n';
    h += '      <li>Does this feel like a real time sink?</li>\n';
    h += '      <li>What part is most tedious?</li>\n';
    h += '      <li>Is any of this already handled by a tool you use?</li>\n';
    h += '    </ol>\n';
    h += '  </div>\n';

    h += '</div>\n'; // disc-card
  });

  h += '</div>\n'; // disc-grid

  // ─── Filtered patterns (already automated by M365) ─ also shown in discovery
  if (filteredPats.length > 0) {
    h += '\n<div class="stitle">Filtered Patterns (already automated by M365)</div>\n';
    h += '<div class="cc"><div style="overflow-x:auto"><table><thead><tr>';
    h += '<th>Pattern</th><th>Reason</th>';
    h += '</tr></thead><tbody>\n';
    filteredPats.forEach(function(f) {
      h += '<tr>';
      h += '<td style="color:var(--muted);text-decoration:line-through">' + esc(str(f.label)) + '</td>';
      h += '<td style="font-size:.8rem;color:var(--muted)">' + esc(str(f.reason)) + '</td>';
      h += '</tr>\n';
    });
    h += '</tbody></table></div></div>\n';
  }

  // ─── Sticky footer bar ────────────────────────────────────────────────────
  h += '<div class="disc-footer">\n';
  h += '  <div class="disc-footer-count"><span id="selCount">0</span> patterns selected</div>\n';
  h += '  <button class="disc-footer-btn" id="copyBtn" onclick="copySelections()">Copy Selections</button>\n';
  h += '  <div class="disc-footer-msg" id="copyMsg">Copied! Paste back into Claude.</div>\n';
  h += '</div>\n';

  // ─── Discovery mode JavaScript ────────────────────────────────────────────
  h += '<script>\n';
  h += 'function toggleCard(card) {\n';
  h += '  var cb = card.querySelector(\'input[type="checkbox"]\');\n';
  h += '  cb.checked = !cb.checked;\n';
  h += '  card.classList.toggle("selected", cb.checked);\n';
  h += '  updateCount();\n';
  h += '}\n';
  h += 'function updateCount() {\n';
  h += '  var boxes = document.querySelectorAll(\'.disc-card input[type="checkbox"]\');\n';
  h += '  var n = 0;\n';
  h += '  boxes.forEach(function(b) { if (b.checked) n++; });\n';
  h += '  document.getElementById("selCount").textContent = n;\n';
  h += '}\n';
  h += 'function copySelections() {\n';
  h += '  var boxes = document.querySelectorAll(\'.disc-card input[type="checkbox"]:checked\');\n';
  h += '  var ids = [];\n';
  h += '  boxes.forEach(function(b) { ids.push(b.value); });\n';
  h += '  var text = ids.join(", ");\n';
  h += '  if (ids.length === 0) { text = "(none selected)"; }\n';
  h += '  navigator.clipboard.writeText(text).then(function() {\n';
  h += '    var msg = document.getElementById("copyMsg");\n';
  h += '    msg.classList.add("show");\n';
  h += '    setTimeout(function() { msg.classList.remove("show"); }, 2500);\n';
  h += '  });\n';
  h += '}\n';
  h += '</script>\n';

// ═══════════════════════════════════════════════════════════════════════════════
// SCORED MODE (default — all existing behavior preserved)
// ═══════════════════════════════════════════════════════════════════════════════
} else {

  // ─── KPI row ─────────────────────────────────────────────────────────────────
  h += '<div class="stitle">Key Metrics</div>\n';
  h += '<div class="krow">\n';

  h += '<div class="kcard"><div class="klbl">Patterns Found</div><div class="kval">' + patterns.length + '</div>';
  h += '<div class="ksub">from ' + signalCount + ' signals across ' + queriesRun + ' queries</div></div>\n';

  h += '<div class="kcard"><div class="klbl">Strong / Moderate / Exploring</div><div class="kval">' + strong.length + ' / ' + moderate.length + ' / ' + exploring.length + '</div>';
  h += '<div class="ksub">user-flagged pain points, tiered by score</div></div>\n';

  h += '<div class="kcard"><div class="klbl">Top Automation Score</div><div class="kval">' + maxAuto + '</div>';
  var topAutoP = patterns.find(function(p) { return num(p.automationScore) === maxAuto; });
  h += '<div class="ksub">' + (topAutoP ? esc(str(topAutoP.candidateSkillName)) : '') + '</div></div>\n';

  h += '<div class="kcard"><div class="klbl">Est. Hours Saveable/Week</div><div class="kval">' + totalSaveable.toFixed(1) + '</div>';
  h += '<div class="ksub">from ' + totalHours.toFixed(1) + 'h observed in ' + esc(timeRange) + '</div></div>\n';

  h += '</div>\n'; // krow

  // ─── Pattern Table ───────────────────────────────────────────────────────────
  h += '\n<div class="stitle">All Patterns (ranked by composite score)</div>\n';
  h += '<div class="cc"><div style="overflow-x:auto">\n';
  h += '<table><thead><tr>';
  h += '<th>#</th><th>Pattern</th><th>Sources</th><th>Signals</th><th>Occ.</th><th>Hours</th>';
  h += '<th>Auto</th><th>Value</th><th>Composite</th><th>Est. Saved/wk</th>';
  h += '</tr></thead><tbody>\n';

  patterns.forEach(function(p, i) {
    var comp = num(p.compositeScore);
    var tier = tierOf(p);
    var tColor = tierColor(tier);
    h += '<tr style="border-left:3px solid ' + tColor + '">';
    h += '<td class="rk">' + (i + 1) + '</td>';
    h += '<td><div class="pn">' + esc(str(p.label)) + '</div><div class="ps" style="color:' + tColor + '">' + tierLabel(tier) + '</div></td>';

    // Sources badges
    h += '<td>';
    arr(p.sources).forEach(function(s) {
      h += '<span class="sb ' + (srcClass[s] || '') + '">' + esc(s) + '</span>';
    });
    h += '</td>';

    h += '<td>' + num(p.signalCount) + '</td>';
    h += '<td>' + num(p.occurrenceCount) + '</td>';
    h += '<td>' + num(p.timeSpentHours).toFixed(1) + 'h</td>';

    // Auto score with bar
    h += '<td><div style="display:flex;align-items:center;gap:.4rem">';
    h += '<div class="bb"><div class="bf" style="width:' + pct(num(p.automationScore)) + '%;background:var(--purple)"></div></div>';
    h += '<span class="sl">' + num(p.automationScore) + '</span></div></td>';

    // Value score with bar
    h += '<td><div style="display:flex;align-items:center;gap:.4rem">';
    h += '<div class="bb"><div class="bf" style="width:' + pct(num(p.valueScore)) + '%;background:var(--pink)"></div></div>';
    h += '<span class="sl">' + num(p.valueScore) + '</span></div></td>';

    // Composite
    h += '<td><span style="font-weight:700;color:' + tColor + '">' + comp.toFixed(1) + '</span></td>';

    h += '<td>' + num(p.estHoursSavedPerWeek).toFixed(1) + 'h</td>';
    h += '</tr>\n';
  });

  h += '</tbody></table>\n</div></div>\n';

  // ─── Charts row: Bubble chart + Source distribution ──────────────────────────
  h += '\n<div class="stitle">Analysis</div>\n';
  h += '<div class="charts">\n';

  // Bubble chart (auto vs value, size = hours)
  h += '<div class="cc">\n';
  h += '<div class="ctit">Automation vs. Value <span style="color:var(--muted);font-weight:400;font-size:.7rem">&mdash; bubble size = hours observed</span></div>\n';
  h += '<svg id="bsvg" viewBox="0 0 620 380" width="100%" style="display:block;overflow:visible">\n';
  h += '<g id="bgr"></g>\n';
  h += '<line x1="56" y1="340" x2="600" y2="340" stroke="#2d2f4a" stroke-width="1"/>\n';
  h += '<line x1="56" y1="10" x2="56" y2="340" stroke="#2d2f4a" stroke-width="1"/>\n';
  h += '</svg>\n';
  h += '<div id="tip" class="tip"></div>\n';
  h += '</div>\n';

  // Source donut
  h += '<div class="cc">\n';
  h += '<div class="ctit">Signal Sources</div>\n';
  h += '<svg id="dsvg" viewBox="0 0 300 300" width="100%" style="display:block"></svg>\n';
  h += '<div class="dleg" id="dleg"></div>\n';
  h += '</div>\n';

  h += '</div>\n'; // charts

  // ─── Skill Candidate Details ─────────────────────────────────────────────────
  if (patterns.length > 0) {
    h += '\n<div class="stitle">Skill Candidates &mdash; Rubric Breakdown</div>\n';

    patterns.forEach(function(p, i) {
      var tier = tierOf(p);
      var tColor = tierColor(tier);
      var autoR = p.automationRubric || {};
      var valR = p.valueRubric || {};

      h += '<div class="detail" style="border-left:3px solid ' + tColor + '">\n';
      h += '<div class="detail-hdr"><div><span class="rk" style="margin-right:.6rem">#' + (i + 1) + '</span>';
      h += '<span class="detail-name">' + esc(str(p.label)) + '</span>';
      h += ' <span style="font-size:.65rem;font-weight:600;padding:.15rem .5rem;border-radius:3px;background:' + tColor + '20;color:' + tColor + ';border:1px solid ' + tColor + '40;margin-left:.5rem">' + tierLabel(tier).toUpperCase() + '</span>';
      h += '</div>';
      h += '<div class="detail-score">' + num(p.compositeScore).toFixed(1) + '</div></div>\n';

      h += '<div class="detail-desc">' + esc(str(p.llmRationale)) + '</div>\n';

      h += '<div class="detail-grid">\n';

      // Automation rubric
      h += '<div><div style="font-size:.72rem;font-weight:700;color:var(--purple);margin-bottom:.4rem">Automation Score: ' + num(p.automationScore) + '/100</div>\n';
      h += '<div class="rubric">\n';
      var autoItems = [
        ['Clear trigger', num(autoR.clearTrigger)],
        ['Fixed output', num(autoR.fixedOutput)],
        ['Same steps', num(autoR.sameSteps)],
        ['No sensitive sign-off', num(autoR.noSensitiveSignoff)],
        ['Single source', num(autoR.singleSource)],
        ['High volume', num(autoR.highVolume)],
        ['Deductions', num(autoR.deductions)]
      ];
      autoItems.forEach(function(item) {
        if (item[1] !== 0) {
          h += '<div class="rubric-item"><span>' + item[0] + '</span><span class="rubric-pts' + (item[1] < 0 ? ' neg' : '') + '">' + (item[1] > 0 ? '+' : '') + item[1] + '</span></div>\n';
        }
      });
      if (str(autoR.notes)) {
        h += '<div style="margin-top:.3rem;font-style:italic;font-size:.68rem;color:#64748b">' + esc(str(autoR.notes)) + '</div>\n';
      }
      h += '</div></div>\n';

      // Value rubric
      h += '<div><div style="font-size:.72rem;font-weight:700;color:var(--pink);margin-bottom:.4rem">Value Score: ' + num(p.valueScore) + '/100</div>\n';
      h += '<div class="rubric">\n';
      var valItems = [
        ['High time cost', num(valR.timeCost)],
        ['High frequency', num(valR.frequency)],
        ['Blocks others', num(valR.blocksOthers)],
        ['Critical workflow', num(valR.criticalWorkflow)],
        ['Pain expressed', num(valR.painExpressed)],
        ['Deductions', num(valR.deductions)]
      ];
      valItems.forEach(function(item) {
        if (item[1] !== 0) {
          h += '<div class="rubric-item"><span>' + item[0] + '</span><span class="rubric-pts' + (item[1] < 0 ? ' neg' : '') + '">' + (item[1] > 0 ? '+' : '') + item[1] + '</span></div>\n';
        }
      });
      if (str(valR.notes)) {
        h += '<div style="margin-top:.3rem;font-style:italic;font-size:.68rem;color:#64748b">' + esc(str(valR.notes)) + '</div>\n';
      }
      h += '</div></div>\n';

      h += '</div>\n'; // detail-grid

      // Hours estimate
      h += '<div style="margin-top:.8rem;background:#818cf808;border:1px solid #818cf825;border-radius:6px;padding:.6rem .85rem;font-size:.78rem">';
      h += '<strong style="color:var(--purple)">Est. savings:</strong> ~' + num(p.estHoursSavedPerWeek).toFixed(1) + ' hrs/week ';
      if (num(p.timeSpentHours) > 0) {
        var savePctVal = Math.round(num(p.estHoursSavedPerWeek) / num(p.timeSpentHours) * 100);
        h += '<span style="color:var(--muted)">(' + num(p.timeSpentHours).toFixed(1) + 'h observed &times; ' + savePctVal + '% automation estimate)</span>';
      } else {
        h += '<span style="color:var(--muted)">(time not reported by WorkIQ &mdash; estimate based on frequency only)</span>';
      }
      h += '</div>\n';

      h += '</div>\n'; // detail
    });
  }

  // ─── Filtered patterns (already automated by M365) ──────────────────────────
  if (filteredPats.length > 0) {
    h += '\n<div class="stitle">Filtered Patterns (already automated by M365)</div>\n';
    h += '<div class="cc"><div style="overflow-x:auto"><table><thead><tr>';
    h += '<th>Pattern</th><th>Reason</th>';
    h += '</tr></thead><tbody>\n';
    filteredPats.forEach(function(f) {
      h += '<tr>';
      h += '<td style="color:var(--muted);text-decoration:line-through">' + esc(str(f.label)) + '</td>';
      h += '<td style="font-size:.8rem;color:var(--muted)">' + esc(str(f.reason)) + '</td>';
      h += '</tr>\n';
    });
    h += '</tbody></table></div></div>\n';
  }

  // ─── Unflagged patterns (user did not select) ───────────────────────────────
  if (unflaggedPats.length > 0) {
    h += '\n<div class="stitle">Unflagged Patterns (presented but not selected by user)</div>\n';
    h += '<div class="cc"><div style="overflow-x:auto"><table><thead><tr>';
    h += '<th>Pattern</th><th>Reason</th>';
    h += '</tr></thead><tbody>\n';
    unflaggedPats.forEach(function(u) {
      h += '<tr>';
      h += '<td style="color:var(--muted)">' + esc(str(u.label)) + '</td>';
      h += '<td style="font-size:.8rem;color:var(--muted)">' + esc(str(u.reason || 'Not flagged as a pain point')) + '</td>';
      h += '</tr>\n';
    });
    h += '</tbody></table></div></div>\n';
  }

  // ─── JS: Bubble chart ────────────────────────────────────────────────────────
  h += '<script>\n';
  h += '(function(){\n';
  h += 'var P=' + JSON.stringify(patterns.map(function(p) {
    return {
      id: str(p.patternId),
      L: str(p.label),
      a: num(p.automationScore),
      v: num(p.valueScore),
      c: num(p.compositeScore),
      h: num(p.timeSpentHours),
      tier: tierOf(p)
    };
  })) + ';\n';

  h += 'var svg=document.getElementById("bsvg");\n';
  h += 'var ns="http://www.w3.org/2000/svg";\n';
  h += 'var W=620,H=380,pL=56,pR=20,pT=10,pB=40;\n';
  h += 'var pw=W-pL-pR, ph=H-pT-pB;\n';

  // Axis range: 0-100 for both
  h += 'function xS(v){return pL+(v/100)*pw;}\n';
  h += 'function yS(v){return pT+ph-(v/100)*ph;}\n';
  h += 'function rS(v){return Math.max(5,Math.min(24,4+v*1.8));}\n';

  // Grid
  h += '[0,20,40,60,80,100].forEach(function(v){\n';
  h += '  var l=document.createElementNS(ns,"line");l.setAttribute("x1",xS(v));l.setAttribute("y1",pT);l.setAttribute("x2",xS(v));l.setAttribute("y2",H-pB);l.setAttribute("stroke","#1e2035");l.setAttribute("stroke-dasharray","4 4");svg.appendChild(l);\n';
  h += '  var l2=document.createElementNS(ns,"line");l2.setAttribute("x1",pL);l2.setAttribute("y1",yS(v));l2.setAttribute("x2",W-pR);l2.setAttribute("y2",yS(v));l2.setAttribute("stroke","#1e2035");l2.setAttribute("stroke-dasharray","4 4");svg.appendChild(l2);\n';
  h += '  var t=document.createElementNS(ns,"text");t.setAttribute("x",xS(v));t.setAttribute("y",H-pB+14);t.setAttribute("text-anchor","middle");t.setAttribute("fill","#64748b");t.setAttribute("font-size","10");t.textContent=v;svg.appendChild(t);\n';
  h += '  var t2=document.createElementNS(ns,"text");t2.setAttribute("x",pL-6);t2.setAttribute("y",yS(v)+4);t2.setAttribute("text-anchor","end");t2.setAttribute("fill","#64748b");t2.setAttribute("font-size","10");t2.textContent=v;svg.appendChild(t2);\n';
  h += '});\n';

  // Axis labels
  h += 'var xl=document.createElementNS(ns,"text");xl.setAttribute("x",pL+pw/2);xl.setAttribute("y",H-2);xl.setAttribute("text-anchor","middle");xl.setAttribute("fill","#64748b");xl.setAttribute("font-size","11");xl.textContent="Automation Score \\u2192";svg.appendChild(xl);\n';
  h += 'var yl=document.createElementNS(ns,"text");yl.setAttribute("x",12);yl.setAttribute("y",pT+ph/2);yl.setAttribute("text-anchor","middle");yl.setAttribute("fill","#64748b");yl.setAttribute("font-size","11");yl.setAttribute("transform","rotate(-90,12,"+(pT+ph/2)+")");yl.textContent="Value Score \\u2192";svg.appendChild(yl);\n';

  // 70-threshold lines
  h += 'var tl=document.createElementNS(ns,"line");tl.setAttribute("x1",xS(70));tl.setAttribute("y1",pT);tl.setAttribute("x2",xS(70));tl.setAttribute("y2",H-pB);tl.setAttribute("stroke","#818cf830");tl.setAttribute("stroke-width","1.5");svg.appendChild(tl);\n';
  h += 'var tl2=document.createElementNS(ns,"line");tl2.setAttribute("x1",pL);tl2.setAttribute("y1",yS(70));tl2.setAttribute("x2",W-pR);tl2.setAttribute("y2",yS(70));tl2.setAttribute("stroke","#818cf830");tl2.setAttribute("stroke-width","1.5");svg.appendChild(tl2);\n';

  // Tooltip
  h += 'var tip=document.getElementById("tip");\n';

  // Draw bubbles — ONLY from actual pattern data
  h += 'P.forEach(function(b){\n';
  h += '  var cx=xS(b.a),cy=yS(b.v),r=rS(b.h);\n';
  h += '  var col=b.tier==="strong"?"#22c55e":b.tier==="moderate"?"#f59e0b":"#818cf8";\n';
  h += '  var g=document.createElementNS(ns,"g");g.style.cursor="pointer";\n';
  h += '  var c=document.createElementNS(ns,"circle");c.setAttribute("cx",cx);c.setAttribute("cy",cy);c.setAttribute("r",r);c.setAttribute("fill",col);c.setAttribute("fill-opacity","0.25");c.setAttribute("stroke",col);c.setAttribute("stroke-width","1.5");g.appendChild(c);\n';

  // Label top candidates
  h += '  if(b.tier!=="exploring"){var lb=document.createElementNS(ns,"text");lb.setAttribute("x",cx);lb.setAttribute("y",cy-r-3);lb.setAttribute("text-anchor","middle");lb.setAttribute("fill","#94a3b8");lb.setAttribute("font-size","9");lb.textContent=b.id.split("-").slice(0,3).join("-");g.appendChild(lb);}\n';

  // Tooltip events
  h += '  g.addEventListener("mouseenter",function(e){tip.style.display="block";tip.innerHTML="<strong>"+b.L+"</strong>Auto: "+b.a+" &middot; Value: "+b.v+"<br>Composite: "+b.c.toFixed(1)+"<br>Hours: "+b.h.toFixed(1)+"h";});\n';
  h += '  g.addEventListener("mousemove",function(e){tip.style.left=(e.clientX+12)+"px";tip.style.top=(e.clientY-10)+"px";});\n';
  h += '  g.addEventListener("mouseleave",function(){tip.style.display="none";});\n';
  h += '  svg.appendChild(g);\n';
  h += '});\n';
  h += '})();\n';

  // ─── JS: Donut chart ─────────────────────────────────────────────────────────
  h += '(function(){\n';
  h += 'var src=' + JSON.stringify(srcCounts) + ';\n';
  h += 'var colors={email:"#60a5fa",meeting:"#4ade80",teams:"#a78bfa",document:"#fb923c"};\n';
  h += 'var svg=document.getElementById("dsvg");\n';
  h += 'var ns="http://www.w3.org/2000/svg";\n';
  h += 'var cx=150,cy=135,R=100,r=60;\n';
  h += 'var total=0;Object.keys(src).forEach(function(k){total+=src[k];});\n';
  h += 'if(total===0)return;\n';
  h += 'var angle=-Math.PI/2;\n';
  h += 'var leg=document.getElementById("dleg");\n';
  h += 'Object.keys(src).forEach(function(k){\n';
  h += '  var pct=src[k]/total;\n';
  h += '  var a1=angle,a2=angle+pct*Math.PI*2;\n';
  h += '  var lg=pct>0.5?1:0;\n';
  h += '  var x1o=cx+R*Math.cos(a1),y1o=cy+R*Math.sin(a1);\n';
  h += '  var x2o=cx+R*Math.cos(a2),y2o=cy+R*Math.sin(a2);\n';
  h += '  var x1i=cx+r*Math.cos(a2),y1i=cy+r*Math.sin(a2);\n';
  h += '  var x2i=cx+r*Math.cos(a1),y2i=cy+r*Math.sin(a1);\n';
  h += '  var d="M"+x1o+","+y1o+" A"+R+","+R+" 0 "+lg+" 1 "+x2o+","+y2o+" L"+x1i+","+y1i+" A"+r+","+r+" 0 "+lg+" 0 "+x2i+","+y2i+" Z";\n';
  h += '  var p=document.createElementNS(ns,"path");p.setAttribute("d",d);p.setAttribute("fill",colors[k]||"#818cf8");p.setAttribute("fill-opacity","0.8");svg.appendChild(p);\n';
  h += '  var mx=cx+(R+r)/2*Math.cos((a1+a2)/2),my=cy+(R+r)/2*Math.sin((a1+a2)/2);\n';
  h += '  if(pct>=0.1){var t=document.createElementNS(ns,"text");t.setAttribute("x",mx);t.setAttribute("y",my+4);t.setAttribute("text-anchor","middle");t.setAttribute("fill","#fff");t.setAttribute("font-size","11");t.setAttribute("font-weight","700");t.textContent=src[k];svg.appendChild(t);}\n';
  h += '  angle=a2;\n';
  h += '  var li=document.createElement("div");li.className="dli";li.innerHTML=\'<div class="dd" style="background:\'+(colors[k]||"#818cf8")+\'"></div>\'+k+" ("+src[k]+" &middot; "+Math.round(pct*100)+"%)";leg.appendChild(li);\n';
  h += '});\n';
  h += '})();\n';

  h += '</script>\n';

} // end scored mode

// ─── Footer ──────────────────────────────────────────────────────────────────
h += '</div>\n'; // main

if (mode !== 'discovery') {
  h += '<div class="footer">';
  h += 'Skilluminator &middot; Analyzed ' + esc(timeRange) + ' &middot; ' + analyzedAt.slice(0, 10);
  h += ' &middot; ' + patterns.length + ' patterns from ' + signalCount + ' signals';
  if (queryErrors.length > 0) {
    h += ' &middot; ' + queryErrors.length + ' query error(s)';
  }
  h += '<br>All data sourced from WorkIQ M365 analysis. Scores use explicit rubrics shown above. Estimates are heuristic.';
  h += '</div>\n';
}

h += '</body>\n</html>\n';

// ─── Write output ────────────────────────────────────────────────────────────
var outDir = dirname(outputPath);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(outputPath, h, 'utf8');

console.log('Dashboard generated: ' + outputPath + ' (mode: ' + mode + ')');
console.log('  Patterns: ' + patterns.length + (mode === 'scored' ? ' (' + candidates.length + ' candidates)' : ''));
console.log('  Signals: ' + signalCount);
console.log('  Time range: ' + timeRange);
if (filteredPats.length > 0) {
  console.log('  Filtered: ' + filteredPats.length);
}
if (queryErrors.length > 0) {
  console.log('  Query errors: ' + queryErrors.length);
}
