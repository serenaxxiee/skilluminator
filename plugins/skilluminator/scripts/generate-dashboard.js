#!/usr/bin/env node
/**
 * generate-dashboard.js
 *
 * Reads patterns.json and generates the enhanced Skilluminator analytics dashboard.
 * No external dependencies — pure Node.js.
 *
 * Usage:
 *   node scripts/generate-dashboard.js [--input patterns.json] [--output output/dashboard.html]
 *
 * Dashboard sections (always generated from real patterns.json data):
 *   1. Business Value Overview  — 6 KPI cards
 *   2. Pattern Analytics        — composite score bars, automation×value scatter, monthly hours donut
 *   3. Time Savings Breakdown   — before/after bars with % reduction per pattern
 *   4. Business Value Projection — Gold-candidate ROI narrative with 4 impact metrics
 *   5. Skill Candidate Cards    — full detail with hrs/month, annual savings, impact & scope tags
 *   6. Filtered Patterns        — what was excluded and why
 *
 * Schema: patterns.json patterns[] should include a `businessValue` object:
 *   { hrsMonth, hrsAfter, annualHrsSaved, buildEffort, impact[], scope[] }
 * If missing, the script falls back to zeroes and "not reported".
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// ── CLI args ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  var a = { input: 'patterns.json', output: 'output/dashboard.html' };
  for (var i = 2; i < argv.length; i++) {
    if (argv[i] === '--input'  && argv[i + 1]) a.input  = argv[++i];
    if (argv[i] === '--output' && argv[i + 1]) a.output = argv[++i];
  }
  return a;
}
var args = parseArgs(process.argv);
var inputPath  = resolve(args.input);
var outputPath = resolve(args.output);

// ── Read & parse patterns.json ────────────────────────────────────────────────
var raw;
try { raw = readFileSync(inputPath, 'utf8'); }
catch (e) { console.error('ERROR: Cannot read ' + inputPath + ': ' + e.message); process.exit(1); }

var data;
try { data = JSON.parse(raw); }
catch (e) { console.error('ERROR: Invalid JSON: ' + e.message); process.exit(1); }

// ── Helpers ───────────────────────────────────────────────────────────────────
function n(v, d)  { return typeof v === 'number' ? v : (d || 0); }
function s(v, d)  { return typeof v === 'string' ? v : (d || ''); }
function a(v)     { return Array.isArray(v) ? v : []; }
function esc(x)   { return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function bv(p)    { return p.businessValue || {}; }

// ── Data ──────────────────────────────────────────────────────────────────────
var patterns     = a(data.patterns);
var filtered     = a(data.filteredPatterns);
var timeRange    = s(data.timeRange, 'unknown period');
var analyzedAt   = s(data.analyzedAt, '').slice(0, 10) || 'unknown';
var signalCount  = n(data.signalCount);
var queriesRun   = n(data.queriesRun);
var queryErrors  = n(data.queryErrors);

// Derived KPIs
var totalHrsMonth   = patterns.reduce(function(s, p) { return s + n(bv(p).hrsMonth); }, 0);
var totalHrsAfter   = patterns.reduce(function(s, p) { return s + n(bv(p).hrsAfter); }, 0);
var totalAnnual     = patterns.reduce(function(s, p) { return s + n(bv(p).annualHrsSaved); }, 0);
var workDaysSaved   = Math.round(totalAnnual / 8);
var goldPatterns    = patterns.filter(function(p) { return s(p.tier).toLowerCase() === 'gold'; });
var avgScore        = patterns.length
  ? (patterns.reduce(function(s, p) { return s + n(p.compositeScore); }, 0) / patterns.length).toFixed(1)
  : 0;

// Gold ROI calcs
var goldHrsMonth   = goldPatterns.reduce(function(s, p) { return s + n(bv(p).hrsMonth); }, 0);
var goldHrsAfter   = goldPatterns.reduce(function(s, p) { return s + n(bv(p).hrsAfter); }, 0);
var goldMonthlySaved = (goldHrsMonth - goldHrsAfter).toFixed(0);
var goldAnnualSaved  = (goldPatterns.reduce(function(s, p) { return s + n(bv(p).annualHrsSaved); }, 0)).toFixed(0);
var goldWorkDays     = Math.round(goldAnnualSaved / 8);

var COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#fb923c', '#e879f9'];

// Donut circumference
var DONUT_R = 40;
var DONUT_C = 2 * Math.PI * DONUT_R;

function donutSegments(pats) {
  var total = pats.reduce(function(s, p) { return s + n(bv(p).hrsMonth); }, 0);
  if (!total) return '';
  var offset = 0;
  return pats.map(function(p, i) {
    var pct = n(bv(p).hrsMonth) / total;
    var dash = pct * DONUT_C;
    var seg = '<circle cx="55" cy="55" r="' + DONUT_R + '" fill="none" stroke="' + COLORS[i % COLORS.length] + '" stroke-width="14"' +
      ' stroke-dasharray="' + dash.toFixed(2) + ' ' + (DONUT_C - dash).toFixed(2) + '"' +
      ' stroke-dashoffset="' + (-offset * DONUT_C).toFixed(2) + '"' +
      ' transform="rotate(-90 55 55)" opacity="0.85"/>';
    offset += pct;
    return seg;
  }).join('\n    ');
}

function donutLegend(pats) {
  return pats.map(function(p, i) {
    return '<div class="dli"><div class="dd" style="background:' + COLORS[i % COLORS.length] + '"></div>' +
      '<span>' + esc(p.name.split(' ')[0]) + ' &nbsp;<strong style="color:' + COLORS[i % COLORS.length] + '">' + n(bv(p).hrsMonth) + 'h</strong></span></div>';
  }).join('\n');
}

function scatterPoints(pats) {
  var W = 260, H = 200, pad = 30, iW = W - pad * 2, iH = H - pad * 2;
  return pats.map(function(p, i) {
    var cx = pad + (n(p.automationScore) / 100) * iW;
    var cy = pad + iH - (n(p.valueScore) / 100) * iH;
    var label = esc(p.name.split(' ')[0]);
    return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="7" fill="' + COLORS[i % COLORS.length] + '" opacity="0.85"/>' +
      '<text x="' + (cx + 10).toFixed(1) + '" y="' + (cy + 4).toFixed(1) + '" font-size="9" fill="#94a3b8" font-family="sans-serif">' + label + '</text>';
  }).join('\n  ');
}

function scoreBar(p, i) {
  var color = s(p.tier).toLowerCase() === 'gold' ? '#f59e0b' : '#6b7280';
  var pct = Math.min(100, n(p.compositeScore)).toFixed(0);
  return '<div class="hbar-row">' +
    '<div class="hbar-label"><span class="hbar-name">' + esc(p.name) + '</span>' +
    '<span class="hbar-score">' + n(p.compositeScore) + '</span></div>' +
    '<div class="hbar-bg"><div class="hbar-fill" style="width:' + pct + '%;background:linear-gradient(90deg,' + color + ',' + color + 'aa)"></div></div>' +
    '</div>';
}

function savingsCard(p, i) {
  var bvd      = bv(p);
  var hrsNow   = n(bvd.hrsMonth);
  var hrsAfter = n(bvd.hrsAfter);
  var saved    = hrsNow - hrsAfter;
  var savePct  = hrsNow > 0 ? Math.round((saved / hrsNow) * 100) : 0;
  var maxHrs   = Math.max.apply(null, patterns.map(function(x) { return n(bv(x).hrsMonth, 1); }));
  var tierCls  = s(p.tier).toLowerCase();
  var effort   = s(bvd.buildEffort, 'unknown');
  return '<div class="savings-card">' +
    '<div class="savings-name">' + esc(p.name) + '</div>' +
    '<div class="savings-bar-group">' +
      '<div class="savings-bar-label">Now: ' + hrsNow + ' hrs/mo</div>' +
      '<div class="savings-bar-bg"><div class="savings-bar-fill savings-bar-before" style="width:' + (hrsNow / maxHrs * 100).toFixed(1) + '%"></div></div>' +
    '</div>' +
    '<div class="savings-bar-group">' +
      '<div class="savings-bar-label">With skill: ' + hrsAfter + ' hrs/mo</div>' +
      '<div class="savings-bar-bg"><div class="savings-bar-fill savings-bar-after" style="width:' + (hrsAfter / maxHrs * 100).toFixed(1) + '%"></div></div>' +
    '</div>' +
    '<div style="margin-top:10px">' +
      '<div class="savings-stat">' + savePct + '%</div>' +
      '<div class="savings-stat-label">time reduction &nbsp;·&nbsp; ' + saved.toFixed(1) + ' hrs/mo saved</div>' +
    '</div>' +
    '<div class="savings-tier ' + tierCls + '">' + esc(p.tier) + ' &nbsp;·&nbsp; ' + esc(effort) + ' effort to build</div>' +
    '</div>';
}

function patternCard(p, i) {
  var bvd      = bv(p);
  var tierCls  = s(p.tier).toLowerCase();
  var hrsNow   = n(bvd.hrsMonth);
  var hrsAfter = n(bvd.hrsAfter, '—');
  var annual   = n(bvd.annualHrsSaved);
  var impact   = a(bvd.impact);
  var scope    = a(bvd.scope);
  var sources  = a(p.sources);
  var what     = s(p.candidate && p.candidate.what, s(p.description, ''));
  var skillCmd = p.candidate ? '/skill-creator ' + esc(s(p.candidate.name, p.id)) : '';

  return '<div class="pattern-card ' + tierCls + '">' +
    '<div class="pc-header"><div class="pc-name">' + esc(p.name) + '</div>' +
    '<div class="pc-badge ' + tierCls + '">' + esc(p.tier) + '</div></div>' +

    '<div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:14px">' +
      '<div style="flex:1">' +
        '<div class="pc-score-item" style="margin-bottom:8px">' +
          '<div class="pc-score-label">Automation Potential</div>' +
          '<div class="pc-score-bar-bg"><div class="pc-score-bar" style="width:' + Math.min(100,n(p.automationScore)) + '%;background:linear-gradient(90deg,#60a5fa,#3b82f6)"></div></div>' +
          '<div class="pc-score-num">' + n(p.automationScore) + '/100</div>' +
        '</div>' +
        '<div class="pc-score-item">' +
          '<div class="pc-score-label">Business Value</div>' +
          '<div class="pc-score-bar-bg"><div class="pc-score-bar" style="width:' + Math.min(100,n(p.valueScore)) + '%;background:linear-gradient(90deg,#34d399,#059669)"></div></div>' +
          '<div class="pc-score-num">' + n(p.valueScore) + '/100</div>' +
        '</div>' +
      '</div>' +
      '<div class="pc-composite"><div class="pc-composite-num">' + n(p.compositeScore) + '</div><div class="pc-composite-label">composite</div></div>' +
    '</div>' +

    (what ? '<div class="pc-what">' + esc(what) + '</div>' : '') +

    '<div class="pc-metrics">' +
      '<div class="pc-metric"><div class="pc-metric-value">' + hrsNow + 'h</div><div class="pc-metric-label">hrs/month now</div></div>' +
      '<div class="pc-metric"><div class="pc-metric-value">' + hrsAfter + 'h</div><div class="pc-metric-label">hrs/month after</div></div>' +
      '<div class="pc-metric"><div class="pc-metric-value">' + annual + 'h</div><div class="pc-metric-label">hrs/year saved</div></div>' +
    '</div>' +

    '<div class="pc-tags">' +
      sources.map(function(t) { return '<span class="pc-tag">' + esc(t) + '</span>'; }).join('') +
      impact.map(function(t)  { return '<span class="pc-tag impact">' + esc(t) + '</span>'; }).join('') +
      scope.map(function(t)   { return '<span class="pc-tag scope">' + esc(t) + '</span>'; }).join('') +
    '</div>' +

    (skillCmd ? '<div class="pc-skill">' + esc(skillCmd) + '</div>' : '') +
    '</div>';
}

function filteredCard(f) {
  return '<div class="filtered-card">' +
    '<div class="filtered-name">&#8856; ' + esc(s(f.name)) + '</div>' +
    '<div class="filtered-reason">' + esc(s(f.reason)) + '</div>' +
    '</div>';
}

// ── HTML ──────────────────────────────────────────────────────────────────────
var W = 260, H = 200, pad = 30, iW = W - pad * 2, iH = H - pad * 2;

var html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Skilluminator · Analytics Dashboard</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#0b0b10;--surface:#13131c;--surface2:#1a1a27;
      --border:#252535;--border2:#2e2e45;
      --text:#e2e8f0;--text2:#94a3b8;--text3:#64748b;
      --purple:#a78bfa;--blue:#60a5fa;--green:#34d399;
      --amber:#fbbf24;--gold:#f59e0b;--silver:#94a3b8;
    }
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
    .topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:14px 32px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
    .topbar-left{display:flex;align-items:center;gap:10px}
    .topbar-logo{width:28px;height:28px;background:linear-gradient(135deg,var(--purple),var(--blue));border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px}
    .topbar-title{font-size:15px;font-weight:700}
    .topbar-subtitle{font-size:12px;color:var(--text3)}
    .topbar-right{display:flex;gap:8px;align-items:center}
    .badge{font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;border:1px solid var(--border2);color:var(--text2);background:var(--surface2)}
    .badge.live{color:var(--green);border-color:#34d39930;background:#34d39910}
    .main{padding:28px 32px 60px;max-width:1400px;margin:0 auto}
    .sec{font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px;margin-top:36px}
    .sec:first-child{margin-top:0}
    .kpi-row{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:4px}
    @media(max-width:1100px){.kpi-row{grid-template-columns:repeat(3,1fr)}}
    .kpi-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 16px}
    .kpi-card.accent{border-color:#a78bfa33;background:linear-gradient(135deg,#13131c,#1a1427)}
    .kpi-label{font-size:11px;color:var(--text3);margin-bottom:6px}
    .kpi-value{font-size:26px;font-weight:700;line-height:1}
    .kpi-value.purple{color:var(--purple)}.kpi-value.green{color:var(--green)}.kpi-value.amber{color:var(--amber)}.kpi-value.blue{color:var(--blue)}
    .kpi-sub{font-size:11px;color:var(--text3);margin-top:5px}
    .kpi-delta{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;color:var(--green);background:#34d39912;border:1px solid #34d39928;border-radius:4px;padding:2px 6px;margin-top:5px}
    .charts-row{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;margin-bottom:4px}
    @media(max-width:1100px){.charts-row{grid-template-columns:1fr}}
    .chart-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px}
    .chart-title{font-size:13px;font-weight:600;color:var(--text2);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
    .chart-title span{font-size:11px;color:var(--text3);font-weight:400}
    .hbar-row{margin-bottom:12px}
    .hbar-label{font-size:12px;color:var(--text2);margin-bottom:4px;display:flex;justify-content:space-between;gap:8px}
    .hbar-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
    .hbar-score{color:var(--purple);font-weight:700;flex-shrink:0}
    .hbar-bg{background:var(--border);border-radius:4px;height:8px;overflow:hidden}
    .hbar-fill{height:100%;border-radius:4px}
    .donut-wrap{display:flex;align-items:center;gap:20px}
    .donut-legend{flex:1}
    .dli{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);margin-bottom:8px}
    .dd{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .savings-row{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
    @media(max-width:1100px){.savings-row{grid-template-columns:repeat(2,1fr)}}
    .savings-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px}
    .savings-name{font-size:12px;font-weight:600;color:var(--text);margin-bottom:10px;line-height:1.3}
    .savings-bar-group{margin-bottom:8px}
    .savings-bar-label{font-size:10px;color:var(--text3);margin-bottom:3px}
    .savings-bar-bg{background:var(--border);border-radius:3px;height:6px;overflow:hidden}
    .savings-bar-before{background:#f8717144}
    .savings-bar-after{background:linear-gradient(90deg,var(--green),#059669)}
    .savings-stat{font-size:18px;font-weight:700;color:var(--green)}
    .savings-stat-label{font-size:10px;color:var(--text3)}
    .savings-tier{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;display:inline-block;margin-top:6px}
    .savings-tier.gold{background:#f59e0b18;color:var(--amber);border:1px solid #f59e0b30}
    .savings-tier.silver{background:#94a3b818;color:var(--silver);border:1px solid #94a3b830}
    .roi-card{background:linear-gradient(135deg,#0f0f1a,#13101f);border:1px solid #a78bfa22;border-radius:14px;padding:28px 32px}
    .roi-headline{font-size:18px;font-weight:700;margin-bottom:6px}
    .roi-sub{font-size:13px;color:var(--text3);margin-bottom:24px;line-height:1.5}
    .roi-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
    @media(max-width:900px){.roi-metrics{grid-template-columns:repeat(2,1fr)}}
    .roi-metric{border-left:2px solid var(--border2);padding-left:16px}
    .roi-metric-value{font-size:28px;font-weight:800}
    .roi-metric-value.g{color:var(--green)}.roi-metric-value.p{color:var(--purple)}.roi-metric-value.a{color:var(--amber)}.roi-metric-value.b{color:var(--blue)}
    .roi-metric-label{font-size:11px;color:var(--text3);margin-top:4px}
    .roi-metric-sub{font-size:11px;color:var(--text2);margin-top:2px}
    .patterns-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:18px}
    .pattern-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;position:relative;overflow:hidden;transition:border-color .2s,transform .15s}
    .pattern-card:hover{border-color:#a78bfa44;transform:translateY(-2px)}
    .pattern-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
    .pattern-card.gold::before{background:linear-gradient(90deg,#f59e0b,#fbbf24)}
    .pattern-card.silver::before{background:linear-gradient(90deg,#6b7280,#9ca3af)}
    .pc-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
    .pc-name{font-size:14px;font-weight:700;flex:1;line-height:1.3}
    .pc-badge{font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;margin-left:10px;flex-shrink:0}
    .pc-badge.gold{background:#f59e0b18;color:var(--amber);border:1px solid #f59e0b33}
    .pc-badge.silver{background:#94a3b818;color:var(--silver);border:1px solid #94a3b833}
    .pc-score-item{flex:1}
    .pc-score-label{font-size:10px;color:var(--text3);margin-bottom:3px}
    .pc-score-bar-bg{background:var(--border);border-radius:3px;height:5px;overflow:hidden;margin-bottom:3px}
    .pc-score-bar{height:100%;border-radius:3px}
    .pc-score-num{font-size:11px;color:var(--text3)}
    .pc-composite{text-align:right}
    .pc-composite-num{font-size:28px;font-weight:800;color:var(--purple)}
    .pc-composite-label{font-size:10px;color:var(--text3)}
    .pc-what{font-size:13px;color:var(--text2);line-height:1.55;margin-bottom:12px}
    .pc-metrics{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px}
    .pc-metric{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;text-align:center}
    .pc-metric-value{font-size:15px;font-weight:700;color:var(--green)}
    .pc-metric-label{font-size:10px;color:var(--text3);margin-top:2px}
    .pc-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
    .pc-tag{font-size:10px;padding:2px 8px;border-radius:4px;color:var(--blue);background:#60a5fa0e;border:1px solid #60a5fa1a}
    .pc-tag.impact{color:var(--amber);background:#f59e0b0e;border-color:#f59e0b1a}
    .pc-tag.scope{color:var(--purple);background:#a78bfa0e;border-color:#a78bfa1a}
    .pc-skill{font-size:11px;color:var(--purple);font-family:monospace;opacity:.7}
    .filtered-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    @media(max-width:900px){.filtered-grid{grid-template-columns:1fr}}
    .filtered-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;opacity:.7}
    .filtered-name{font-size:12px;color:var(--text2);font-weight:600;margin-bottom:4px}
    .filtered-reason{font-size:11px;color:var(--text3);line-height:1.4}
    .footer{margin-top:48px;padding-top:20px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);text-align:center}
    .footer code{color:var(--purple)}
  </style>
</head>
<body>

<div class="topbar">
  <div class="topbar-left">
    <div class="topbar-logo">&#9889;</div>
    <div>
      <div class="topbar-title">Skilluminator</div>
      <div class="topbar-subtitle">Work Pattern Analytics &nbsp;&middot;&nbsp; ${esc(timeRange)}</div>
    </div>
  </div>
  <div class="topbar-right">
    <span class="badge">${signalCount} signals</span>
    <span class="badge">${patterns.length} patterns</span>
    <span class="badge live">&#9679; Live data</span>
    <span class="badge">${analyzedAt}</span>
  </div>
</div>

<div class="main">

  <div class="sec">Business Value Overview</div>
  <div class="kpi-row">
    <div class="kpi-card accent">
      <div class="kpi-label">Monthly Hours Automatable</div>
      <div class="kpi-value purple">~${totalHrsMonth}h</div>
      <div class="kpi-sub">across ${patterns.length} patterns</div>
      <div class="kpi-delta">&#9650; All manual today</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Annual Time Savings</div>
      <div class="kpi-value green">~${totalAnnual}h</div>
      <div class="kpi-sub">if all ${patterns.length} skills built</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Annual Work Days Freed</div>
      <div class="kpi-value amber">~${workDaysSaved}</div>
      <div class="kpi-sub">days at 8 hrs/day</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Gold Candidates</div>
      <div class="kpi-value blue">${goldPatterns.length}</div>
      <div class="kpi-sub">composite score ≥ 65</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Avg. Composite Score</div>
      <div class="kpi-value purple">${avgScore}</div>
      <div class="kpi-sub">out of 100</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Signal Coverage</div>
      <div class="kpi-value green">${signalCount}</div>
      <div class="kpi-sub">${queriesRun} queries &middot; ${queryErrors} errors</div>
    </div>
  </div>

  <div class="sec">Pattern Analytics</div>
  <div class="charts-row">

    <div class="chart-card">
      <div class="chart-title">Composite Score Ranking <span>Automation &times; 0.55 + Value &times; 0.45</span></div>
      ${patterns.map(scoreBar).join('\n      ')}
    </div>

    <div class="chart-card">
      <div class="chart-title">Automation vs. Value <span>Quadrant view</span></div>
      <svg width="100%" height="200" viewBox="0 0 ${W} ${H}">
        <rect x="${pad}" y="${pad}" width="${iW/2}" height="${iH/2}" fill="#34d39905"/>
        <rect x="${pad+iW/2}" y="${pad}" width="${iW/2}" height="${iH/2}" fill="#a78bfa08"/>
        <rect x="${pad}" y="${pad+iH/2}" width="${iW/2}" height="${iH/2}" fill="#64748b05"/>
        <rect x="${pad+iW/2}" y="${pad+iH/2}" width="${iW/2}" height="${iH/2}" fill="#60a5fa05"/>
        <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${pad+iH}" stroke="#252535" stroke-width="1"/>
        <line x1="${pad}" y1="${pad+iH}" x2="${pad+iW}" y2="${pad+iH}" stroke="#252535" stroke-width="1"/>
        <line x1="${pad+iW/2}" y1="${pad}" x2="${pad+iW/2}" y2="${pad+iH}" stroke="#252535" stroke-width="0.5" stroke-dasharray="3,3"/>
        <line x1="${pad}" y1="${pad+iH/2}" x2="${pad+iW}" y2="${pad+iH/2}" stroke="#252535" stroke-width="0.5" stroke-dasharray="3,3"/>
        <text x="${pad+2}" y="${pad-6}" font-size="8" fill="#475569" font-family="sans-serif">HIGH VALUE</text>
        <text x="${pad+iW/2+4}" y="${pad-6}" font-size="8" fill="#a78bfa88" font-family="sans-serif">BUILD FIRST</text>
        <text x="${pad+iW-30}" y="${pad+iH+16}" font-size="8" fill="#475569" font-family="sans-serif">AUTOMATE</text>
        ${scatterPoints(patterns)}
      </svg>
    </div>

    <div class="chart-card">
      <div class="chart-title">Monthly Hours by Pattern <span>Before skill</span></div>
      <div class="donut-wrap">
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r="${DONUT_R}" fill="none" stroke="#1e1e2e" stroke-width="14"/>
          ${donutSegments(patterns)}
          <text x="55" y="51" text-anchor="middle" font-size="14" font-weight="700" fill="#e2e8f0" font-family="sans-serif">${totalHrsMonth}</text>
          <text x="55" y="64" text-anchor="middle" font-size="8" fill="#64748b" font-family="sans-serif">hrs/mo</text>
        </svg>
        <div class="donut-legend">${donutLegend(patterns)}</div>
      </div>
    </div>

  </div>

  <div class="sec">Time Savings Breakdown &nbsp;&middot;&nbsp; Per Pattern</div>
  <div class="savings-row">
    ${patterns.map(savingsCard).join('\n    ')}
  </div>

  <div class="sec">Business Value Projection</div>
  <div class="roi-card">
    <div class="roi-headline">If you build all ${goldPatterns.length} Gold candidate${goldPatterns.length !== 1 ? 's' : ''} this quarter</div>
    <div class="roi-sub">
      Based on WorkIQ-confirmed patterns: ${goldPatterns.map(function(p){return esc(p.name);}).join(', ')}.
      Estimates derived from observed signal frequency and current manual effort.
    </div>
    <div class="roi-metrics">
      <div class="roi-metric">
        <div class="roi-metric-value g">~${goldMonthlySaved}h</div>
        <div class="roi-metric-label">Monthly hours freed (Gold only)</div>
        <div class="roi-metric-sub">from ~${goldHrsMonth}h today &#8594; ~${goldHrsAfter}h with skills</div>
      </div>
      <div class="roi-metric">
        <div class="roi-metric-value p">~${goldAnnualSaved}h</div>
        <div class="roi-metric-label">Annual hours freed (Gold only)</div>
        <div class="roi-metric-sub">~${goldWorkDays} full work days/year</div>
      </div>
      <div class="roi-metric">
        <div class="roi-metric-value a">${goldPatterns.length}x</div>
        <div class="roi-metric-label">Patterns ready to automate</div>
        <div class="roi-metric-sub">Low or Medium build effort</div>
      </div>
      <div class="roi-metric">
        <div class="roi-metric-value b">${patterns.length}</div>
        <div class="roi-metric-label">Total patterns identified</div>
        <div class="roi-metric-sub">${filtered.length} filtered · ${patterns.length} scored</div>
      </div>
    </div>
  </div>

  <div class="sec">Skill Candidates &nbsp;&middot;&nbsp; Full Detail</div>
  <div class="patterns-grid">
    ${patterns.map(patternCard).join('\n    ')}
  </div>

  <div class="sec">Filtered Patterns &nbsp;&middot;&nbsp; Not Automated</div>
  <div class="filtered-grid">
    ${filtered.map(filteredCard).join('\n    ')}
  </div>

  <div class="footer">
    Generated by Skilluminator &nbsp;&middot;&nbsp; Camp AIR &nbsp;&middot;&nbsp;
    <code>/skilluminator [time range]</code> to re-analyze &nbsp;&middot;&nbsp;
    <code>/skill-creator [name]</code> to build
  </div>
</div>

</body>
</html>`;

// ── Write output ──────────────────────────────────────────────────────────────
try { mkdirSync(dirname(outputPath), { recursive: true }); } catch (_) {}
writeFileSync(outputPath, html, 'utf8');
console.log('Dashboard written to: ' + outputPath);
console.log('Patterns: ' + patterns.length + ' scored, ' + filtered.length + ' filtered');
console.log('Total monthly hours automatable: ' + totalHrsMonth + 'h');
