'use strict';

const assert = require('assert');
const risk = require('../src/telegram-control/telegram-risk-classifier');

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL: ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

function run() {
  console.log('=== test-telegram-risk-classifier.js ===\n');

  // ── RISK_LEVELS and RISK_RANK ──

  test('RISK_LEVELS array has 5 levels', () => {
    assert.strictEqual(risk.RISK_LEVELS.length, 5);
    assert.deepStrictEqual(risk.RISK_LEVELS, ['read_only', 'low', 'medium', 'high', 'danger']);
  });

  test('RISK_RANK has correct values', () => {
    assert.strictEqual(risk.RISK_RANK.read_only, 0);
    assert.strictEqual(risk.RISK_RANK.low, 1);
    assert.strictEqual(risk.RISK_RANK.medium, 2);
    assert.strictEqual(risk.RISK_RANK.high, 3);
    assert.strictEqual(risk.RISK_RANK.danger, 4);
  });

  // ── classifyTelegramCommandRisk ──

  test('classifyTelegramCommandRisk returns unknown for null', () => {
    const result = risk.classifyTelegramCommandRisk(null);
    assert.strictEqual(result.level, 'unknown');
    assert.strictEqual(result.rank, -1);
  });

  test('classifyTelegramCommandRisk read_only', () => {
    const cmd = { name: 'help', riskLevel: 'read_only' };
    const result = risk.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(result.level, 'read_only');
    assert.strictEqual(result.rank, 0);
    assert.strictEqual(result.requiresApproval, false);
    assert.strictEqual(result.requiresEvaluation, false);
  });

  test('classifyTelegramCommandRisk low', () => {
    const cmd = { name: 'settings', riskLevel: 'low' };
    const result = risk.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(result.level, 'low');
    assert.strictEqual(result.rank, 1);
    assert.strictEqual(result.requiresApproval, false);
    assert.strictEqual(result.requiresEvaluation, false);
  });

  test('classifyTelegramCommandRisk medium', () => {
    const cmd = { name: 'backupcreate', riskLevel: 'medium' };
    const result = risk.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(result.level, 'medium');
    assert.strictEqual(result.rank, 2);
    assert.strictEqual(result.requiresApproval, false);
    assert.strictEqual(result.requiresEvaluation, false);
  });

  test('classifyTelegramCommandRisk high', () => {
    const cmd = { name: 'approve', riskLevel: 'high' };
    const result = risk.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(result.level, 'high');
    assert.strictEqual(result.rank, 3);
    assert.strictEqual(result.requiresApproval, true);
    assert.strictEqual(result.requiresEvaluation, true);
  });

  test('classifyTelegramCommandRisk danger', () => {
    const cmd = { name: 'runexec', riskLevel: 'danger' };
    const result = risk.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(result.level, 'danger');
    assert.strictEqual(result.rank, 4);
    assert.strictEqual(result.requiresApproval, true);
    assert.strictEqual(result.requiresEvaluation, true);
  });

  test('classifyTelegramCommandRisk default riskLevel', () => {
    const cmd = { name: 'test' };
    const result = risk.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(result.level, 'read_only');
    assert.strictEqual(result.rank, 0);
  });

  test('classifyTelegramCommandRisk includes actionType from module', () => {
    const cmd = { name: 'test', riskLevel: 'high', module: 'deploy' };
    const result = risk.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(result.actionType, 'deploy');
  });

  test('classifyTelegramCommandRisk has explanation for each level', () => {
    for (const level of risk.RISK_LEVELS) {
      const result = risk.classifyTelegramCommandRisk({ name: 'test', riskLevel: level });
      assert.ok(result.explanation);
    }
  });

  // ── classifyTelegramNaturalRisk ──

  test('classifyTelegramNaturalRisk returns unknown for null', () => {
    const result = risk.classifyTelegramNaturalRisk(null);
    assert.strictEqual(result.level, 'unknown');
    assert.strictEqual(result.rank, -1);
  });

  test('classifyTelegramNaturalRisk handles string intent', () => {
    const result = risk.classifyTelegramNaturalRisk('help');
    assert.strictEqual(result.level, 'read_only');
  });

  test('classifyTelegramNaturalRisk danger actions', () => {
    const dangerIntents = ['push', 'deploy', 'rollback', 'restore', 'backup_danger', 'shell_exec', 'workflow_dispatch', 'hard_delete'];
    for (const intent of dangerIntents) {
      const result = risk.classifyTelegramNaturalRisk(intent);
      assert.strictEqual(result.level, 'danger', `Expected danger for ${intent}`);
      assert.strictEqual(result.requiresApproval, true);
      assert.strictEqual(result.requiresEvaluation, true);
    }
  });

  test('classifyTelegramNaturalRisk high actions', () => {
    const highIntents = ['approve', 'run_exec', 'propose_push', 'propose_deploy', 'propose_rollback', 'propose_workflow_run', 'gmail_send', 'calendar_write', 'permission_change'];
    for (const intent of highIntents) {
      const result = risk.classifyTelegramNaturalRisk(intent);
      assert.ok(result.level === 'high' || result.level === 'danger', `Expected high or danger for ${intent}, got ${result.level}`);
      assert.strictEqual(result.requiresApproval, true);
      assert.strictEqual(result.requiresEvaluation, true);
    }
  });

  test('classifyTelegramNaturalRisk medium actions', () => {
    const mediumIntents = ['reject', 'cancel_exec', 'backup_create', 'memory_cleanup', 'goal_create', 'budget_set', 'close_incident', 'run_routine'];
    for (const intent of mediumIntents) {
      const result = risk.classifyTelegramNaturalRisk(intent);
      assert.strictEqual(result.level, 'medium', `Expected medium for ${intent}`);
      assert.strictEqual(result.requiresApproval, false);
      assert.strictEqual(result.requiresEvaluation, false);
    }
  });

  test('classifyTelegramNaturalRisk low actions', () => {
    const lowIntents = ['settings_change', 'multibot_toggle', 'routine_toggle', 'task_done', 'habit_checkin', 'mood_log', 'selfheal_run'];
    for (const intent of lowIntents) {
      const result = risk.classifyTelegramNaturalRisk(intent);
      assert.strictEqual(result.level, 'low', `Expected low for ${intent}`);
      assert.strictEqual(result.requiresApproval, false);
      assert.strictEqual(result.requiresEvaluation, false);
    }
  });

  test('classifyTelegramNaturalRisk read-only intents', () => {
    const readOnly = ['help', 'menu', 'status', 'health', 'prod_health', 'list_incidents', 'tasks', 'habits', 'focus', 'reminders', 'knowledge', 'portfolio', 'goals', 'priorities', 'plans', 'briefing'];
    for (const intent of readOnly) {
      const result = risk.classifyTelegramNaturalRisk(intent);
      assert.strictEqual(result.level, 'read_only', `Expected read_only for ${intent}`);
      assert.strictEqual(result.requiresApproval, false);
      assert.strictEqual(result.requiresEvaluation, false);
    }
  });

  test('classifyTelegramNaturalRisk unknown intent defaults to read_only', () => {
    const result = risk.classifyTelegramNaturalRisk('some_random_unknown_intent');
    assert.strictEqual(result.level, 'read_only');
    assert.strictEqual(result.rank, 0);
  });

  // ── requiresEvaluationGate ──

  test('requiresEvaluationGate returns false for null', () => {
    assert.strictEqual(risk.requiresEvaluationGate(null), false);
  });

  test('requiresEvaluationGate returns false for read_only', () => {
    assert.strictEqual(risk.requiresEvaluationGate({ rank: 0 }), false);
  });

  test('requiresEvaluationGate returns false for low', () => {
    assert.strictEqual(risk.requiresEvaluationGate({ rank: 1 }), false);
  });

  test('requiresEvaluationGate returns false for medium', () => {
    assert.strictEqual(risk.requiresEvaluationGate({ rank: 2 }), false);
  });

  test('requiresEvaluationGate returns true for high', () => {
    assert.strictEqual(risk.requiresEvaluationGate({ rank: 3 }), true);
  });

  test('requiresEvaluationGate returns true for danger', () => {
    assert.strictEqual(risk.requiresEvaluationGate({ rank: 4 }), true);
  });

  test('requiresEvaluationGate accepts string risk level', () => {
    assert.strictEqual(risk.requiresEvaluationGate('high'), true);
    assert.strictEqual(risk.requiresEvaluationGate('low'), false);
    assert.strictEqual(risk.requiresEvaluationGate('read_only'), false);
  });

  // ── requiresExecutorProposal ──

  test('requiresExecutorProposal returns false for null', () => {
    assert.strictEqual(risk.requiresExecutorProposal(null), false);
  });

  test('requiresExecutorProposal false for read_only', () => {
    assert.strictEqual(risk.requiresExecutorProposal({ rank: 0 }), false);
  });

  test('requiresExecutorProposal false for low', () => {
    assert.strictEqual(risk.requiresExecutorProposal({ rank: 1 }), false);
  });

  test('requiresExecutorProposal true for medium', () => {
    assert.strictEqual(risk.requiresExecutorProposal({ rank: 2 }, 'something'), true);
  });

  test('requiresExecutorProposal true for high', () => {
    assert.strictEqual(risk.requiresExecutorProposal({ rank: 3 }), true);
  });

  test('requiresExecutorProposal true for danger', () => {
    assert.strictEqual(risk.requiresExecutorProposal({ rank: 4 }), true);
  });

  test('requiresExecutorProposal false for read_only actionType even if medium', () => {
    assert.strictEqual(risk.requiresExecutorProposal({ rank: 2 }, 'read_only'), false);
  });

  test('requiresExecutorProposal accepts string risk level', () => {
    assert.strictEqual(risk.requiresExecutorProposal('medium'), true);
  });

  // ── buildRiskExplanation ──

  test('buildRiskExplanation returns default for null', () => {
    assert.strictEqual(risk.buildRiskExplanation(null), 'Unknown risk');
  });

  test('buildRiskExplanation for string levels', () => {
    assert.ok(risk.buildRiskExplanation('read_only').includes('Read-only'));
    assert.ok(risk.buildRiskExplanation('low').includes('Low risk'));
    assert.ok(risk.buildRiskExplanation('medium').includes('Medium risk'));
    assert.ok(risk.buildRiskExplanation('high').includes('High risk'));
    assert.ok(risk.buildRiskExplanation('danger').includes('Danger'));
  });

  test('buildRiskExplanation for unknown string level', () => {
    assert.ok(risk.buildRiskExplanation('unknown_level').includes('Unknown risk level'));
  });

  test('buildRiskExplanation for object risk', () => {
    const result = risk.buildRiskExplanation({ explanation: 'Custom explanation' });
    assert.strictEqual(result, 'Custom explanation');
  });

  test('buildRiskExplanation for object without explanation', () => {
    const result = risk.buildRiskExplanation({});
    assert.strictEqual(result, 'No explanation');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
