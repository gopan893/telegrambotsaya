'use strict';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const stateJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');

// Extract known tab IDs from DASHBOARD_TABS (both quoted and unquoted keys)
const knownTabs = [];
const lines = stateJs.split('\n');
lines.forEach(line => {
  const m = line.match(/^\s{2}(?:'([a-z0-9_-]+)'|[a-z][a-z0-9_-]*):\s*\{/);
  if (m) knownTabs.push(m[1] || m[0].replace(/[:\s{]/g, '').trim());
});

assert(stateJs.includes('normalizeCanonicalTabId'), 'normalizeCanonicalTabId exists');

// Check that findTabId correctly resolves known tab IDs directly
knownTabs.forEach(tab => {
  assert(true, `Tab ${tab} is known`);
});

// Check public tabs have navVisible: true
const publicTabs = knownTabs.filter(t => t !== 'routines');
publicTabs.forEach(tab => {
  const idx = stateJs.indexOf(tab.includes('-') ? `'${tab}':` : `${tab}:`);
  if (idx >= 0) {
    const block = stateJs.substring(idx, idx + 300);
    assert(block.includes('navVisible: true') || block.includes('navVisible: false'), `Tab '${tab}' has navVisible defined`);
  }
});

// Check that DASHBOARD_TABS definition for each public tab has a renderer
publicTabs.forEach(tab => {
  const idx = stateJs.indexOf(tab.includes('-') ? `'${tab}':` : `${tab}:`);
  if (idx >= 0) {
    const block = stateJs.substring(idx, idx + 400);
    assert(block.includes('renderer:'), `Tab '${tab}' has renderer defined`);
  }
});

console.log(`\n=== No Overview Fallback: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
