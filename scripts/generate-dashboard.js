#!/usr/bin/env node
/**
 * generate-dashboard.js
 *
 * Reads data/patterns.json and generates a self-contained HTML dashboard
 * in the Skilluminator cycle 62 visual style.
 *
 * Usage:
 *   node scripts/generate-dashboard.js [--input data/patterns.json] [--output output/dashboard.html]
 *
 * No external dependencies required — CommonJS / .cjs compatible.
 * Works in both CommonJS and ESM contexts (handles "type":"module" in package.json).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var fs   = { readFileSync, writeFileSync, existsSync, mkdirSync };
var path = { resolve, dirname };

// ─── CLI argument parsing ────────────────────────────────────────────────────
function parseArgs(argv) {
  var args = { input: 'data/patterns.json', output: 'output/dashboard.html' };
  for (var i = 2; i < argv.length; i++) {
    if (argv[i] === '--input'  && argv[i + 1]) { args.input  = argv[++i]; }
    if (argv[i] === '--output' && argv[i + 1]) { args.output = argv[++i]; }
  }
  return args;
}

var args = parseArgs(process.argv);
var inputPath  = path.resolve(args.input);
var outputPath = path.resolve(args.output);

// ─── Read & parse patterns.json ──────────────────────────────────────────────
var raw;
try {
  raw = fs.readFileSync(inputPath, 'utf8');
} catch (err) {
  console.error('ERROR: Cannot read input file: ' + inputPath);
  console.error(err.message);
  process.exit(1);
}

var data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error('ERROR: Invalid JSON in: ' + inputPath);
  console.error(err.message);
  process.exit(1);
}

var patterns       = data.patterns || [];
var totalCycles    = data.totalCyclesRun || data.lastUpdatedCycle || 1;
var cycleNumber    = data.lastUpdatedCycle || totalCycles;
var weekOf         = data.weekOf || new Date().toISOString().slice(0, 10);
var sgiData        = data.skillGeneratorInput || {};
var orgWideRaw     = data.orgWidePatterns || [];

// ─── Detect harvest failures for alert banner ────────────────────────────────
// Look for any harvestStatus key that mentions FAIL for the current cycle
var harvestAlert   = '';
var dataFrozenAt   = null;
var consecutiveFails = 0;
var harvestStatusKeys = Object.keys(data).filter(function (k) { return /^harvestStatus/i.test(k); });
// Sort by cycle number descending
harvestStatusKeys.sort(function (a, b) {
  var na = parseInt(a.replace(/\D/g, ''), 10) || 0;
  var nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
  return nb - na;
});

// Check if the most recent harvest status indicates failure
if (harvestStatusKeys.length > 0) {
  var latestKey = harvestStatusKeys[0];
  var latestStatus = data[latestKey] || '';
  if (/HARVEST SUCCEEDED/i.test(latestStatus)) {
    // Most recent harvest succeeded — check if there were prior failures mentioned
    var streakMatch = latestStatus.match(/CONSECUTIVE FAILURE STREAK BROKEN after (\d+)/i);
    if (streakMatch) {
      // Streak was broken this cycle — no alert needed
      harvestAlert = '';
    }
  } else if (/HARVEST FAILED/i.test(latestStatus)) {
    // Count consecutive failures
    var failMatch = latestStatus.match(/CONSECUTIVE FAILURE #?(\d+)/i);
    consecutiveFails = failMatch ? parseInt(failMatch[1], 10) : 1;
    // Find the last successful cycle from pattern data
    var maxLastSeen = 0;
    patterns.forEach(function (p) {
      if ((p.lastSeenCycle || 0) > maxLastSeen && p.trend !== 'archived') {
        maxLastSeen = p.lastSeenCycle;
      }
    });
    dataFrozenAt = maxLastSeen || null;
    harvestAlert = 'WorkIQ Connectivity Outage &mdash; Consecutive Failure #' + consecutiveFails +
      ' (Skilluminator Cycles ' + (cycleNumber - consecutiveFails + 1) + '&ndash;' + cycleNumber + ').' +
      ' All WorkIQ queries returned null. Pattern data frozen at cycle ' + (dataFrozenAt || '?') +
      ' (last successful harvest). Source-Failure Guard ACTIVE: archival frozen, trend downgrades suspended.' +
      ' Action: verify M365 Copilot license &middot; re-accept WorkIQ EULA &middot; check M365 service health dashboard at admin.microsoft.com.';
  }
}

// ─── Helper: safe field access ───────────────────────────────────────────────
function num(v, def)  { return typeof v === 'number' ? v : (def || 0); }
function str(v, def)  { return typeof v === 'string' ? v : (def || ''); }
function arr(v)       { return Array.isArray(v) ? v : []; }

// ─── Build P array (all patterns, excluding archived for display) ────────────
var activePatterns = patterns.filter(function (p) { return p.trend !== 'archived'; });
var allPatternsP = activePatterns.map(function (p) {
  return {
    id: str(p.patternId, ''),
    L:  str(p.label, ''),
    K:  str(p.candidateSkillName, ''),
    S:  arr(p.sources),
    a:  num(p.automationScore),
    v:  num(p.valueScore),
    t:  str(p.trend, 'stable'),
    h:  num(p.timeSpentHoursTotal),
    o:  num(p.occurrenceCount),
    m:  str(p.maturity, 'confirmed')
  };
});

// ─── Build OW array (composite scores, sorted descending) ────────────────────
var owArray = activePatterns.map(function (p) {
  return {
    id: str(p.patternId, ''),
    s:  Math.round((num(p.automationScore) + num(p.valueScore)) / 2),
    n:  num(p.participantCount, 1)
  };
}).sort(function (a, b) { return b.s - a.s; });

// ─── Build SG array (top 5 skill generator candidates) ──────────────────────
var sgCandidates = sgiData.candidateSkills || [];
// If no SGI data, derive from patterns
if (sgCandidates.length === 0) {
  var sorted = activePatterns.slice().sort(function (a, b) {
    var sa = (num(a.automationScore) + num(a.valueScore)) / 2;
    var sb = (num(b.automationScore) + num(b.valueScore)) / 2;
    return sb - sa;
  });
  sgCandidates = sorted.slice(0, 5).map(function (p, i) {
    return {
      rank: i + 1,
      name: str(p.candidateSkillName),
      compositeScore: Math.round((num(p.automationScore) + num(p.valueScore)) / 2),
      automationScore: num(p.automationScore),
      valueScore: num(p.valueScore),
      patternId: str(p.patternId),
      description: generateDescription(p),
      triggerExamples: generateTriggers(p),
      valueProposition: generateValueProp(p)
    };
  });
}

var sgArray = sgCandidates.slice(0, 5).map(function (c) {
  return {
    rank:            num(c.rank, 1),
    name:            str(c.name, ''),
    compositeScore:  num(c.compositeScore),
    automationScore: num(c.automationScore),
    valueScore:      num(c.valueScore),
    patternId:       str(c.patternId, ''),
    description:     str(c.description, ''),
    triggerExamples: arr(c.triggerExamples).slice(0, 3),
    valueProposition: str(c.valueProposition, '')
  };
});

// ─── Build PT object (per-pattern trigger examples and "why" text) ───────────
// Top ~15 by composite score
var topForPT = activePatterns.slice().sort(function (a, b) {
  var sa = (num(a.automationScore) + num(a.valueScore)) / 2;
  var sb = (num(b.automationScore) + num(b.valueScore)) / 2;
  return sb - sa;
}).slice(0, 15);

var ptObject = {};
topForPT.forEach(function (p) {
  var savePct = Math.round(num(p.automationScore) * 0.92);
  ptObject[p.patternId] = {
    savePct: savePct,
    triggers: generateTriggers(p),
    why: generateWhy(p)
  };
});

// ─── Build AP array (top 5 action plan cards by time impact) ─────────────────
var apColors = ['#22c55e', '#818cf8', '#c084fc', '#f472b6', '#fb923c'];
var topByTime = activePatterns.slice().sort(function (a, b) {
  var ia = (num(a.timeSpentHoursTotal) / totalCycles) * (num(a.automationScore) / 100);
  var ib = (num(b.timeSpentHoursTotal) / totalCycles) * (num(b.automationScore) / 100);
  return ib - ia;
}).slice(0, 5);

var apArray = topByTime.map(function (p, i) {
  var hpw = num(p.timeSpentHoursTotal) / totalCycles;
  var savePct = Math.round(num(p.automationScore) * 0.92);
  var save = hpw * savePct / 100;
  var tColor = p.trend === 'rising' ? '#22c55e' : (p.trend === 'declining' ? '#ef4444' : '#94a3b8');
  return {
    id:     str(p.patternId),
    rank:   i + 1,
    hpw:    parseFloat(hpw.toFixed(1)),
    save:   parseFloat(save.toFixed(1)),
    sColor: apColors[i] || '#818cf8',
    tColor: tColor,
    trend:  str(p.trend, 'stable'),
    action: generateAction(p)
  };
});

// ─── Build TLD array (timeline) ─────────────────────────────────────────────
var tldArray = generateTimeline(patterns, cycleNumber, totalCycles);

// ─── Key metrics ─────────────────────────────────────────────────────────────
var kv1 = patterns.length; // total patterns count
var kv2 = 0; // max automation score
patterns.forEach(function (p) { if (num(p.automationScore) > kv2) kv2 = num(p.automationScore); });
var kv3 = 0; // total estimated hours saved per week
activePatterns.forEach(function (p) {
  kv3 += (num(p.timeSpentHoursTotal) / totalCycles) * (num(p.automationScore) / 100);
});
kv3 = parseFloat(kv3.toFixed(1));
var kv4 = 0; // count of patterns with composite >= 89
activePatterns.forEach(function (p) {
  if (Math.round((num(p.automationScore) + num(p.valueScore)) / 2) >= 89) kv4++;
});

// Compute source distribution for donut chart
var srcCounts = {};
activePatterns.forEach(function (p) {
  arr(p.sources).forEach(function (s) {
    srcCounts[s] = (srcCounts[s] || 0) + 1;
  });
});
var srcTotal = 0;
Object.keys(srcCounts).forEach(function (k) { srcTotal += srcCounts[k]; });

var archivedCount = patterns.filter(function (p) { return p.trend === 'archived' || p.maturity === 'archived'; }).length;

// ─── Text generation helpers ─────────────────────────────────────────────────
function generateDescription(p) {
  var rationale = str(p.llmRationale, '');
  // Take a condensed version of the rationale
  var desc = str(p.label) + '. ' + num(p.occurrenceCount) + ' occurrences across ' +
    arr(p.sources).join(', ') + ' sources. ';
  if (rationale.length > 0) {
    // Extract key phrase from rationale (first sentence-ish)
    var sentences = rationale.split(/\.\s+/);
    if (sentences.length > 1) {
      desc += sentences.slice(0, 2).join('. ') + '.';
    }
  }
  return desc;
}

function generateTriggers(p) {
  var label   = str(p.label, 'this pattern');
  var skill   = str(p.candidateSkillName, 'the skill');
  var sources = arr(p.sources);
  var src0    = sources[0] || 'data';
  var src1    = sources[1] || sources[0] || 'data';

  var triggers = [];

  // Generate contextual triggers based on sources and label
  if (sources.indexOf('meeting') >= 0) {
    triggers.push('Run ' + skill + ' after your next meeting to auto-extract key outputs');
  }
  if (sources.indexOf('email') >= 0) {
    triggers.push('Pipe incoming ' + src0 + ' data through ' + skill + ' for instant classification');
  }
  if (sources.indexOf('teams') >= 0) {
    triggers.push('Point ' + skill + ' at Teams thread to consolidate into structured output');
  }
  if (sources.indexOf('document') >= 0 && triggers.length < 3) {
    triggers.push('Feed document artifacts into ' + skill + ' for automated processing');
  }

  // Fill up to 3
  if (triggers.length < 3) {
    triggers.push('Trigger ' + skill + ' on next occurrence of ' + label);
  }
  if (triggers.length < 3) {
    triggers.push('Schedule ' + skill + ' to run on ' + src1 + ' inputs weekly');
  }

  return triggers.slice(0, 3);
}

function generateWhy(p) {
  var occ  = num(p.occurrenceCount);
  var hrs  = num(p.timeSpentHoursTotal);
  var auto = num(p.automationScore);
  var trend = str(p.trend, 'stable');
  var rationale = str(p.llmRationale, '');
  var savePct = Math.round(auto * 0.92);

  var why = '<strong>' + occ + ' occurrences, ' + hrs.toFixed(1) + 'h total.</strong> ';

  if (trend === 'rising') {
    why += 'Rising trend &mdash; demand is growing. ';
  }

  if (auto >= 90) {
    why += 'Very high automation potential (' + auto + ') &mdash; pattern is rule-based and consistent. ';
  } else if (auto >= 80) {
    why += 'Strong automation potential (' + auto + ') &mdash; pattern is templatable and recurring. ';
  } else if (auto >= 70) {
    why += 'Good automation potential (' + auto + ') &mdash; many aspects are structurally repetitive. ';
  }

  why += 'Automating ~' + savePct + '% of this work reclaims ' +
    (hrs / totalCycles * savePct / 100).toFixed(1) + 'h per week.';

  return why;
}

function generateAction(p) {
  var skill = str(p.candidateSkillName, 'the skill');
  var label = str(p.label, 'this pattern');
  var sources = arr(p.sources);
  var src0 = sources[0] || 'data';

  var hpw = num(p.timeSpentHoursTotal) / totalCycles;
  var savePct = Math.round(num(p.automationScore) * 0.92);
  var saveHrs = (hpw * savePct / 100).toFixed(1);

  if (sources.indexOf('meeting') >= 0 && sources.indexOf('email') >= 0) {
    return 'Run <strong>' + skill + '</strong> after meetings and on incoming email. Get structured outputs in minutes. Reclaim ~' + saveHrs + 'h per week.';
  }
  if (sources.indexOf('meeting') >= 0) {
    return 'Run <strong>' + skill + '</strong> on your next meeting transcript or agenda. Automate the ' + label.toLowerCase() + ' workflow and save ~' + saveHrs + 'h per week.';
  }
  if (sources.indexOf('email') >= 0) {
    return 'Let <strong>' + skill + '</strong> pre-process your ' + src0 + ' inbox. Automated classification before you open a single item. Save ~' + saveHrs + 'h per week.';
  }
  return 'Use <strong>' + skill + '</strong> on your ' + src0 + ' inputs to automate ' + label.toLowerCase() + '. Save ~' + saveHrs + 'h per week.';
}

function generateTimeline(allPatterns, cycle, total) {
  var tl = [];
  // Group firstSeenCycle into ranges
  var ranges = [
    { lo: 1,  hi: 3,  label: 'Cycles 1\u20133',  phase: 'Foundation',   dot: '' },
    { lo: 4,  hi: 8,  label: 'Cycles 4\u20138',  phase: 'Expansion',   dot: '' },
    { lo: 9,  hi: 17, label: 'Cycles 9\u201317', phase: 'Cluster Surge', dot: '' },
    { lo: 18, hi: 26, label: 'Cycles 18\u201326', phase: 'Pipeline Spawning', dot: 'p' },
    { lo: 27, hi: 53, label: 'Cycles 27\u201353', phase: 'Deep Maturity',  dot: '' }
  ];

  ranges.forEach(function (r) {
    var pats = allPatterns.filter(function (p) {
      return num(p.firstSeenCycle) >= r.lo && num(p.firstSeenCycle) <= r.hi;
    });
    if (pats.length === 0) return;
    var names = pats.slice(0, 4).map(function (p) { return str(p.candidateSkillName); }).join(', ');
    var extra = pats.length > 4 ? ' (+' + (pats.length - 4) + ' more)' : '';
    tl.push({
      d: r.dot,
      c: r.label,
      l: r.phase,
      x: pats.length + ' patterns established: ' + names + extra + '.'
    });
  });

  // Newer patterns (cycle 54+)
  var newPatterns = allPatterns.filter(function (p) {
    return num(p.firstSeenCycle) >= 54;
  });
  if (newPatterns.length > 0) {
    var newNames = newPatterns.map(function (p) { return str(p.candidateSkillName); }).join(', ');
    tl.push({
      d: 'p',
      c: 'Cycles 54\u2013' + cycle,
      l: 'Recent Signals',
      x: newPatterns.length + ' new pattern(s) detected: ' + newNames + '.'
    });
  }

  // Add current cycle note
  tl.push({
    d: harvestAlert ? 'r' : '',
    c: 'Cycle ' + cycle + ' \u2014 NOW',
    l: harvestAlert ? 'Harvest Failure' : 'Current Cycle',
    x: harvestAlert
      ? 'Harvest failure detected. Pattern data may be frozen. Dashboard generated from available data.'
      : patterns.length + ' total patterns tracked. ' + activePatterns.length + ' active. Dashboard generated cycle ' + cycle + '.'
  });

  return tl;
}

// ─── Escape for JS embedding ─────────────────────────────────────────────────
function jsStr(v) {
  return JSON.stringify(v);
}

// ─── Build the HTML ──────────────────────────────────────────────────────────
var frozenNote = dataFrozenAt ? (' &nbsp;&middot;&nbsp; Data frozen at cycle <span>' + dataFrozenAt + '</span>') : '';
var frozenFooterNote = dataFrozenAt ? (' &nbsp;&middot;&nbsp; Data frozen at cycle ' + dataFrozenAt + ' (' + consecutiveFails + ' consecutive harvest failures)') : '';

var sgiStatusBadge = '';
if (harvestAlert) {
  sgiStatusBadge = '<span style="font-size:.68rem;background:#818cf820;color:var(--purple);border:1px solid #818cf840;padding:.2rem .6rem;border-radius:4px;font-weight:600">HARVEST FAILED &mdash; cycle ' + (dataFrozenAt || '?') + ' data (frozen ' + consecutiveFails + ' cycles)</span>';
} else {
  sgiStatusBadge = '<span style="font-size:.68rem;background:#15803d20;color:#4ade80;border:1px solid #15803d40;padding:.2rem .6rem;border-radius:4px;font-weight:600">HARVEST OK &mdash; Cycle ' + cycleNumber + '</span>';
}

var sgiSubline = 'Ready for Anthropic skill-generator &middot; Cycle ' + cycleNumber;
if (dataFrozenAt) {
  sgiSubline += ' &middot; Data: internal cycle ' + dataFrozenAt;
}

var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Skilluminator - Cycle ' + cycleNumber + ' Dashboard</title>\n<style>\n';

// ─── CSS (verbatim from cycle 62) ────────────────────────────────────────────
html += '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}\n';
html += ':root{--bg:#0f1117;--card:#1a1b2e;--card2:#12131f;--purple:#818cf8;--pink:#c084fc;--green:#22c55e;--amber:#f59e0b;--red:#ef4444;--text:#e2e8f0;--muted:#94a3b8;--border:#2d2f4a}\n';
html += "body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh}\n";
html += '.hdr{padding:2.5rem 2rem 1.5rem;background:linear-gradient(135deg,#0f1117,#1a1020,#0f1117);border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;align-items:center;gap:1rem}\n';
html += '.hdr-l{flex:1;min-width:260px}\n';
html += ".gtitle{font-size:clamp(2rem,5vw,3.2rem);font-weight:800;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#818cf8);background-size:300% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:gs 5s linear infinite;letter-spacing:-.02em}\n";
html += '@keyframes gs{0%{background-position:0% 50%}100%{background-position:300% 50%}}\n';
html += '.hsub{color:var(--muted);font-size:.9rem;margin-top:.35rem}.hsub span{color:var(--purple);font-weight:600}\n';
html += '.badge{display:inline-block;background:linear-gradient(135deg,#818cf820,#c084fc20);border:1px solid #818cf840;border-radius:2rem;padding:.5rem 1.2rem;font-size:.85rem;font-weight:600;color:var(--purple)}\n';
html += '.alert{background:linear-gradient(90deg,#451a0380,#78350f80);border:1px solid #f59e0b60;border-left:3px solid var(--amber);margin:1rem 2rem;padding:.75rem 1.2rem;border-radius:8px;font-size:.82rem;color:#fde68a;display:flex;align-items:center;gap:.8rem}\n';
html += '.main{padding:0 2rem 3rem;max-width:1600px;margin:0 auto}\n';
html += '.stitle{font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:2rem 0 1rem;padding-bottom:.4rem;border-bottom:1px solid var(--border)}\n';
html += '.krow{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-top:1.5rem}\n';
html += '@media(max-width:900px){.krow{grid-template-columns:repeat(2,1fr)}}\n';
html += '@media(max-width:480px){.krow{grid-template-columns:1fr}}\n';
html += '.kcard{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.4rem 1.6rem;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s}\n';
html += '.kcard:hover{transform:translateY(-2px);box-shadow:0 8px 30px #818cf820}\n';
html += ".kcard::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--purple),var(--pink))}\n";
html += '.klbl{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}\n';
html += '.kval{font-size:clamp(2.2rem,4vw,3rem);font-weight:800;background:linear-gradient(135deg,var(--purple),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.1;margin:.4rem 0 .25rem}\n';
html += '.ksub{font-size:.75rem;color:var(--muted)}\n';
html += '.kico{position:absolute;right:1.2rem;top:50%;transform:translateY(-50%);font-size:2rem;opacity:.07}\n';
html += '.charts{display:grid;grid-template-columns:3fr 2fr;gap:1.5rem}\n';
html += '@media(max-width:1000px){.charts{grid-template-columns:1fr}}\n';
html += '.cc{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.4rem}\n';
html += '.ctit{font-size:.78rem;font-weight:700;color:var(--text);margin-bottom:1rem}\n';
html += '.tw{overflow-x:auto}\n';
html += 'table{width:100%;border-collapse:collapse;font-size:.83rem}\n';
html += 'thead tr{background:#12131f}\n';
html += 'th{padding:.75rem 1rem;text-align:left;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);border-bottom:1px solid var(--border)}\n';
html += 'tbody tr{border-bottom:1px solid #1e2035;transition:background .15s}\n';
html += 'tbody tr:hover{background:#1e2240}\n';
html += 'td{padding:.7rem 1rem}\n';
html += '.rk{font-weight:700;color:var(--purple);font-size:1rem}\n';
html += ".pn{font-weight:600}.ps{font-size:.7rem;color:var(--muted);font-family:monospace}\n";
html += '.sb{display:inline-block;font-size:.62rem;font-weight:600;padding:.15rem .45rem;border-radius:3px;margin:.1rem .15rem .1rem 0;text-transform:uppercase;letter-spacing:.05em}\n';
html += '.se{background:#1d4ed820;color:#60a5fa;border:1px solid #1d4ed840}\n';
html += '.sm{background:#15803d20;color:#4ade80;border:1px solid #15803d40}\n';
html += '.sv{background:#5b21b620;color:#a78bfa;border:1px solid #5b21b640}\n';
html += '.sd{background:#b4530920;color:#fb923c;border:1px solid #b4530940}\n';
html += '.bw{width:110px}.bb{background:#2d2f4a;border-radius:4px;height:8px;overflow:hidden}\n';
html += '.bf{height:8px;border-radius:4px;transition:width 1.2s ease;width:0}\n';
html += '.sl{font-size:.75rem;font-weight:700;margin-left:.4rem}\n';
html += '.tr{color:var(--green)}.ts{color:var(--muted)}.td{color:var(--red)}\n';
html += '.tc{font-size:.78rem;color:var(--muted);white-space:nowrap}\n';
html += '.tip{position:fixed;background:#1e2240;border:1px solid var(--border);border-radius:8px;padding:.6rem .9rem;font-size:.75rem;pointer-events:none;max-width:260px;z-index:100;display:none;box-shadow:0 8px 24px #00000060;line-height:1.6}\n';
html += '.tip strong{color:var(--purple);display:block;margin-bottom:.2rem}\n';
html += '.dleg{display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem}\n';
html += '.dli{display:flex;align-items:center;gap:.5rem;font-size:.78rem}\n';
html += '.dd{width:10px;height:10px;border-radius:50%;flex-shrink:0}\n';
html += '.og{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.9rem}\n';
html += '.oc{background:var(--card2);border:1px solid #818cf830;border-left:3px solid var(--purple);border-radius:10px;padding:1rem 1.1rem;transition:transform .15s,box-shadow .15s}\n';
html += '.oc:hover{transform:translateY(-1px);box-shadow:0 4px 20px #818cf815}\n';
html += '.on{font-size:.82rem;font-weight:600;margin-bottom:.35rem}\n';
html += '.om{display:flex;gap:.8rem;font-size:.7rem;color:var(--muted);flex-wrap:wrap}\n';
html += '.sh{color:var(--green);font-weight:700}.sm2{color:var(--amber);font-weight:700}\n';
html += ".code{background:#0a0b14;border:1px solid var(--border);border-radius:10px;padding:1.4rem;font-family:'Cascadia Code',Consolas,monospace;font-size:.74rem;line-height:1.65;overflow-x:auto;color:#a9b1d6;max-height:500px;overflow-y:auto}\n";
html += '.jk{color:#7aa2f7}.js{color:#9ece6a}.jn{color:#ff9e64}.jb{color:#bb9af7}.jp{color:#565f89}\n';
html += ".tl{position:relative;padding:.5rem 0 .5rem 2rem}\n";
html += ".tl::before{content:'';position:absolute;left:.5rem;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,var(--purple),var(--pink),transparent)}\n";
html += '.tli{position:relative;margin-bottom:1.3rem}\n';
html += '.tld{position:absolute;left:-1.65rem;top:.2rem;width:10px;height:10px;border-radius:50%;background:var(--purple);border:2px solid var(--bg);box-shadow:0 0 6px var(--purple)}\n';
html += '.tld.p{background:var(--pink);box-shadow:0 0 6px var(--pink)}\n';
html += '.tld.a{background:var(--amber);box-shadow:0 0 6px var(--amber)}\n';
html += '.tld.r{background:var(--red);box-shadow:0 0 6px var(--red)}\n';
html += '.tll{font-size:.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}\n';
html += '.tlt{font-size:.81rem;margin-top:.12rem}\n';
html += '.footer{text-align:center;padding:2rem;border-top:1px solid var(--border);font-size:.72rem;color:var(--muted)}\n';
html += '.apcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem;margin-bottom:.5rem}\n';
html += '.apcard{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.4rem 1.5rem;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s;display:flex;flex-direction:column;gap:.8rem}\n';
html += '.apcard:hover{transform:translateY(-3px);box-shadow:0 8px 32px #818cf825}\n';
html += '.apcard-top{height:3px;position:absolute;top:0;left:0;right:0;border-radius:12px 12px 0 0}\n';
html += '.ap-badge{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}\n';
html += '.ap-rank{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;background:#818cf820;color:var(--purple);border:1px solid #818cf840;padding:.2rem .55rem;border-radius:3px}\n';
html += '.ap-trend{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:.2rem .55rem;border-radius:3px}\n';
html += '.ap-title{font-size:.95rem;font-weight:700;line-height:1.35;color:var(--text)}\n';
html += ".ap-skill{font-size:.7rem;color:var(--muted);font-family:'Cascadia Code',Consolas,monospace;margin-top:-.3rem}\n";
html += '.ap-stats{display:flex;gap:.7rem;flex-wrap:wrap}\n';
html += '.ap-stat{background:#ffffff07;border:1px solid #ffffff0d;border-radius:8px;padding:.5rem .85rem;text-align:center;min-width:76px;flex:1}\n';
html += '.ap-stat-val{font-size:1.3rem;font-weight:800;line-height:1}\n';
html += '.ap-stat-lbl{font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-top:.3rem}\n';
html += '.ap-action{background:#818cf808;border:1px solid #818cf825;border-left:3px solid var(--purple);border-radius:6px;padding:.65rem .85rem;font-size:.78rem;line-height:1.55;color:var(--text)}\n';
html += ".ap-action strong{color:var(--purple);font-family:'Cascadia Code',Consolas,monospace;font-size:.76em}\n";
html += '.ap-meter{margin-top:.2rem}\n';
html += '.ap-meter-row{display:flex;align-items:center;gap:.6rem;margin-bottom:.3rem;font-size:.7rem}\n';
html += '.ap-meter-lbl{color:var(--muted);width:60px;flex-shrink:0}\n';
html += '.ap-meter-bar{flex:1;background:#2d2f4a;border-radius:4px;height:6px;overflow:hidden}\n';
html += '.ap-meter-fill{height:6px;border-radius:4px;transition:width 1.4s ease;width:0}\n';
html += '/* Expandable table rows */\n';
html += 'tbody tr.clickable{cursor:pointer;user-select:none}\n';
html += 'tbody tr.clickable:hover .pn{color:var(--purple)}\n';
html += '.chev{display:inline-block;margin-left:.45rem;font-size:.65rem;color:var(--muted);transition:transform .28s;vertical-align:middle}\n';
html += '.chev.open{transform:rotate(180deg);color:var(--purple)}\n';
html += '.exp-row td{padding:0!important;border-bottom:none!important}\n';
html += '.exp-inner{max-height:0;overflow:hidden;transition:max-height .38s cubic-bezier(.4,0,.2,1)}\n';
html += '.exp-inner.open{max-height:380px}\n';
html += '.exp-wrap{padding:.9rem 1.1rem 1rem;display:grid;grid-template-columns:1.6fr 1.3fr .9fr;gap:1.4rem;background:#0a0b14;border-top:1px dashed #2d2f4a;border-bottom:1px solid var(--border)}\n';
html += '@media(max-width:800px){.exp-wrap{grid-template-columns:1fr}}\n';
html += '.exp-lbl{font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:.45rem}\n';
html += ".exp-trigger{background:#818cf810;border:1px solid #818cf828;border-radius:5px;padding:.3rem .6rem;margin:.18rem 0;font-size:.72rem;color:#c4c9f5;font-family:'Cascadia Code',Consolas,monospace;display:block;line-height:1.45}\n";
html += ".exp-trigger::before{content:'\\25B6 ';font-size:.55rem;color:#818cf8;opacity:.7}\n";
html += '.exp-why{font-size:.77rem;color:#94a3b8;line-height:1.65}\n';
html += '.exp-why strong{color:var(--text);font-weight:600}\n';
html += '.exp-metrics{display:flex;flex-direction:column;gap:.55rem}\n';
html += '.exp-metric{background:#ffffff06;border:1px solid #ffffff0c;border-radius:8px;padding:.55rem .75rem;text-align:center}\n';
html += '.exp-metric-val{font-size:1.45rem;font-weight:800;line-height:1}\n';
html += '.exp-metric-lbl{font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-top:.25rem}\n';
html += ".exp-skill-tag{display:inline-block;margin-top:.5rem;font-family:'Cascadia Code',Consolas,monospace;font-size:.68rem;background:#c084fc15;border:1px solid #c084fc35;color:#c084fc;border-radius:4px;padding:.25rem .6rem}\n";

