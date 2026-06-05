'use strict';

const assert = require('assert');
const { createQualityGate } = require('../src/cicd/cicd-quality-gate');
const { createCicdQualityGates } = require('../src/cicd/cicd-quality-gates');

async function run() {
  const gate = createQualityGate();
  const pass = await gate.runQualityChecks({ evaluationScore: 100 });
  assert.strictEqual(pass.ok, true, 'quality gate passes with eval score 100');

  const fail = await gate.runQualityChecks({ evaluationScore: 50 });
  assert.strictEqual(fail.ok, false, 'quality gate fails below threshold');
  assert(fail.checks.some(check => check.name === 'Evaluation score'), 'evaluation check present');

  const alias = createCicdQualityGates();
  assert.strictEqual(typeof alias.runQualityChecks, 'function', 'plural alias exports quality gate');

  console.log('test-cicd-quality-gates: ok');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
