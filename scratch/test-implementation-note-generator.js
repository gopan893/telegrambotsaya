'use strict';

const gen = require('../src/research/implementation-note-generator');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

const note = gen.generateImplementationNote('task1');
assert(note.taskId === 'task1', 'generateImplementationNote has taskId');
assert(note.architectureImpact, 'has architectureImpact');
assert(note.riskAndMitigation, 'has riskAndMitigation');
assert(note.testPlan, 'has testPlan');
assert(note.rolloutPlan, 'has rolloutPlan');
assert(note.testPlan.tests.length >= 2, 'testPlan has at least 2 test suggestions');

const arch = gen.generateArchitectureImpact('task1');
assert(arch.summary, 'generateArchitectureImpact has summary');

const risk = gen.generateRiskAndMitigation('task1');
assert(risk.overallRisk, 'generateRiskAndMitigation has overallRisk');

const testPlan = gen.generateTestPlanFromResearch('task1');
assert(testPlan.tests.length >= 2, 'generateTestPlanFromResearch has tests');

const rollout = gen.generateRolloutPlanFromResearch('task1');
assert(rollout.stages.length >= 2, 'generateRolloutPlanFromResearch has stages');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
