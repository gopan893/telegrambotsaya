'use strict';

const gate = require('../src/knowledge/memory-safety-gate');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-memory-safety-gate');

const safe = gate.runMemorySafetyGate({ type: 'memory', title: 'Note', summary: 'safe content' });
assert(safe.ok && !safe.blocked, 'safe candidate passes');

const db = gate.runMemorySafetyGate({ type: 'memory', title: 'Config', summary: 'DATABASE_URL=postgresql://user:pass@host:5432/db' });
assert(!db.ok && db.blocked, 'blocks DATABASE_URL');
assert(db.safeSummary && db.safeSummary.includes('redacted'), 'safe summary');

const tok = gate.runMemorySafetyGate({ type: 'memory', title: 'Token', summary: 'token: ghp_abcd1234efgh' });
assert(!tok.ok, 'blocks token=');

const api = gate.runMemorySafetyGate({ type: 'memory', title: 'API', summary: 'api_key: sk-abcdef1234567890' });
assert(!api.ok, 'blocks api_key');

const meta = gate.runMemorySafetyGate({ type: 'memory', title: 'Meta', summary: 'x', metadata: { GITHUB_TOKEN: 'ghp_abcd1234' } });
assert(!meta.ok, 'blocks secret in metadata');

const tag = gate.runMemorySafetyGate({ type: 'memory', title: 'Tag', summary: 'x', tags: ['token', 'public'] });
assert(!tag.ok, 'blocks sensitive tag');

const det = gate.detectSecretInMemory({ title: 't', summary: 'Bearer abcdefghijk' });
assert(det.found, 'detectSecretInMemory finds Bearer');

const red = gate.redactSensitiveMemory({ title: 'X', summary: 'token: ghp_secret_thing' });
assert(red.redacted, 'redactSensitiveMemory redacts');
assert(red.candidate.summary.includes('[REDACTED_SECRET]'), 'redaction placeholder present');

const block = gate.blockUnsafeMemory({ title: 't', summary: 'password=hunter2hunter2' });
assert(block.blocked, 'blockUnsafeMemory blocks');

const report = gate.buildMemorySafetyReport({ title: 't', summary: 'plain' });
assert(report.safeToStore === true, 'report safeToStore true for plain');
assert(!report.detected, 'report not detected for plain');

const r2 = gate.buildMemorySafetyReport({ title: 't', summary: 'token: abc123def456ghi' });
assert(r2.safeToStore === false, 'report safeToStore false for secret');
assert(r2.detected, 'report detected');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
