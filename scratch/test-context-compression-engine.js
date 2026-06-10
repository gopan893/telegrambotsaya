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

  const mod = require(path.join(ROOT, 'src/rag-quality/context-compression-engine'));

  check(typeof mod.compressContextPack === 'function', 'compressContextPack is a function');
  check(typeof mod.compressBatch === 'function', 'compressBatch is a function');
  check(typeof mod.extractSafetyConstraints === 'function', 'extractSafetyConstraints is a function');

  const contextPack = {
    sections: [
      { title: 'Intro', content: 'This is a long introduction about testing the compression engine with multiple sentences.' },
      { title: 'Safety', content: 'approval_required and secret_redaction rules must always be preserved.' },
      { title: 'Details', content: 'More detailed information about the topic at hand.' }
    ],
    rules: ['approval_required', 'secret_redaction']
  };

  const compressed = mod.compressContextPack(contextPack, { maxTokens: 100 });
  check(typeof compressed === 'object', 'compressContextPack returns object');
  check(typeof compressed.compressed === 'string', 'Has compressed string');
  check(Array.isArray(compressed.rulesPreserved), 'Has rulesPreserved array');

  const nullCompressed = mod.compressContextPack(null, {});
  check(nullCompressed.compressed === '', 'Null pack returns empty');

  const safetyConstraints = mod.extractSafetyConstraints(contextPack);
  check(Array.isArray(safetyConstraints), 'extractSafetyConstraints returns array');

  const batch = mod.compressBatch([contextPack, contextPack], { maxTokens: 50 });
  check(Array.isArray(batch), 'compressBatch returns array');

  const content = fs.readFileSync(path.join(ROOT, 'src/rag-quality/context-compression-engine.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Context Compression Engine: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
