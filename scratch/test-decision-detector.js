'use strict';

const assert = require('assert');
const detector = require('../src/agents/decision-detector');

assert.strictEqual(detector.isDecisionRequest('lebih baik tambah 10 bot langsung atau 4 dulu?'), true);
assert.strictEqual(detector.isDecisionRequest('lanjut phase berapa?'), true);
assert.strictEqual(detector.detectRiskDecisionIntent('apakah saya harus restore backup lama?'), true);
assert.strictEqual(detector.detectActionDecisionIntent('apakah saya harus jalankan restore?'), true);
assert.strictEqual(detector.isDecisionRequest('halo'), false);
assert.strictEqual(detector.isDecisionRequest('saya capek hari ini'), false);
assert.strictEqual(detector.isDecisionRequest('saya capek hari ini, harus lanjut coding atau istirahat?'), true);
assert.strictEqual(detector.shouldTriggerDecisionSystem('mana yang lebih aman PostgreSQL atau JSON?', {}, {}, {}, {}).needed, true);

console.log('test-decision-detector: ok');
