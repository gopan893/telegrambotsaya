'use strict';

const cls = require('../src/privacy/data-classification-engine');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test classifyDataCategory returns correct sensitivity
assert(cls.classifyDataCategory('telegram_messages') === 'private', 'telegram_messages -> private');
assert(cls.classifyDataCategory('lifeos_mood_energy') === 'sensitive', 'lifeos_mood_energy -> sensitive');
assert(cls.classifyDataCategory('knowledge_graph') === 'internal', 'knowledge_graph -> internal');

// Test classifyDataCategory returns default 'internal' for unknown category
assert(cls.classifyDataCategory('nonexistent') === 'internal', 'unknown category -> internal');

// Test classifyRecordSensitivity detects secret patterns
const secretRecord = { key: 'ghp_abc12345def' };
assert(cls.classifyRecordSensitivity(secretRecord) === 'secret_blocked', 'ghp_ token -> secret_blocked');

const tokenRecord = { data: 'Bearer xyz789' };
assert(cls.classifyRecordSensitivity(tokenRecord) === 'secret_blocked', 'Bearer -> secret_blocked');

const apiKeyRecord = { key: 'sk-abcdefgh12345' };
assert(cls.classifyRecordSensitivity(apiKeyRecord) === 'secret_blocked', 'sk- -> secret_blocked');

// Test classifyRecordSensitivity detects mood/energy/private_note as sensitive
const moodRecord = { text: 'feeling great mood' };
assert(cls.classifyRecordSensitivity(moodRecord) === 'sensitive', 'mood record -> sensitive');

const energyRecord = { data: 'energy level high' };
assert(cls.classifyRecordSensitivity(energyRecord) === 'sensitive', 'energy record -> sensitive');

// Test classifyRecordSensitivity returns private by default
const normalRecord = { name: 'test', value: 123 };
assert(cls.classifyRecordSensitivity(normalRecord) === 'private', 'normal record -> private');

// Test detectSensitivePersonalData detects mood/energy/emotion
assert(cls.detectSensitivePersonalData({ text: 'mood happy' }) === true, 'detects mood');
assert(cls.detectSensitivePersonalData({ text: 'energy low' }) === true, 'detects energy');
assert(cls.detectSensitivePersonalData({ text: 'emotion sad' }) === true, 'detects emotion');
assert(cls.detectSensitivePersonalData({ text: 'feeling good' }) === true, 'detects feeling');
assert(cls.detectSensitivePersonalData({ text: 'private note' }) === true, 'detects private');

// Test detectSensitivePersonalData returns false for safe data
assert(cls.detectSensitivePersonalData({ text: 'hello world' }) === false, 'safe data returns false');
assert(cls.detectSensitivePersonalData(null) === false, 'null returns false');

// Test detectSecretBlockedData returns true for token patterns
assert(cls.detectSecretBlockedData({ key: 'ghp_abcdefg12345' }) === true, 'detects ghp_ token');
assert(cls.detectSecretBlockedData({ key: 'sk-abcdefg12345' }) === true, 'detects sk- token');
assert(cls.detectSecretBlockedData({ key: 'github_pat_abcdefg' }) === true, 'detects github_pat_');

// Test detectSecretBlockedData returns false for safe data
assert(cls.detectSecretBlockedData({ text: 'hello' }) === false, 'safe data returns false');
assert(cls.detectSecretBlockedData(null) === false, 'null returns false');

// Test buildClassificationSummary correct format
const results = [
  { classification: 'private' },
  { classification: 'sensitive' },
  { classification: 'private' }
];
const summary = cls.buildClassificationSummary(results);
assert(summary.total === 3, 'summary total is 3');
assert(summary.counts.private === 2, 'summary counts private is 2');
assert(summary.counts.sensitive === 1, 'summary counts sensitive is 1');

// Test buildClassificationSummary empty
const emptySummary = cls.buildClassificationSummary([]);
assert(emptySummary.total === 0, 'empty summary total is 0');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
