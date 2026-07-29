'use strict';

const { createQualityGate } = require('../cicd-quality-gate');

test('passes score 100 and rejects score 50', async () => {
  const gate = createQualityGate();
  await expect(gate.runQualityChecks({ evaluationScore: 100 })).resolves.toMatchObject({ ok: true });
  const failed = await gate.runQualityChecks({ evaluationScore: 50 });
  expect(failed).toMatchObject({ ok: false });
  expect(Array.isArray(failed.checks)).toBe(true);
});
