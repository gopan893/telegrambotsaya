'use strict';

const intentClassifier = require('../src/telegram-router/telegram-intent-classifier');
const domainRouter = require('../src/telegram-router/telegram-domain-router');
const riskDetector = require('../src/telegram-router/telegram-risk-detector');
const privacyFilter = require('../src/telegram-router/telegram-privacy-filter');
const agentSelector = require('../src/telegram-router/telegram-agent-selector');
const routerExplainer = require('../src/telegram-router/telegram-router-explainer');
const regressionGuard = require('../src/telegram-router/telegram-router-regression-guard');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS:', name);
  } catch (e) {
    fail++;
    console.error('  FAIL:', name, '-', e.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

// Intent Classifier
test('classifyTelegramIntent normal chat', () => {
  const result = intentClassifier.classifyTelegramIntent('halo');
  assert(result.domain === 'normal_chat', 'Halo should be normal chat');
});

test('classifyTelegramIntent coding', () => {
  const result = intentClassifier.classifyTelegramIntent('buat prompt codex');
  assert(result.domain === 'coding', 'Codex prompt should be coding');
});

test('classifyTelegramIntent project', () => {
  const result = intentClassifier.classifyTelegramIntent('apa blocker project saya?');
  assert(result.domain === 'project', 'Blocker should be project');
});

test('classifyTelegramIntent deploy dangerous', () => {
  const result = intentClassifier.classifyTelegramIntent('deploy sekarang');
  assert(result.requiresApproval, 'Deploy should require approval');
  assert(result.riskLevel === 'danger', 'Deploy should be danger');
});

test('classifyTelegramIntent security', () => {
  const result = intentClassifier.classifyTelegramIntent('cek token bocor');
  assert(result.domain === 'security', 'Token check should be security');
});

test('classifyTelegramIntent privacy', () => {
  const result = intentClassifier.classifyTelegramIntent('hapus memory pribadi');
  assert(result.domain === 'privacy', 'Delete memory should be privacy');
});

test('classifyTelegramIntent device', () => {
  const result = intentClassifier.classifyTelegramIntent('cek Termux node');
  assert(result.domain === 'device', 'Termux should be device');
});

test('classifyTelegramIntent device dangerous', () => {
  const result = intentClassifier.classifyTelegramIntent('restart Mac sekarang');
  assert(result.requiresApproval, 'Restart should require approval');
  assert(result.domain === 'device', 'Restart should be device domain');
});

test('classifyTelegramIntent approval', () => {
  const result = intentClassifier.classifyTelegramIntent('approve proposal 123');
  assert(result.domain === 'approval', 'Approve should be approval');
  assert(result.requiresApproval, 'Approve action should require approval');
});

test('classifyTelegramIntent emotional', () => {
  const result = intentClassifier.classifyTelegramIntent('saya capek hari ini');
  assert(result.domain === 'normal_chat', 'Emotional should be normal chat');
});

test('classifyTelegramIntent workflow', () => {
  const result = intentClassifier.classifyTelegramIntent('buat workflow kalau test gagal');
  assert(result.domain === 'workflow', 'Workflow creation should be workflow');
});

test('classifyTelegramIntent cost', () => {
  const result = intentClassifier.classifyTelegramIntent('biaya token mahal');
  assert(result.domain === 'cost', 'Cost question should be cost');
});

test('classifyTelegramIntent research', () => {
  const result = intentClassifier.classifyTelegramIntent('bandingkan harga AI');
  assert(result.domain === 'research', 'Comparison should be research');
});

test('classifyTelegramIntent troubleshooting', () => {
  const result = intentClassifier.classifyTelegramIntent('kenapa bot error?');
  assert(result.domain === 'troubleshooting', 'Why error should be troubleshooting');
});

// Risk Detector
test('detectTelegramActionRisk dangerous', () => {
  const result = riskDetector.detectTelegramActionRisk('deploy sekarang', { requiresApproval: true }, {});
  assert(result.isDangerous, 'Deploy should be dangerous');
});

test('detectDangerousActionRequest', () => {
  const result = riskDetector.detectDangerousActionRequest('deploy sekarang');
  assert(result.isDangerous, 'Deploy should be detected');
  assert(result.matched, 'Should match pattern');
});

test('detectTelegramActionRisk safe', () => {
  const result = riskDetector.detectTelegramActionRisk('halo apa kabar', {}, {});
  assert(!result.isDangerous, 'Greeting should not be dangerous');
});

// Agent Selector
test('selectAgentForTelegramIntent coding', () => {
  const intent = { domain: 'coding' };
  const agent = agentSelector.selectAgentForTelegramIntent(intent, {});
  assert(agent.primary === 'coder', 'Coding should use coder');
});

test('selectAgentForTelegramIntent normal', () => {
  const intent = { domain: 'normal_chat' };
  const agent = agentSelector.selectAgentForTelegramIntent(intent, {});
  assert(agent.primary === 'lifeos', 'Normal chat should use lifeos');
});

test('buildAgentSelectionExplanation', () => {
  const intent = { domain: 'coding' };
  const agent = agentSelector.selectAgentForTelegramIntent(intent, {});
  const explanation = agentSelector.buildAgentSelectionExplanation(intent, agent);
  assert(explanation.includes('coding'), 'Should mention coding');
});

// Privacy Filter
test('detectGroupChatPrivacyRisk group privacy', () => {
  const ctx = { chat: { type: 'group' } };
  const intent = { domain: 'privacy' };
  const result = privacyFilter.detectGroupChatPrivacyRisk(ctx, intent, {});
  assert(result.risk, 'Privacy in group should be risk');
});

test('detectGroupChatPrivacyRisk private chat', () => {
  const ctx = { chat: { type: 'private' } };
  const intent = { domain: 'privacy' };
  const result = privacyFilter.detectGroupChatPrivacyRisk(ctx, intent, {});
  assert(!result.risk, 'Privacy in private chat should be fine');
});

// Router Explainer
test('explainRoutingDecision', () => {
  const intent = { domain: 'coding', intent: 'coding', confidence: 85 };
  const agent = { primary: 'coder', agents: ['coder'] };
  const result = routerExplainer.explainRoutingDecision(intent, agent);
  assert(result.includes('coding'), 'Should mention coding');
});

// Regression Guard
test('runRegression', () => {
  const result = regressionGuard.runRegression();
  assert(result.total > 0, 'Should have test cases');
  assert(typeof result.passed === 'number', 'Should count passes');
});

console.log(`\n=== Phase T3 Natural Router Results ===`);
console.log(`${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