html += '</style>\n</head>\n<body>\n';

// ─── Header ──────────────────────────────────────────────────────────────────
html += '<div class="hdr">\n';
html += '  <div class="hdr-l">\n';
html += '    <div class="gtitle">Skilluminator</div>\n';
html += '    <div class="hsub">Skilluminator Cycle <span>' + cycleNumber + '</span> &nbsp;&middot;&nbsp; Week of <span>' + escHtml(weekOf) + '</span> &nbsp;&middot;&nbsp; Generated <span>' + new Date().toISOString().slice(0, 10) + '</span>' + frozenNote + '</div>\n';
html += '  </div>\n';
html += '  <div><div class="badge">&#128202; ' + cycleNumber + ' Cycles &nbsp;&middot;&nbsp; ' + patterns.length + ' Patterns Tracked</div></div>\n';
html += '</div>\n';

// ─── Alert banner (only if harvest failed) ──────────────────────────────────
if (harvestAlert) {
  html += '<div class="alert">\n';
  html += '  <span style="font-size:1.2rem;flex-shrink:0">&#9888;</span>\n';
  html += '  <span><strong>' + harvestAlert + '</strong></span>\n';
  html += '</div>\n';
}

// ─── Main content ────────────────────────────────────────────────────────────
html += '<div class="main">\n';

