'use strict';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }
function assertEq(a, b, msg) { if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'public/dashboard/index.html'), 'utf8');
const stateJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');

const STABLE_TABS = [
  'overview', 'agents', 'executor', 'integrations', 'coding', 'routines',
  'selfhealing', 'monitoring', 'cicd', 'githubops', 'deploy', 'observability',
  'cost', 'operator', 'portfolio', 'knowledge', 'lifeos', 'telegram-control',
  'operating-loop', 'improvement', 'governance', 'security', 'privacy',
  'release-candidate', 'production-release', 'reliability', 'research',
  'docs-intel', 'model-router', 'plugins', 'rag-kb', 'recipes',
  'mobile', 'disaster-recovery', 'consolidation'
];

// 1. All stable tabs exist in DASHBOARD_TABS
STABLE_TABS.forEach(tab => {
  const hasQuotedKey = stateJs.includes(`'${tab}':`);
  const hasUnquotedKey = stateJs.includes(`\n  ${tab}:`) || stateJs.includes(`  ${tab}:`);
  assert(hasQuotedKey || hasUnquotedKey, `Tab '${tab}' exists in DASHBOARD_TABS`);
});

// 2. No duplicate data-tab in sidebar
const dataTabMatches = html.match(/data-tab="([^"]+)"/g) || [];
const dataTabs = dataTabMatches.map(m => m.match(/data-tab="([^"]+)"/)[1]);
const seen = new Set();
dataTabs.forEach(t => {
  if (seen.has(t)) console.error(`WARN: duplicate data-tab="${t}" in sidebar`);
  seen.add(t);
});

// 3. No duplicate href conflicts
const hrefMatches = html.match(/href="#([^"]+)"/g) || [];
const hrefs = hrefMatches.map(m => m.match(/href="#([^"]+)"/)[1]);
const hrefSeen = new Set();
hrefs.forEach(h => {
  if (hrefSeen.has(h)) console.error(`WARN: duplicate href="#${h}" in sidebar`);
  hrefSeen.add(h);
});

// 4. Every public stable tab has a sidebar entry
// extract all data-tab values from sidebar
const sidebarTabs = new Set(dataTabs);
STABLE_TABS.forEach(tab => {
  if (tab === 'routines') return; // internal-only
  assert(sidebarTabs.has(tab), `Sidebar has data-tab="${tab}"`);
});

// 5. Every tab has a renderer in state.js
STABLE_TABS.forEach(tab => {
  const reQuoted = new RegExp(`'${tab}':\\s*\\{`);
  const reUnquoted = new RegExp(`\\n\\s{2}${tab}:\\s*\\{`);
  const match = stateJs.match(reQuoted) || stateJs.match(reUnquoted);
  if (match) {
    const blockStart = match.index;
    const block = stateJs.substring(blockStart, blockStart + 500);
    assert(block.includes('renderer:'), `Tab '${tab}' has renderer in state.js`);
  }
});

// 6. All sidebar nav links point to valid tabs
const navLinks = html.match(/<a\s+href="#([^"]+)"[^>]*data-tab="([^"]+)"/g) || [];
navLinks.forEach(link => {
  const hrefMatch = link.match(/href="#([^"]+)"/);
  const dataTabMatch = link.match(/data-tab="([^"]+)"/);
  if (hrefMatch && dataTabMatch) {
    assertEq(hrefMatch[1], dataTabMatch[1], `href and data-tab match for ${dataTabMatch[1]}`);
  }
});

console.log(`\n=== Menu Registry: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
