'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  const stabs = ['overview', 'agents', 'executor', 'integrations', 'coding', 'routines', 'selfhealing', 'monitoring', 'cicd', 'observability', 'cost', 'portfolio', 'knowledge', 'lifeos', 'telegram-control', 'security', 'privacy', 'stabilization', 'v2-planning', 'registry-v2'];
  const stateJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'state.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'index.html'), 'utf8');

  for (const tab of stabs) {
    assert.ok(stateJs.includes(`'${tab}':`) || stateJs.includes(`"${tab}":`) || stateJs.includes(`${tab}:`), `Tab in state: ${tab}`);
    assert.ok(indexHtml.includes(`data-tab="${tab}"`), `Tab in sidebar: ${tab}`);
    console.log(`  PASS: ${tab} in state + sidebar`);
  }
  console.log('PASS: v1-final-readiness-gate — stable tabs verified\n');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