// Key metrics
html += '  <div class="stitle">Key Metrics</div>\n';
html += '  <div class="krow">\n';
html += '    <div class="kcard"><div class="kico">&#129513;</div><div class="klbl">Patterns Tracked</div><div class="kval" id="kv1">0</div><div class="ksub">' + patterns.length + ' individual &middot; ' + archivedCount + ' archived' + (dataFrozenAt ? ' &middot; ' + consecutiveFails + ' cycles frozen' : '') + '</div></div>\n';

// Find the pattern with max automation score for sub-text
var maxAutoPattern = activePatterns.reduce(function (best, p) {
  return num(p.automationScore) > num(best.automationScore) ? p : best;
}, activePatterns[0] || { automationScore: 0, candidateSkillName: '', occurrenceCount: 0 });
html += '    <div class="kcard"><div class="kico">&#9889;</div><div class="klbl">Top Automation Score</div><div class="kval" id="kv2">0</div><div class="ksub">' + escHtml(str(maxAutoPattern.candidateSkillName)) + ' &middot; ' + num(maxAutoPattern.occurrenceCount) + ' occ</div></div>\n';

html += '    <div class="kcard"><div class="kico">&#128336;</div><div class="klbl">Est. Hours Saved / Week</div><div class="kval" id="kv3">0</div><div class="ksub">~' + Math.round(activePatterns.reduce(function (s, p) { return s + num(p.timeSpentHoursTotal); }, 0)) + ' hrs cumulative &middot; ' + activePatterns.length + ' active patterns</div></div>\n';

