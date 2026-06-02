'use strict';

const assert = require('assert');
const extractor = require('../src/agents/option-extractor');

const ab = extractor.extractOptionsFromMessage('lebih baik tambah 10 bot langsung atau 4 bot dulu?');
assert.ok(ab.some(option => /10 bot/i.test(option.label)));
assert.ok(ab.some(option => /4 bot/i.test(option.label)));

const open = extractor.extractOptionsFromMessage('lanjut phase berapa?');
assert.ok(open.length >= 2);
assert.ok(open.length <= 4);

const low = extractor.extractOptionsFromMessage('mana yang paling bagus?');
assert.ok(low.some(option => /informasi|tunda/i.test(option.label)));

const pipe = extractor.extractOptionsFromMessage('PostgreSQL | JSON | Redis | SQLite | Neo4j');
assert.strictEqual(pipe.length, 4);
assert.ok(!JSON.stringify(pipe).includes('secret-token-value'));

console.log('test-option-extractor: ok');
