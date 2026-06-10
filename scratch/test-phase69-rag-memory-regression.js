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

  const ragRouteFile = path.join(ROOT, 'src/dashboard/rag-quality-routes.js');
  check(fs.existsSync(ragRouteFile), 'rag-quality-routes.js exists');
  const ragContent = fs.readFileSync(ragRouteFile, 'utf8');
  check(!ragContent.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in rag-quality-routes');
  check(!ragContent.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in rag-quality-routes');
  try { new Function(ragContent); check(true, 'rag-quality-routes syntax OK'); } catch (e) { check(false, 'rag-quality-routes syntax: ' + e.message); }

  const memRouteFile = path.join(ROOT, 'src/dashboard/agent-memory-routes.js');
  check(fs.existsSync(memRouteFile), 'agent-memory-routes.js exists');
  const memContent = fs.readFileSync(memRouteFile, 'utf8');
  check(!memContent.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in agent-memory-routes');
  check(!memContent.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in agent-memory-routes');
  try { new Function(memContent); check(true, 'agent-memory-routes syntax OK'); } catch (e) { check(false, 'agent-memory-routes syntax: ' + e.message); }

  const ragModules = [
    'source-confidence-scorer', 'source-freshness-scorer', 'retrieval-quality-evaluator',
    'context-compression-engine', 'citation-labeler', 'hallucination-guard',
    'query-rewrite-planner', 'rag-answer-quality-checker'
  ];
  for (const m of ragModules) {
    const fp = path.join(ROOT, 'src/rag-quality/' + m + '.js');
    check(fs.existsSync(fp), m + '.js exists');
    if (fs.existsSync(fp)) {
      const c = fs.readFileSync(fp, 'utf8');
      check(!c.includes('TELEGRAM_TOKEN'), m + ' has no TELEGRAM_TOKEN');
      check(!c.includes('GITHUB_TOKEN'), m + ' has no GITHUB_TOKEN');
      try { new Function(c); check(true, m + ' syntax OK'); } catch (e) { check(false, m + ' syntax: ' + e.message); }
    }
  }

  const memModules = [
    'memory-duplicate-detector', 'memory-freshness-reviewer', 'memory-merge-planner',
    'memory-conflict-detector', 'memory-sensitivity-classifier', 'memory-context-selector',
    'memory-quality-scorecard'
  ];
  for (const m of memModules) {
    const fp = path.join(ROOT, 'src/memory-intelligence/' + m + '.js');
    check(fs.existsSync(fp), m + '.js exists');
    if (fs.existsSync(fp)) {
      const c = fs.readFileSync(fp, 'utf8');
      check(!c.includes('TELEGRAM_TOKEN'), m + ' has no TELEGRAM_TOKEN');
      check(!c.includes('GITHUB_TOKEN'), m + ' has no GITHUB_TOKEN');
      try { new Function(c); check(true, m + ' syntax OK'); } catch (e) { check(false, m + ' syntax: ' + e.message); }
    }
  }

  console.log('\n--- Phase 69 RAG/Memory Regression: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
