'use strict';

const reviewer = require('../src/research/research-risk-reviewer');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

const risk = reviewer.reviewResearchRisk('task1');
assert(risk.taskId === 'task1', 'reviewResearchRisk has taskId');
assert(risk.overallRisk, 'reviewResearchRisk has riskLevel');

const extRisk = reviewer.reviewExternalSourceRisk([{ accessMode: 'external' }, { accessMode: 'external' }, { accessMode: 'local' }]);
assert(extRisk.hasExternalSources === true, 'reviewExternalSourceRisk detects external');
assert(typeof extRisk.risk === 'string', 'reviewExternalSourceRisk has risk level');

const impRisk = reviewer.reviewImplementationRisk({});
assert(impRisk.risk === 'low', 'reviewImplementationRisk low');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