html += '    <div class="kcard"><div class="kico">&#127919;</div><div class="klbl">Skills Ready to Generate</div><div class="kval" id="kv4">0</div><div class="ksub">Top ' + kv4 + ' composite score &ge;89</div></div>\n';
html += '  </div>\n';

// Signal Analysis charts
html += '\n  <div class="stitle">Signal Analysis</div>\n';
html += '  <div class="charts">\n';
html += '    <div class="cc">\n';
html += '      <div class="ctit">Automation Score vs. Value Score <span style="color:var(--muted);font-weight:400;font-size:.7rem">&mdash; bubble size = cumulative hours</span></div>\n';
html += '      <svg id="bsvg" viewBox="0 0 700 425" width="100%" style="display:block;overflow:visible">\n';
html += '        <g id="bgr"></g>\n';
html += '        <line x1="70" y1="390" x2="680" y2="390" stroke="#2d2f4a" stroke-width="1.5"/>\n';
html += '        <line x1="70" y1="10"  x2="70"  y2="390" stroke="#2d2f4a" stroke-width="1.5"/>\n';
html += '        <text x="375" y="415" text-anchor="middle" font-size="11" fill="#94a3b8">Automation Score</text>\n';
html += '        <text x="16"  y="200" text-anchor="middle" font-size="11" fill="#94a3b8" transform="rotate(-90,16,200)">Value Score</text>\n';
html += '        <g id="bxt"></g><g id="byt"></g><g id="bbl"></g>\n';
html += '      </svg>\n';
html += '    </div>\n';
html += '    <div class="cc">\n';
html += '      <div class="ctit">Signal Source Coverage <span style="color:var(--muted);font-weight:400;font-size:.7rem">&mdash; active pattern source distribution</span></div>\n';
html += '      <div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;margin-top:.5rem">\n';
html += '        <svg viewBox="0 0 200 200" width="160" height="160" style="flex-shrink:0">\n';
html += '          <g id="darc"></g>\n';
html += '          <circle cx="100" cy="100" r="45" fill="#1a1b2e"/>\n';
html += '          <text x="100" y="97"  text-anchor="middle" font-size="14" font-weight="700" fill="#e2e8f0">' + activePatterns.length + '</text>\n';
html += '          <text x="100" y="112" text-anchor="middle" font-size="9"  fill="#94a3b8">patterns</text>\n';
html += '        </svg>\n';
html += '        <div class="dleg" id="dleg"></div>\n';
html += '      </div>\n';
html += '    </div>\n';
html += '  </div>\n';

