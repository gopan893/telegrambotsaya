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

  const mod = require(path.join(ROOT, 'src/rag-quality/query-rewrite-planner'));

  check(typeof mod.planQueryRewrite === 'function', 'planQueryRewrite is a function');
  check(typeof mod.rewriteBatch === 'function', 'rewriteBatch is a function');

  const shortQuery = 'deploy';
  const shortResult = mod.planQueryRewrite(shortQuery, {});
  check(typeof shortResult === 'object', 'planQueryRewrite returns object');
  check(shortResult.original === shortQuery, 'Original query preserved');
  check(typeof shortResult.rewritten === 'string', 'Has rewritten query');
  check(typeof shortResult.strategy === 'string', 'Has strategy');

  const vagueQuery = 'that thing';
  const vagueResult = mod.planQueryRewrite(vagueQuery, {});
  check(vagueResult.strategy !== 'none', 'Vague query gets rewrite strategy');

  const nullResult = mod.planQueryRewrite(null, {});
  check(nullResult.strategy === 'none' || nullResult.reasons.length > 0, 'Null query handled');

  const batch = mod.rewriteBatch(['deploy nodejs', 'api error', 'how to test'], {});
  check(Array.isArray(batch), 'rewriteBatch returns array');
  check(batch.length === 3, 'Batch has 3 results');

  const content = fs.readFileSync(path.join(ROOT, 'src/rag-quality/query-rewrite-planner.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Query Rewrite Planner: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
