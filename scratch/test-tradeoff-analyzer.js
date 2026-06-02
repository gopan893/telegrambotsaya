'use strict';

const assert = require('assert');
const extractor = require('../src/agents/option-extractor');
const tradeoff = require('../src/agents/tradeoff-analyzer');
const utils = require('../src/agents/decision-utils');

const options = extractor.extractOptionsFromMessage('lebih baik tambah 10 bot langsung atau 4 bot dulu?')
  .map((option, index) => ({ ...option, score: index === 1 ? 80 : 45 }));
const criteria = utils.selectCriteria('lebih baik tambah 10 bot langsung atau 4 bot dulu?');
const analysis = tradeoff.analyzeTradeoffs(options, criteria, [], [], {});
assert.ok(analysis.matrix.length >= 2);
assert.ok(analysis.comparisons.length >= 1);
assert.ok(/speed vs safety/i.test(analysis.keyTradeoffs.join(' ')));
assert.strictEqual(tradeoff.detectDominantOption(options).label, options[1].label);

const close = options.map(option => ({ ...option, score: 50 }));
assert.strictEqual(tradeoff.detectNoClearWinner(close), true);

console.log('test-tradeoff-analyzer: ok');
