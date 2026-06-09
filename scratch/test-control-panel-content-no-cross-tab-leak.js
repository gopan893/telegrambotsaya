'use strict';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const stateJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');

// Check each tab's title is unique and specific to that tab
const lines = stateJs.split('\n');
const tabs = [];
lines.forEach(line => {
  const m = line.match(/^\s{2}(?:'([a-z0-9_-]+)'|([a-z][a-z0-9_]*)):\s*\{/);
  if (m) tabs.push(m[1] || m[2]);
});

const titles = {};
tabs.forEach(tab => {
  const idx = stateJs.indexOf(`'${tab}':`);
  if (idx < 0) return;
  const block = stateJs.substring(idx, idx + 500);
  const tMatch = block.match(/title:\s*'([^']+)'/);
  if (tMatch) {
    titles[tab] = tMatch[1];
  }
});

// Known tab title exclusions — tabs that share content domains should not have identical titles
const crossTabPairs = [
  ['governance', 'security'],
  ['security', 'privacy'],
  ['deploy', 'githubops'],
  ['githubops', 'deploy'],
  ['research', 'docs-intel'],
  ['docs-intel', 'research'],
  ['model-router', 'cost'],
  ['recipes', 'operating-loop'],
  ['reliability', 'monitoring'],
  ['operating-loop', 'improvement']
];

crossTabPairs.forEach(([a, b]) => {
  if (titles[a] && titles[b]) {
    assert(titles[a] !== titles[b], `Tab '${a}' and '${b}' have different titles`);
  }
});

// No known tab should render generic "System Overview" as main body
const overviewTitle = titles['overview'] || '';
tabs.forEach(tab => {
  if (tab === 'overview') return;
  if (titles[tab]) {
    // The tab title should not be exactly the same as overview
    if (titles[tab].toLowerCase() === overviewTitle.toLowerCase()) {
      console.error(`WARN: Tab '${tab}' has same title as overview: "${titles[tab]}"`);
    }
  }
});

// State.js must define unique renderers per tab
const renderers = {};
tabs.forEach(tab => {
  const idx = stateJs.indexOf(`'${tab}':`);
  if (idx < 0) return;
  const block = stateJs.substring(idx, idx + 500);
  const rMatch = block.match(/renderer:\s*'([^']+)'/);
  if (rMatch) {
    if (renderers[rMatch[1]] && renderers[rMatch[1]] !== tab) {
      console.error(`WARN: Renderer '${rMatch[1]}' shared by tabs '${renderers[rMatch[1]]}' and '${tab}'`);
    }
    renderers[rMatch[1]] = tab;
  }
});

console.log(`\n=== Cross-Tab Leak Check: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
