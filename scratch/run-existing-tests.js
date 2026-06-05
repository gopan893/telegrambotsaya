'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');

const tests = process.argv.slice(2);
let passed = 0;
let failed = 0;
let skipped = 0;

for (const test of tests) {
  if (!fs.existsSync(test)) {
    console.log(`SKIP ${test} (missing)`);
    skipped++;
    continue;
  }
  console.log(`RUN ${test}`);
  const result = spawnSync(process.execPath, [test], { stdio: 'inherit' });
  if (result.status === 0) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL ${test} (exit ${result.status})`);
  }
}

console.log(`Test summary: passed=${passed} failed=${failed} skipped=${skipped}`);
process.exit(failed > 0 ? 1 : 0);
