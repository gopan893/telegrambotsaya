'use strict';

const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const certifier = require(path.join(ROOT, 'src/stabilization/telegram-command-certifier'));
  const result = await certifier.certifyAllTelegram();
  assert.ok(result.passed, 'Telegram certifier passed');
  assert.strictEqual(result.overallScore, 100, 'Score 100');
  console.log('PASS: test-telegram-command-certifier — score 100\n');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