// Top Skill Candidates table
html += '\n  <div class="stitle">Top Skill Candidates &mdash; Ranked by Composite Score &nbsp;<span style="font-weight:400;text-transform:none;letter-spacing:0;color:#565f89">Click any row to see trigger examples, rationale &amp; time savings</span></div>\n';
html += '  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">\n';
html += '    <div class="tw">\n';
html += '      <table>\n';
html += '        <thead><tr><th>Rank</th><th>Pattern / Skill <span style="font-weight:400;color:#565f89;font-size:.58rem;letter-spacing:0">&#9660; click row for details</span></th><th>Sources</th><th>Automation</th><th>Value</th><th>Trend</th><th>Hrs / Occ</th></tr></thead>\n';
html += '        <tbody id="stb"></tbody>\n';
html += '      </table>\n';
html += '    </div>\n';
html += '  </div>\n';

// Action Plan
html += '\n  <div class="stitle">Your Action Plan &mdash; What To Do Right Now</div>\n';
html += '  <div class="apcards" id="apc"></div>\n';

// Skill-Generator Input
html += '\n  <div class="stitle">Skill-Generator Input &mdash; Top 5 Candidates</div>\n';
html += '  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.2rem">\n';
html += '    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem;flex-wrap:wrap;gap:.5rem">\n';
html += '      <span style="font-size:.78rem;color:var(--muted)">' + sgiSubline + '</span>\n';
html += '      ' + sgiStatusBadge + '\n';
html += '    </div>\n';
html += '    <div class="code" id="sgb"></div>\n';
html += '  </div>\n';

