'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  console.log('=== Post-V2 Telegram Watchdog ===\n');

  const tw = require(path.join(ROOT, 'src/post-v2/post-v2-telegram-watchdog'));

  const checks = tw.checkTelegramCommandRegistryPostV2({});
  check(Array.isArray(checks), 'checkTelegramCommandRegistryPostV2 returns array');
  check(checks.length > 0, 'checkTelegramCommandRegistryPostV2 returns checks');
  check(checks[0].command !== undefined, 'checkTelegramCommandRegistryPostV2 has command');

  const report = tw.buildTelegramWatchdogReport({});
  check(report.module === 'telegram', 'buildTelegramWatchdogReport returns module name');
  check(typeof report.passed === 'boolean', 'buildTelegramWatchdogReport returns passed');

  console.log('\n=== Telegram Watchdog: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
