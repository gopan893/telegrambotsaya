'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  const mod = require(path.join(ROOT, 'src/workflow-studio/workflow-template-library'));

  check(typeof mod.listTemplates === 'function', 'listTemplates is a function');
  check(typeof mod.getTemplate === 'function', 'getTemplate is a function');
  check(typeof mod.createFromTemplate === 'function', 'createFromTemplate is a function');
  check(typeof mod.searchTemplates === 'function', 'searchTemplates is a function');

  const templates = mod.listTemplates();
  check(Array.isArray(templates) && templates.length > 0, 'listTemplates returns templates');

  const t = mod.getTemplate('daily_summary');
  check(t !== null, 'getTemplate finds daily_summary');

  const created = mod.createFromTemplate('daily_summary');
  check(created.ok === true, 'createFromTemplate succeeds');

  const notFound = mod.getTemplate('nonexistent');
  check(notFound === null, 'getTemplate returns null for missing');

  const content = fs.readFileSync(path.join(ROOT, 'src/workflow-studio/workflow-template-library.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Workflow Template Library: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
