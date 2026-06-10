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

  const mod = require(path.join(ROOT, 'src/rag-quality/citation-labeler'));

  check(typeof mod.labelSource === 'function', 'labelSource is a function');
  check(typeof mod.labelBatch === 'function', 'labelBatch is a function');
  check(typeof mod.generateInlineCitation === 'function', 'generateInlineCitation is a function');
  check(typeof mod.formatReferenceList === 'function', 'formatReferenceList is a function');
  check(typeof mod.generateCitationKey === 'function', 'generateCitationKey is a function');

  const source = { author: 'John Doe', title: 'Node.js Guide', date: '2024-01-01' };
  const label = mod.labelSource(source);
  check(typeof label === 'object', 'labelSource returns object');
  check(typeof label.label === 'string', 'Has label string');
  check(label.label.includes('John Doe') || label.label.length > 0, 'Label contains author or text');

  const nullLabel = mod.labelSource(null);
  check(nullLabel.label === 'Unknown Source' || nullLabel.warnings.length > 0, 'Null source handled');

  const batch = mod.labelBatch([source, { title: 'API Docs' }]);
  check(Array.isArray(batch) && batch.length === 2, 'labelBatch returns correct count');

  const citationKey = mod.generateCitationKey(source);
  check(typeof citationKey === 'string' && citationKey.length > 0, 'Citation key is non-empty string');

  const inline = mod.generateInlineCitation(batch);
  check(typeof inline === 'string', 'generateInlineCitation returns string');

  const refList = mod.formatReferenceList(batch);
  check(typeof refList === 'string', 'formatReferenceList returns string');

  const content = fs.readFileSync(path.join(ROOT, 'src/rag-quality/citation-labeler.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Citation Labeler: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
