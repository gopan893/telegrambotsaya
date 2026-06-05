'use strict';

const { createQualityGate } = require('../cicd-quality-gate');

(async () => {
  const qg = createQualityGate();
  const pass = await qg.runQualityChecks({ evaluationScore: 100 });
  console.assert(pass.ok === true, 'Quality gate should pass with 100 score');
  const fail = await qg.runQualityChecks({ evaluationScore: 50 });
  console.assert(fail.ok === false, 'Quality gate should fail with 50 score');
  console.assert(Array.isArray(fail.checks), 'Should return checks array');
  console.log('cicd-quality-gate tests passed');
})();
