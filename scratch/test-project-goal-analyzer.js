'use strict';

const store = require('../src/operator/project-operator-store');
const analyzer = require('../src/operator/project-goal-analyzer');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
console.log('test-project-goal-analyzer');

const r1 = analyzer.analyzeProjectGoal({ title: '' });
assert(r1.analysis.error === 'no_input', 'empty input error');

const r2 = analyzer.analyzeProjectGoal({ title: 'selesaikan bot Telegram AI OS sampai production stabil' });
assert(r2.goal !== null, 'goal created');
assert(r2.goal.status === 'idea', 'goal status idea');
assert(r2.analysis.category === 'mixed' || r2.analysis.category === 'deployment', 'category mixed/deployment');
assert(r2.analysis.successCriteria.length > 0, 'has success criteria');

const r3 = analyzer.analyzeProjectGoal({ title: 'buat fitur push GitHub otomatis tapi aman' });
assert(r3.goal !== null, 'goal created for github');
assert(r3.analysis.risk.level === 'high', 'high risk for push');

const r4 = analyzer.analyzeProjectGoal({ title: 'belajar bahasa baru', description: 'tutorial python' });
assert(r4.analysis.category === 'learning', 'learning category');

const r5 = analyzer.classifyProjectGoal('');
assert(r5 === 'mixed', 'classify empty mixed');

const r6 = analyzer.buildGoalSummary(null);
assert(r6 === 'No goal.', 'buildGoalSummary null');

const r7 = analyzer.buildGoalSummary(r2.goal);
assert(r7.includes(r2.goal.title), 'buildGoalSummary includes title');

const r8 = analyzer.detectGoalRisk({ title: 'maintenance minor' });
assert(r8.level === 'low', 'low risk maintenance');

store.deleteAll();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
