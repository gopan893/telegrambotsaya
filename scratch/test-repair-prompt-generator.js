'use strict';

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) { console.log('  PASS: ' + msg); passed++; }
  else { console.error('  FAIL: ' + msg); failed++; }
}

var promptGen;
try {
  promptGen = require('../src/selfhealing/repair-prompt-generator');
  assert(true, 'repair-prompt-generator module loads');
  assert(typeof promptGen.createRepairPromptGenerator === 'function', 'createRepairPromptGenerator is function');
} catch (e) {
  assert(false, 'repair-prompt-generator module loads: ' + e.message);
}

var generator = promptGen.createRepairPromptGenerator();
var mockPlan = {
  title: 'Fix Dashboard Router',
  problemSummary: 'Workspaces tab shows Overview instead of Workspaces page',
  suspectedRootCause: 'Missing renderWorkspacesPage function in ui.js',
  affectedAreas: ['dashboard', 'ui'],
  filesLikelyAffected: ['public/dashboard/state.js', 'public/dashboard/ui.js'],
  repairSteps: ['Add renderWorkspacesPage to ui.js', 'Verify in DASHBOARD_TABS', 'Run tests'],
  testsToRun: ['node scratch/test-dashboard-router-registry.js', 'node scratch/test-dashboard-all-menu-routes.js'],
  riskLevel: 'high',
  requiresApproval: true
};

// Test generateCodexRepairPrompt
var codexPrompt = generator.generateCodexRepairPrompt(mockPlan);
assert(codexPrompt.indexOf('## Task') >= 0, 'codex prompt has ## Task');
assert(codexPrompt.indexOf(mockPlan.title) >= 0, 'codex prompt includes title');
assert(codexPrompt.indexOf(mockPlan.problemSummary) >= 0, 'codex prompt includes problem summary');
assert(codexPrompt.indexOf('CommonJS') >= 0, 'codex prompt includes CommonJS constraint');

// Test generateHermesRepairPrompt
var hermesPrompt = generator.generateHermesRepairPrompt(mockPlan);
assert(hermesPrompt.indexOf('HERMES REPAIR REQUEST') >= 0, 'hermes prompt has header');
assert(hermesPrompt.indexOf('Approval: REQUIRED') >= 0, 'hermes prompt includes approval requirement');

// Test generateCompactRepairPrompt
var compactPrompt = generator.generateCompactRepairPrompt(mockPlan);
assert(compactPrompt.indexOf('Fix:') >= 0, 'compact prompt has Fix:');
assert(compactPrompt.indexOf(mockPlan.repairSteps[0]) >= 0, 'compact prompt includes repair steps');

// Test generateP0OnlyRepairPrompt
var p0Prompt = generator.generateP0OnlyRepairPrompt(mockPlan);
assert(p0Prompt.indexOf('P0 HOTFIX') >= 0, 'p0 prompt has P0 HOTFIX');

// Verify no secrets in prompts
var allPrompts = [codexPrompt, hermesPrompt, compactPrompt, p0Prompt].join(' ');
assert(allPrompts.indexOf('TELEGRAM_TOKEN') === -1, 'no telegram token in prompts');
assert(allPrompts.indexOf('ghp_') === -1, 'no github token in prompts');
assert(allPrompts.indexOf('sk-') === -1, 'no openai key in prompts');

console.log('\n=== Repair Prompt Generator ===');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