// Timeline
html += '\n  <div class="stitle">Cycle History &amp; Pattern Lifecycle</div>\n';
html += '  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.4rem 1.6rem">\n';
html += '    <div class="tl" id="tl"></div>\n';
html += '  </div>\n';

html += '</div>\n';

// Tooltip
html += '<div class="tip" id="tip"><strong id="tn"></strong><span id="tb"></span></div>\n';

// Footer
html += '<div class="footer">Skilluminator v' + cycleNumber + ' &nbsp;&middot;&nbsp; Skilluminator Cycle ' + cycleNumber + frozenFooterNote + ' &nbsp;&middot;&nbsp; Fully self-contained &middot; No external dependencies</div>\n\n';

// ─── JavaScript data + rendering ─────────────────────────────────────────────
html += '<script>\n';

// Embed data arrays
html += 'var P=' + jsStr(allPatternsP) + ';\n';
html += 'var OW=' + jsStr(owArray) + ';\n';
html += 'var SG=' + jsStr(sgArray) + ';\n';
html += 'var TLD=' + jsStr(tldArray) + ';\n';
html += 'var PT=' + jsStr(ptObject) + ';\n';
html += 'var AP=' + jsStr(apArray) + ';\n';
html += 'var TOTAL_CYCLES=' + totalCycles + ';\n';

// Source distribution for donut
html += 'var SRC=' + jsStr(srcCounts) + ';\n';
html += 'var SRC_TOTAL=' + srcTotal + ';\n';

// Embed rendering JS (verbatim from cycle 62, with TOTAL_CYCLES substitution)
html += 'var pm={};P.forEach(function(p){pm[p.id]=p;});\n';
html += 'function cs(p){return(p.a+p.v)/2;}\n';
html += "function sc(s){return s>=80?'#22c55e':s>=50?'#f59e0b':'#ef4444';}\n";
html += '\n';
html += 'function ctr(el,t,dur){\n';
html += '  var s=performance.now();\n';
html += '  (function f(n){var x=Math.min((n-s)/dur,1),e=1-Math.pow(1-x,3);el.textContent=Math.round(e*t);if(x<1)requestAnimationFrame(f);})(s);\n';
html += '}\n';
html += '\n';

// buildTable
html += 'function buildTable(){\n';
html += '  var sorted=P.slice().sort(function(a,b){return cs(b)-cs(a);}).slice(0,10);\n';
html += "  var tb=document.getElementById('stb');\n";
html += '  sorted.forEach(function(p,i){\n';
html += "    var src=p.S.map(function(s){var c={email:'se',meeting:'sm',teams:'sv',document:'sd'};return'<span class=\"sb '+(c[s]||'')+'\">'+s+'</span>';}).join('');\n";
html += "    var tri=p.t==='rising'?'<span class=\"tr\">&#8593; Rising</span>':p.t==='declining'?'<span class=\"td\">&#8595; Declining</span>':'<span class=\"ts\">&#8594; Stable</span>';\n";
html += "    var tr=document.createElement('tr');\n";
html += "    tr.className='clickable';\n";
html += "    tr.innerHTML='<td class=\"rk\">#'+(i+1)+'</td>'\n";
html += "      +'<td><div class=\"pn\">'+p.L+'<span class=\"chev\" id=\"chev-'+p.id+'\">&#9660;</span></div><div class=\"ps\">'+p.K+'</div></td>'\n";
html += "      +'<td>'+src+'</td>'\n";
html += "      +'<td><div style=\"display:flex;align-items:center\"><div class=\"bw\"><div class=\"bb\"><div class=\"bf\" style=\"background:'+sc(p.a)+'\" data-w=\"'+p.a+'\"></div></div></div><span class=\"sl\" style=\"color:'+sc(p.a)+'\">'+p.a+'</span></div></td>'\n";
html += "      +'<td><div style=\"display:flex;align-items:center\"><div class=\"bw\"><div class=\"bb\"><div class=\"bf\" style=\"background:'+sc(p.v)+'\" data-w=\"'+p.v+'\"></div></div></div><span class=\"sl\" style=\"color:'+sc(p.v)+'\">'+p.v+'</span></div></td>'\n";
html += "      +'<td>'+tri+'</td>'\n";
html += "      +'<td class=\"tc\">'+p.h.toFixed(1)+'h<br><span style=\"font-size:.67rem\">'+p.o+' occ</span></td>';\n";
html += '    var pd=PT[p.id]||{savePct:Math.round((p.a+p.v)/2*0.82),triggers:[\"Run \"+p.K+\" on your next occurrence of this pattern\",\"Pipe \"+p.S[0]+\" data directly into \"+p.K],why:\"<strong>\"+p.o+\" occurrences, \"+p.h.toFixed(1)+\"h total.</strong> Pattern is consistent enough to automate.\"};\n';
html += '    var wkHrs=(p.h/TOTAL_CYCLES);\n';
html += '    var wkSave=(wkHrs*pd.savePct/100).toFixed(1);\n';
html += '    var yrSave=Math.round(wkHrs*pd.savePct/100*52);\n';
html += "    var trgHtml=pd.triggers.map(function(t){return'<span class=\"exp-trigger\">'+t+'</span>';}).join('');\n";
html += "    var trendCol=p.t==='rising'?'#22c55e':p.t==='declining'?'#ef4444':'#94a3b8';\n";
html += "    var erow=document.createElement('tr');\n";
html += "    erow.className='exp-row';\n";
html += "    erow.innerHTML='<td colspan=\"7\"><div class=\"exp-inner\" id=\"exp-'+p.id+'\">'\n";
html += "      +'<div class=\"exp-wrap\">'\n";
html += "        +'<div><div class=\"exp-lbl\">&#9654; When to trigger this skill</div>'+trgHtml+'</div>'\n";
html += "        +'<div><div class=\"exp-lbl\">&#128161; Why you should automate this</div><div class=\"exp-why\">'+pd.why+'</div>'\n";
html += "          +'<div style=\"margin-top:.7rem\"><span class=\"exp-skill-tag\">'+p.K+'</span></div>'\n";
html += "        +'</div>'\n";
html += "        +'<div class=\"exp-metrics\">'\n";
html += "          +'<div class=\"exp-metric\"><div class=\"exp-metric-val\" style=\"color:#22c55e\">'+wkSave+'h</div><div class=\"exp-metric-lbl\">Est. saved / week</div></div>'\n";
html += "          +'<div class=\"exp-metric\"><div class=\"exp-metric-val\" style=\"color:#818cf8\">'+yrSave+'h</div><div class=\"exp-metric-lbl\">Est. saved / year</div></div>'\n";
html += "          +'<div class=\"exp-metric\"><div class=\"exp-metric-val\" style=\"color:'+trendCol+'\">'+pd.savePct+'%</div><div class=\"exp-metric-lbl\">Automatable</div></div>'\n";
html += "        +'</div>'\n";
html += "      +'</div>'\n";
html += "      +'</div></td>';\n";
html += "    tr.addEventListener('click',function(pid){return function(){\n";
html += "      var inner=document.getElementById('exp-'+pid);\n";
html += "      var chv=document.getElementById('chev-'+pid);\n";
html += "      var isOpen=inner.classList.contains('open');\n";
html += "      inner.classList.toggle('open',!isOpen);\n";
html += "      if(chv)chv.classList.toggle('open',!isOpen);\n";
html += '    };}(p.id));\n';
html += '    tb.appendChild(tr);\n';
html += '    tb.appendChild(erow);\n';
html += '  });\n';
html += "  setTimeout(function(){document.querySelectorAll('.bf').forEach(function(b){b.style.width=b.dataset.w+'%';});},700);\n";
html += '}\n\n';

