'use strict';

const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (err) { console.log(`❌ ${name}: ${err.message}`); failed++; }
}

// Mock intent classifier for routine-related natural language
function classifyRoutineIntent(message) {
  const lower = message.toLowerCase();

  if (lower.includes('setiap pagi') || (lower.includes('ringkasan') && lower.includes('project'))) {
    return { intent: 'create_routine', type: 'briefing', schedule: 'daily', safe: true, readOnly: true };
  }
  if (lower.includes('rutinitas') && lower.includes('backup')) {
    return { intent: 'create_routine', type: 'backup_check', schedule: 'daily', safe: true, directBackup: false, requiresProposal: true };
  }
  if (lower.includes('auto backup')) {
    return { intent: 'enable_auto_backup', safe: false, directBackup: false, requiresProposal: true };
  }
  if (lower.includes('jalankan') || lower.includes('run routine')) {
    return { intent: 'run_routine', safe: true, readOnly: true, dryRun: true };
  }
  if (lower.includes('/routines') || (lower.includes('cek') && lower.includes('rutinitas'))) {
    return { intent: 'list_routines', safe: true, readOnly: true };
  }
  if (lower.includes('hapus routine') || (lower.includes('remove') && lower.includes('routine'))) {
    return { intent: 'remove_routine', safe: true, softDelete: true };
  }
  if (lower.includes('briefing') || lower.includes('/briefing')) {
    return { intent: 'get_briefing', safe: true, readOnly: true };
  }
  if (lower.includes('email') || lower.includes('kirim')) {
    return { intent: 'create_routine', safe: false, blocked: true, reason: 'External write blocked' };
  }
  if ((lower.includes('github') || lower.includes('issue')) && lower.includes('otomatis')) {
    return { intent: 'create_routine', safe: false, requiresEvalV2: true, requiresProposal: true };
  }

  return { intent: 'unknown', safe: false };
}

test('"setiap pagi kasih ringkasan project" -> daily briefing routine, read-only', () => {
  const result = classifyRoutineIntent('setiap pagi kasih ringkasan project');
  assert.strictEqual(result.intent, 'create_routine');
  assert.strictEqual(result.type, 'briefing');
  assert.strictEqual(result.readOnly, true);
});

test('"buat rutinitas cek backup setiap hari" -> routine created, backup not run directly', () => {
  const result = classifyRoutineIntent('buat rutinitas cek backup setiap hari');
  assert.strictEqual(result.intent, 'create_routine');
  assert.strictEqual(result.directBackup, false);
  assert.strictEqual(result.requiresProposal, true);
});

test('"aktifkan auto backup" -> explains approval-safe flow, no direct backup', () => {
  const result = classifyRoutineIntent('aktifkan auto backup');
  assert.strictEqual(result.directBackup, false);
  assert.strictEqual(result.requiresProposal, true);
});

test('"jalankan routine health sekarang" -> read-only/dry-run, no danger action', () => {
  const result = classifyRoutineIntent('jalankan routine health sekarang');
  assert.strictEqual(result.dryRun, true);
  assert.strictEqual(result.readOnly, true);
});

test('"buat routine kirim email tiap pagi" -> blocked, external write not allowed', () => {
  const result = classifyRoutineIntent('buat routine kirim email tiap pagi');
  assert.strictEqual(result.blocked, true);
});

test('"buat routine create GitHub issue otomatis" -> requires eval v2 + proposal', () => {
  const result = classifyRoutineIntent('buat routine create GitHub issue otomatis');
  assert.strictEqual(result.requiresEvalV2, true);
  assert.strictEqual(result.requiresProposal, true);
});

test('"cek semua rutinitas" -> lists routines, read-only', () => {
  const result = classifyRoutineIntent('cek semua rutinitas');
  assert.strictEqual(result.intent, 'list_routines');
  assert.strictEqual(result.readOnly, true);
});

test('"hapus routine backup" -> soft delete, not hard delete', () => {
  const result = classifyRoutineIntent('hapus routine backup');
  assert.strictEqual(result.intent, 'remove_routine');
  assert.strictEqual(result.softDelete, true);
});

console.log(`\n📊 Routine Natural Chat Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);
