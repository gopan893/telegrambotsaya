'use strict';

const assert = require('assert');
const risk = require('../src/agents/advanced-risk-scorer');
const confidence = require('../src/agents/confidence-scorer');
const utils = require('../src/agents/decision-utils');

const restore = utils.buildOption({ label: 'Restore backup lama langsung', description: 'restore overwrite database' }, 0);
const restoreRisk = risk.scoreDecisionRisk(restore, {}, {});
assert.ok(['high', 'danger'].includes(restoreRisk.level));
assert.strictEqual(restoreRisk.approvalRequired, true);

const ten = utils.buildOption({ label: 'Tambah 10 bot langsung' }, 0);
const four = utils.buildOption({ label: 'Mulai 4 bot dulu' }, 1);
assert.ok(risk.scoreDecisionRisk(ten).score > risk.scoreDecisionRisk(four).score);

const lowInfo = confidence.scoreDecisionConfidence({ contextSummary: '', prosCons: [] }, [], [], {}, {});
assert.strictEqual(lowInfo.level, 'low');

const clear = confidence.scoreDecisionConfidence({ contextSummary: 'cukup jelas' }, [four, utils.buildOption({ label: 'Tunda dulu' }, 2)], [risk.scoreDecisionRisk(four)], {}, {});
assert.ok(['medium', 'high'].includes(clear.level));

console.log('test-risk-confidence-scorer: ok');
