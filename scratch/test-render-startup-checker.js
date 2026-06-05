'use strict';

const startupChecker = require('../src/deploy/render-startup-checker');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

console.log('\n--- render-startup-checker ---');
const repoRoot = process.cwd();
const services = { repoRoot };

const syntax = startupChecker.runStartupSyntaxCheck(services);
assert(syntax.ok === true, 'syntax check passes on telebot.js');
assert(syntax.syntaxValid === true, 'syntax valid');

const smoke = startupChecker.runStartupSmokePlan(services);
assert(smoke.ok === true, 'smoke plan generated');
assert(smoke.plan.includes('node --check'), 'plan mentions syntax check');

const deps = startupChecker.detectMissingDependencies(services);
assert(deps.ok === true, 'all dependencies found');
assert(deps.totalDeps > 0, 'deps counted');

const esm = startupChecker.detectCommonJsEsmMismatch(services);
assert(esm.ok === true, 'no ESM mismatch');

const exports_ = startupChecker.detectBrokenExports(services);
assert(exports_.ok === true, 'export check ok');

const report = startupChecker.buildStartupCheckReport(services);
assert(report.ok === true, 'startup report ok');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