// buildBubble
html += 'function buildBubble(){\n';
html += '  var PL=70,PT2=15,cw=610,ch=375;\n';
html += '  var toX=function(v){return PL+(v-60)/40*cw;};\n';
html += '  var toY=function(v){return PT2+ch-(v-40)/60*ch;};\n';
html += '  var toR=function(h){return Math.max(6,Math.min(34,Math.sqrt(h)*1.9));};\n';
html += "  var N=function(s){return document.createElementNS('http://www.w3.org/2000/svg',s);};\n";
html += "  var gr=document.getElementById('bgr'),xt=document.getElementById('bxt'),yt=document.getElementById('byt');\n";
html += '  for(var x=65;x<=100;x+=5){\n';
html += "    var l=N('line');l.setAttribute('x1',toX(x));l.setAttribute('y1',PT2);l.setAttribute('x2',toX(x));l.setAttribute('y2',PT2+ch);l.setAttribute('stroke','#1e2035');l.setAttribute('stroke-width','1');gr.appendChild(l);\n";
html += "    var t=N('text');t.setAttribute('x',toX(x));t.setAttribute('y',408);t.setAttribute('text-anchor','middle');t.setAttribute('font-size','9');t.setAttribute('fill','#565f89');t.textContent=x;xt.appendChild(t);\n";
html += '  }\n';
html += '  for(var y=40;y<=100;y+=10){\n';
html += "    var l2=N('line');l2.setAttribute('x1',PL);l2.setAttribute('y1',toY(y));l2.setAttribute('x2',PL+cw);l2.setAttribute('y2',toY(y));l2.setAttribute('stroke','#1e2035');l2.setAttribute('stroke-width','1');gr.appendChild(l2);\n";
html += "    var t2=N('text');t2.setAttribute('x',PL-5);t2.setAttribute('y',toY(y)+3);t2.setAttribute('text-anchor','end');t2.setAttribute('font-size','9');t2.setAttribute('fill','#565f89');t2.textContent=y;yt.appendChild(t2);\n";
html += '  }\n';
html += "  var TC={rising:'#22c55e',stable:'#818cf8',declining:'#ef4444'};\n";
html += "  var bg=document.getElementById('bbl');\n";
html += "  var tip=document.getElementById('tip');\n";
html += '  P.forEach(function(p){\n';
html += '    var cx=toX(p.a),cy=toY(p.v),r=toR(p.h);\n';
html += "    var col=p.m==='signal'?'#c084fc':(TC[p.t]||'#818cf8');\n";
html += "    var g=N('g');g.setAttribute('cursor','pointer');\n";
html += "    var c=N('circle');c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r',r);\n";
html += "    c.setAttribute('fill',col+'25');c.setAttribute('stroke',col);c.setAttribute('stroke-width','1.5');\n";
html += '    g.appendChild(c);\n';
html += "    if(r>14){var lb=N('text');lb.setAttribute('x',cx);lb.setAttribute('y',cy+r+10);lb.setAttribute('text-anchor','middle');lb.setAttribute('font-size','7.5');lb.setAttribute('fill','#94a3b8');lb.textContent=p.K.split('-').slice(0,2).join('-');g.appendChild(lb);}\n";
html += "    g.addEventListener('mouseenter',function(pp,cc,rr,cc2){return function(){cc.setAttribute('r',rr*1.18);cc.setAttribute('fill',cc2+'55');tip.style.display='block';document.getElementById('tn').textContent=pp.L;document.getElementById('tb').innerHTML='Auto: <strong style=\"color:#818cf8\">'+pp.a+'</strong> &nbsp; Value: <strong style=\"color:#c084fc\">'+pp.v+'</strong><br>Composite: <strong style=\"color:#22c55e\">'+cs(pp).toFixed(1)+'</strong> &nbsp; Hours: '+pp.h.toFixed(1)+'<br>Occ: '+pp.o+' &nbsp; Trend: '+pp.t+'<br>Skill: <span style=\"color:#f472b6;font-family:monospace;font-size:.9em\">'+pp.K+'</span>';};}(p,c,r,col));\n";
html += "    g.addEventListener('mousemove',function(e){tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-10)+'px';});\n";
html += "    g.addEventListener('mouseleave',function(cc,rr,col2){return function(){cc.setAttribute('r',rr);cc.setAttribute('fill',col2+'25');tip.style.display='none';};}(c,r,col));\n";
html += '    bg.appendChild(g);\n';
html += '  });\n';
html += '}\n\n';

// buildDonut
html += 'function buildDonut(){\n';
html += "  var COLS={teams:'#818cf8',meeting:'#22c55e',email:'#60a5fa',document:'#fb923c'};\n";
html += "  var LBLS={teams:'Teams',meeting:'Meeting',email:'Email',document:'Document'};\n";
html += '  var cx=100,cy=100,R=78,ri=46,ang=-Math.PI/2;\n';
html += "  var dg=document.getElementById('darc');\n";
html += "  var N=function(s){return document.createElementNS('http://www.w3.org/2000/svg',s);};\n";
html += "  var tip=document.getElementById('tip');\n";
html += '  var keys=Object.keys(SRC);\n';
html += '  keys.forEach(function(k){\n';
html += '    var n=SRC[k],da=(n/SRC_TOTAL)*2*Math.PI,ea=ang+da;\n';
html += '    var x1=cx+R*Math.cos(ang),y1=cy+R*Math.sin(ang);\n';
html += '    var x2=cx+R*Math.cos(ea), y2=cy+R*Math.sin(ea);\n';
html += '    var i1=cx+ri*Math.cos(ang),j1=cy+ri*Math.sin(ang);\n';
html += '    var i2=cx+ri*Math.cos(ea), j2=cy+ri*Math.sin(ea);\n';
html += "    var lg=da>Math.PI?1:0;\n";
html += "    var d='M'+x1+' '+y1+'A'+R+' '+R+' 0 '+lg+' 1 '+x2+' '+y2+'L'+i2+' '+j2+'A'+ri+' '+ri+' 0 '+lg+' 0 '+i1+' '+j1+'Z';\n";
html += "    var path=N('path');path.setAttribute('d',d);path.setAttribute('fill',(COLS[k]||'#818cf8')+'bb');path.setAttribute('stroke','#1a1b2e');path.setAttribute('stroke-width','2');\n";
html += "    path.addEventListener('mouseenter',function(key,nn,colr){return function(e){path.setAttribute('fill',colr||'#818cf8');tip.style.display='block';document.getElementById('tn').textContent=(LBLS[key]||key)+' signals';document.getElementById('tb').innerHTML=nn+' of '+SRC_TOTAL+' source appearances<br><strong style=\"color:'+(colr||'#818cf8')+'\">'+Math.round(nn/SRC_TOTAL*100)+'%</strong> of distribution';tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-10)+'px';};}(k,n,COLS[k]));\n";
html += "    path.addEventListener('mousemove',function(e){tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-10)+'px';});\n";
html += "    path.addEventListener('mouseleave',function(key){return function(){path.setAttribute('fill',(COLS[key]||'#818cf8')+'bb');tip.style.display='none';};}(k));\n";
html += '    dg.appendChild(path);ang=ea;\n';
html += '  });\n';
html += "  var leg=document.getElementById('dleg');\n";
html += '  keys.forEach(function(k){\n';
html += "    var el=document.createElement('div');el.className='dli';\n";
html += "    el.innerHTML='<div class=\"dd\" style=\"background:'+(COLS[k]||'#818cf8')+'\"></div><span style=\"color:var(--text);font-weight:600\">'+(LBLS[k]||k)+'</span><span style=\"color:var(--muted)\">'+SRC[k]+' ('+Math.round(SRC[k]/SRC_TOTAL*100)+'%)</span>';\n";
html += '    leg.appendChild(el);\n';
html += '  });\n';
html += '}\n\n';

