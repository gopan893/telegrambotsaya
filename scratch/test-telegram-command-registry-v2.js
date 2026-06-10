'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/registry-v2/telegram-command-registry-v2'));
  const commands = mod.buildTelegramCommandRegistryV2();
  assert.ok(Array.isArray(commands), 'buildTelegramCommandRegistryV2 returns array');
  assert.ok(commands.length > 0, 'commands array is not empty');
  assert.ok(commands.every(c => c.id), 'every command has id');
  assert.ok(commands.every(c => c.description), 'every command has description');
  assert.ok(commands.every(c => c.riskLevel), 'every command has riskLevel');
  console.log('PASS: telegram-command-registry-v2 — ' + commands.length + ' commands returned');
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
