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

  const mod = require(path.join(ROOT, 'src/devices/device-risk-classifier'));

  check(typeof mod.classifyRisk === 'function', 'classifyRisk is a function');
  check(typeof mod.classifyDeviceRisk === 'function', 'classifyDeviceRisk is a function');
  check(typeof mod.getRiskLevel === 'function', 'getRiskLevel is a function');
  check(typeof mod.requiresApproval === 'function', 'requiresApproval is a function');

  const low = mod.classifyRisk('read_state');
  check(low.level === 'low', 'Read action is low risk');

  const high = mod.classifyRisk('exec_command');
  check(high.level === 'critical', 'Exec action is critical risk');

  const devRisk = mod.classifyDeviceRisk({ trustLevel: 'untrusted', capabilities: ['run_shell'] });
  check(devRisk.level === 'critical', 'Untrusted device with shell is critical');

  const content = fs.readFileSync(path.join(ROOT, 'src/devices/device-risk-classifier.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Device Risk Classifier: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