// buildOrg (not shown in main layout but referenced by OW)
// Keeping it in case needed, but cycle 62 does not have an org section in the body.
// We can skip it or add it. Let's omit since cycle 62 did not render it explicitly.

// buildSG (JSON code block)
html += 'function hjson(j){\n';
html += "  return j.replace(/(\"[\\w\\s\\-&()\\/\\.>]+\")(\\s*):/g,'<span class=\"jk\">$1</span>$2:')\n";
html += "    .replace(/:\\s*(\"(?:[^\"\\\\]|\\\\.)*\")/g,': <span class=\"js\">$1</span>')\n";
html += "    .replace(/:\\s*(\\d+\\.?\\d*)/g,': <span class=\"jn\">$1</span>')\n";
html += "    .replace(/:\\s*(true|false|null)\\b/g,': <span class=\"jb\">$1</span>')\n";
html += "    .replace(/([{}\\[\\],])/g,'<span class=\"jp\">$1</span>');\n";
html += '}\n';
html += 'function buildSG(){\n';
html += '  var payload={generatedAtCycle:' + cycleNumber + ',weekOf:"' + escHtml(weekOf) + '"';
if (harvestAlert) {
  html += ',harvestStatus:"FAILED - data from internal cycle ' + (dataFrozenAt || '?') + ' (' + consecutiveFails + ' consecutive failures)"';
} else {
  html += ',harvestStatus:"OK - Cycle ' + cycleNumber + '"';
}
html += ',candidateSkills:SG};\n';
html += "  document.getElementById('sgb').innerHTML=hjson(JSON.stringify(payload,null,2));\n";
html += '}\n\n';

// buildActionPlan
html += 'function buildActionPlan(){\n';
html += "  var g=document.getElementById('apc');\n";
html += '  AP.forEach(function(ap){\n';
html += '    var p=pm[ap.id];if(!p)return;\n';
html += '    var autoFill=p.a;var valFill=p.v;\n';
html += "    var trendCol=p.t==='rising'?'#22c55e':p.t==='declining'?'#ef4444':'#94a3b8';\n";
html += "    var trendIco=p.t==='rising'?'&#8593; Rising':p.t==='declining'?'&#8595; Declining':'&#8594; Stable';\n";
html += '    var hrsWeek=ap.hpw.toFixed(1);\n';
html += '    var hrsSave=ap.save.toFixed(1);\n';
html += "    var hrsYr=(ap.save*52).toFixed(0);\n";
html += "    var card=document.createElement('div');card.className='apcard';\n";
html += "    card.innerHTML='<div class=\"apcard-top\" style=\"background:linear-gradient(90deg,'+ap.sColor+','+ap.sColor+'88)\"></div>'\n";
html += "      +'<div class=\"ap-badge\"><span class=\"ap-rank\">#'+ap.rank+' Priority</span>'\n";
html += "      +'<span class=\"ap-trend\" style=\"background:'+trendCol+'20;color:'+trendCol+';border:1px solid '+trendCol+'40\">'+trendIco+'</span></div>'\n";
html += "      +'<div><div class=\"ap-title\">'+p.L+'</div><div class=\"ap-skill\">'+p.K+'</div></div>'\n";
html += "      +'<div class=\"ap-stats\">'\n";
html += "        +'<div class=\"ap-stat\"><div class=\"ap-stat-val\" style=\"color:'+ap.sColor+'\">'+hrsWeek+'h</div><div class=\"ap-stat-lbl\">Cost / week</div></div>'\n";
html += "        +'<div class=\"ap-stat\"><div class=\"ap-stat-val\" style=\"color:#22c55e\">'+hrsSave+'h</div><div class=\"ap-stat-lbl\">Save / week</div></div>'\n";
html += "        +'<div class=\"ap-stat\"><div class=\"ap-stat-val\" style=\"color:#f59e0b\">'+ hrsYr+'h</div><div class=\"ap-stat-lbl\">Save / year</div></div>'\n";
html += "        +'<div class=\"ap-stat\"><div class=\"ap-stat-val\" style=\"color:#60a5fa\">'+p.o+'</div><div class=\"ap-stat-lbl\">Occurrences</div></div>'\n";
html += "      +'</div>'\n";
html += "      +'<div class=\"ap-meter\">'\n";
html += "        +'<div class=\"ap-meter-row\"><span class=\"ap-meter-lbl\">Automation</span><div class=\"ap-meter-bar\"><div class=\"ap-meter-fill\" style=\"background:'+sc(autoFill)+';width:0%\" data-w=\"'+autoFill+'%\"></div></div><span style=\"font-size:.72rem;font-weight:700;color:'+sc(autoFill)+'\">'+autoFill+'</span></div>'\n";
html += "        +'<div class=\"ap-meter-row\"><span class=\"ap-meter-lbl\">Value</span><div class=\"ap-meter-bar\"><div class=\"ap-meter-fill\" style=\"background:'+sc(valFill)+';width:0%\" data-w=\"'+valFill+'%\"></div></div><span style=\"font-size:.72rem;font-weight:700;color:'+sc(valFill)+'\">'+valFill+'</span></div>'\n";
html += "      +'</div>'\n";
html += "      +'<div class=\"ap-action\">&#128161; '+ap.action+'</div>';\n";
html += '    g.appendChild(card);\n';
html += '  });\n';
html += "  setTimeout(function(){document.querySelectorAll('.ap-meter-fill').forEach(function(b){b.style.width=b.dataset.w;});},800);\n";
html += '}\n\n';

// buildTL
html += 'function buildTL(){\n';
html += "  var tl=document.getElementById('tl');\n";
html += '  TLD.forEach(function(item){\n';
html += "    var div=document.createElement('div');div.className='tli';\n";
html += "    div.innerHTML='<div class=\"tld '+item.d+'\"></div><div class=\"tll\">'+item.c+'</div><div class=\"tlt\"><strong style=\"color:var(--text)\">'+item.l+'</strong> - '+item.x+'</div>';\n";
html += '    tl.appendChild(div);\n';
html += '  });\n';
html += '}\n\n';

// DOMContentLoaded
html += "window.addEventListener('DOMContentLoaded',function(){\n";
html += '  setTimeout(function(){\n';
html += "    ctr(document.getElementById('kv1')," + kv1 + ',1200);\n';
html += "    ctr(document.getElementById('kv2')," + kv2 + ',1400);\n';
html += "    ctr(document.getElementById('kv3')," + Math.round(kv3) + ',1600);\n';
html += "    ctr(document.getElementById('kv4')," + kv4 + ',800);\n';
html += '  },300);\n';
html += '  buildTable();buildBubble();buildDonut();buildActionPlan();buildSG();buildTL();\n';
html += '});\n';

html += '</script>\n</body>\n</html>\n';

// ─── Write output ────────────────────────────────────────────────────────────
var outDir = path.dirname(outputPath);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
fs.writeFileSync(outputPath, html, 'utf8');

console.log('Dashboard generated: ' + outputPath);
console.log('  Cycle: ' + cycleNumber + '  |  Patterns: ' + patterns.length + ' (' + activePatterns.length + ' active)');
console.log('  Key metrics: kv1=' + kv1 + ' kv2=' + kv2 + ' kv3=' + kv3 + ' kv4=' + kv4);
if (harvestAlert) {
  console.log('  WARNING: Harvest failure detected. Data frozen at cycle ' + dataFrozenAt);
}

// ─── Utility: escape HTML for safe embedding ─────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
