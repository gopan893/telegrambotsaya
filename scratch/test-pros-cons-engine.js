'use strict';

const assert = require('assert');
const extractor = require('../src/agents/option-extractor');
const prosCons = require('../src/agents/pros-cons-engine');
const utils = require('../src/agents/decision-utils');

const options = extractor.extractOptionsFromMessage('lebih baik tambah 10 bot langsung atau 4 bot dulu?');
const criteria = utils.selectCriteria('lebih baik tambah 10 bot langsung atau 4 bot dulu?');
const result = prosCons.buildProsCons(options, criteria, {}, {});
assert.strictEqual(result.length, options.length);
assert.ok(result.every(item => item.pros.length && item.cons.length));
assert.ok(result.some(item => item.assumptions.length));
assert.ok(prosCons.summarizeProsCons(result).length >= 2);

const restore = extractor.extractOptionsFromMessage('apakah saya harus restore backup lama?');
const restorePc = prosCons.buildProsCons(restore, criteria, {}, {});
assert.ok(JSON.stringify(restorePc).includes('checksum') || JSON.stringify(restorePc).includes('approval'));
assert.ok(!JSON.stringify(restorePc).includes('chain-of-thought'));

console.log('test-pros-cons-engine: ok');
