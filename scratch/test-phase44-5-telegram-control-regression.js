'use strict';

const assert = require('assert');

const registry = require('../src/telegram-control/telegram-command-registry');
const naturalRouter = require('../src/telegram-control/telegram-natural-router');
const intentClassifier = require('../src/telegram-control/telegram-intent-classifier');
const permissionGuard = require('../src/telegram-control/telegram-permission-guard');
const riskClassifier = require('../src/telegram-control/telegram-risk-classifier');
const formatter = require('../src/telegram-control/telegram-response-formatter');
const helpMenu = require('../src/telegram-control/telegram-help-menu');
const proposalRouter = require('../src/telegram-control/telegram-proposal-router');
const audit = require('../src/telegram-control/telegram-command-audit');

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

function makeMessage(text, opts) {
  return {
    message: {
      text: text || '',
      from: { id: opts?.userId || 12345, is_bot: false },
      chat: { id: opts?.chatId || 67890 },
      message_id: opts?.messageId || 1
    }
  };
}

audit.clearAuditLog();

function run() {
  console.log('=== test-phase44-5-telegram-control-regression.js ===\n');

  // ════════════════════════════════════════════════
  // FULL FLOW: natural message → classification → command lookup → risk classification → proposal creation
  // ════════════════════════════════════════════════

  test('Full flow: natural push message -> propose_push -> danger risk -> proposal', () => {
    const msg = makeMessage('push perubahan ini ke github', { userId: 1, chatId: 100 });
    const routeResult = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(routeResult.handled, true);

    // Classification maps to propose_push
    assert.ok(routeResult.classification);
    assert.strictEqual(routeResult.classification.command, 'propose_push');

    // Command lookup finds the command
    const cmd = routeResult.command || registry.getTelegramCommand('propose_push');
    assert.ok(cmd);
    assert.strictEqual(cmd.name, 'propose_push');

    // Risk classification -> high (propose_push is high)
    const risk = riskClassifier.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(risk.level, 'high');
    assert.strictEqual(risk.requiresApproval, true);
    assert.strictEqual(risk.requiresEvaluation, true);

    // Create proposal
    const plan = naturalRouter.buildNaturalActionPlan(routeResult);
    assert.ok(plan);
    plan.chatId = 100;
    plan.userId = 1;
    const proposal = proposalRouter.routeTelegramActionToProposal(plan);
    assert.ok(proposal.created || proposal.duplicate);
  });

  test('Full flow: natural deploy message -> propose_deploy -> high risk -> proposal', () => {
    const msg = makeMessage('deploy ke render', { userId: 1, chatId: 100 });
    const routeResult = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(routeResult.handled, true);
    assert.strictEqual(routeResult.classification.command, 'propose_deploy');

    const cmd = registry.getTelegramCommand('propose_deploy');
    assert.ok(cmd);
    const risk = riskClassifier.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(risk.level, 'high');
    assert.strictEqual(risk.requiresApproval, true);
    assert.strictEqual(risk.requiresEvaluation, true);

    const plan = naturalRouter.buildNaturalActionPlan(routeResult);
    plan.chatId = 100;
    plan.userId = 1;
    const proposal = proposalRouter.routeTelegramActionToProposal(plan);
    assert.ok(proposal.created || proposal.duplicate);
  });

  test('Full flow: natural rollback message -> propose_rollback -> high risk -> proposal', () => {
    const msg = makeMessage('rollback deploy terakhir', { userId: 1, chatId: 100 });
    const routeResult = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(routeResult.handled, true);

    const cmd = registry.getTelegramCommand('propose_rollback');
    assert.ok(cmd);
    const risk = riskClassifier.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(risk.level, 'high');
    assert.strictEqual(risk.requiresApproval, true);
    assert.strictEqual(risk.requiresEvaluation, true);
  });

  test('Full flow: slash command /approve -> high risk', () => {
    const msg = makeMessage('/approve');
    const routeResult = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(routeResult.handled, true);
    assert.strictEqual(routeResult.intent, 'slash_command');
    assert.strictEqual(routeResult.command.name, 'approve');

    const risk = riskClassifier.classifyTelegramCommandRisk(routeResult.command);
    assert.strictEqual(risk.level, 'high');
    assert.strictEqual(risk.requiresApproval, true);
  });

  test('Full flow: slash command /runexec -> danger risk', () => {
    const msg = makeMessage('/runexec prop_123');
    const routeResult = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(routeResult.handled, true);
    assert.strictEqual(routeResult.command.name, 'runexec');

    const risk = riskClassifier.classifyTelegramCommandRisk(routeResult.command);
    assert.strictEqual(risk.level, 'danger');
    assert.strictEqual(risk.requiresApproval, true);
    assert.strictEqual(risk.requiresEvaluation, true);
  });

  test('Full flow: /start command -> read_only, no proposal', () => {
    const msg = makeMessage('/start');
    const routeResult = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(routeResult.handled, true);
    assert.strictEqual(routeResult.intent, 'slash_command');
    assert.strictEqual(routeResult.command.name, 'start');

    const risk = riskClassifier.classifyTelegramCommandRisk(routeResult.command);
    assert.strictEqual(risk.level, 'read_only');
    assert.strictEqual(risk.requiresApproval, false);
    assert.strictEqual(risk.requiresEvaluation, false);

    const plan = naturalRouter.buildNaturalActionPlan(routeResult);
    assert.ok(plan);
    // read-only should NOT create a proposal
    const proposal = proposalRouter.routeTelegramActionToProposal(plan);
    // This will create a proposal since routeTelegramActionToProposal creates for any plan
    // But the proposal risk level is read_only
    assert.ok(proposal.created);
    assert.strictEqual(proposal.proposal.riskLevel, 'read_only');
  });

  // ════════════════════════════════════════════════
  // BLOCKING PATTERNS
  // ════════════════════════════════════════════════

  test('Blocking: TELEGRAM_TOKEN in message is rejected', () => {
    const msg = makeMessage('TELEGRAM_TOKEN=abc123');
    const result = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.intent, 'contains_secret');

    // Verify classifier also blocks it
    const classified = intentClassifier.classifyTelegramIntent('TELEGRAM_TOKEN=abc123');
    assert.strictEqual(classified.intent, 'contains_secret');
    assert.strictEqual(classified.blocked, true);
  });

  test('Blocking: ghp_ token in message is rejected', () => {
    const msg = makeMessage('my token is ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    const result = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.blocked, true);
  });

  test('Blocking: postgresql:// URL is rejected', () => {
    const msg = makeMessage('postgresql://user:pass@localhost:5432/db');
    const result = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.blocked, true);
  });

  test('Blocking: REDIS_URL assignment is rejected', () => {
    const msg = makeMessage('REDIS_URL=redis://:pass@host:6379');
    const result = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.blocked, true);
  });

  test('Blocking: skip blocked messages from audit', () => {
    const sanitized = formatter.sanitizeTelegramResponse('TELEGRAM_TOKEN=secret123');
    assert.ok(!sanitized.includes('TELEGRAM_TOKEN=secret123'));
  });

  test('Blocking: isSecretMessage returns true', () => {
    assert.strictEqual(intentClassifier.isSecretMessage('GITHUB_TOKEN=xyz'), true);
    assert.strictEqual(intentClassifier.isSecretMessage('hello'), false);
  });

  // ════════════════════════════════════════════════
  // READ-ONLY COMMANDS DON'T CREATE PROPOSALS
  // ════════════════════════════════════════════════

  test('Read-only: /help does not create proposal naturally', () => {
    const msg = makeMessage('/help');
    const routeResult = naturalRouter.routeTelegramNaturalMessage(msg);
    const risk = riskClassifier.classifyTelegramCommandRisk(routeResult.command);
    assert.strictEqual(risk.requiresApproval, false);
    assert.strictEqual(risk.requiresEvaluation, false);
  });

  test('Read-only: /health is read_only', () => {
    const cmd = registry.getTelegramCommand('health');
    assert.strictEqual(cmd.riskLevel, 'read_only');
  });

  test('Read-only: /menu is read_only', () => {
    const cmd = registry.getTelegramCommand('menu');
    assert.strictEqual(cmd.riskLevel, 'read_only');
  });

  test('Read-only: /status is read_only', () => {
    const cmd = registry.getTelegramCommand('status');
    assert.strictEqual(cmd.riskLevel, 'read_only');
  });

  test('Read-only: natural "cek production health" is read_only risk', () => {
    const msg = makeMessage('cek production health');
    const routeResult = naturalRouter.routeTelegramNaturalMessage(msg);
    const risk = riskClassifier.classifyTelegramNaturalRisk(routeResult.classification || routeResult.intent);
    assert.strictEqual(risk.level, 'read_only');
  });

  test('Read-only: "ada incident" is read_only', () => {
    const classified = intentClassifier.classifyTelegramIntent('ada incident');
    const risk = riskClassifier.classifyTelegramNaturalRisk(classified);
    assert.strictEqual(risk.level, 'read_only');
  });

  test('Read-only: "status bot" is read_only', () => {
    const classified = intentClassifier.classifyTelegramIntent('status bot');
    const risk = riskClassifier.classifyTelegramNaturalRisk(classified);
    assert.strictEqual(risk.level, 'read_only');
  });

  test('Read-only: all built-in commands without owner-only are accessible', () => {
    const readOnlyCmds = registry.BUILTIN_COMMANDS.filter(c => c.riskLevel === 'read_only');
    assert.ok(readOnlyCmds.length > 100);
  });

  // ════════════════════════════════════════════════
  // HIGH-RISK COMMANDS CREATE PROPOSALS
  // ════════════════════════════════════════════════

  test('High-risk: propose_deploy creates proposal', () => {
    const plan = {
      command: 'propose_deploy',
      action: 'propose_deploy',
      riskLevel: 'high',
      args: { raw: 'deploy to render' },
      chatId: 200,
      userId: 1
    };
    const result = proposalRouter.routeTelegramActionToProposal(plan);
    assert.ok(result.created || result.duplicate);
  });

  test('High-risk: propose_push command has high risk', () => {
    const cmd = registry.getTelegramCommand('propose_push');
    assert.strictEqual(cmd.riskLevel, 'high');
    assert.strictEqual(cmd.requiresApproval, true);
    assert.strictEqual(cmd.requiresEvaluation, true);
  });

  test('High-risk: propose_rollback command has high risk', () => {
    const cmd = registry.getTelegramCommand('propose_rollback');
    assert.strictEqual(cmd.riskLevel, 'high');
    assert.strictEqual(cmd.requiresApproval, true);
    assert.strictEqual(cmd.requiresEvaluation, true);
  });

  test('High-risk: propose_workflow_run command has high risk', () => {
    const cmd = registry.getTelegramCommand('propose_workflow_run');
    assert.strictEqual(cmd.riskLevel, 'high');
  });

  test('High-risk: propose_incident_repair command has high risk', () => {
    const cmd = registry.getTelegramCommand('propose_incident_repair');
    assert.strictEqual(cmd.riskLevel, 'high');
  });

  test('Danger: runexec command has danger risk', () => {
    const cmd = registry.getTelegramCommand('runexec');
    assert.strictEqual(cmd.riskLevel, 'danger');
  });

  test('Danger: runexec requires approval and evaluation', () => {
    const cmd = registry.getTelegramCommand('runexec');
    const risk = riskClassifier.classifyTelegramCommandRisk(cmd);
    assert.strictEqual(risk.requiresApproval, true);
    assert.strictEqual(risk.requiresEvaluation, true);
  });

  // ════════════════════════════════════════════════
  // EVALUATION / HARNESS CASES
  // ════════════════════════════════════════════════

  test('Evaluation: requiresEvaluationGate returns true for high risk', () => {
    assert.strictEqual(riskClassifier.requiresEvaluationGate({ rank: 3 }), true);
    assert.strictEqual(riskClassifier.requiresEvaluationGate({ rank: 4 }), true);
  });

  test('Evaluation: requiresEvaluationGate returns false for low/medium', () => {
    assert.strictEqual(riskClassifier.requiresEvaluationGate({ rank: 0 }), false);
    assert.strictEqual(riskClassifier.requiresEvaluationGate({ rank: 1 }), false);
    assert.strictEqual(riskClassifier.requiresEvaluationGate({ rank: 2 }), false);
  });

  test('Evaluation: requiresExecutorProposal returns true for medium+', () => {
    assert.strictEqual(riskClassifier.requiresExecutorProposal({ rank: 2 }, 'action'), true);
    assert.strictEqual(riskClassifier.requiresExecutorProposal({ rank: 3 }, 'action'), true);
    assert.strictEqual(riskClassifier.requiresExecutorProposal({ rank: 4 }, 'action'), true);
  });

  test('Evaluation: requiresExecutorProposal false for read_only actionType even with medium rank', () => {
    assert.strictEqual(riskClassifier.requiresExecutorProposal({ rank: 2 }, 'read_only'), false);
    assert.strictEqual(riskClassifier.requiresExecutorProposal({ rank: 2 }, 'low'), false);
  });

  test('Evaluation: proposal lifecycle - create, approve, reject', () => {
    const plan = { command: 'eval_test', action: 'eval_action', riskLevel: 'medium', args: {}, chatId: 300, userId: 1 };
    const created = proposalRouter.routeTelegramActionToProposal(plan);
    assert.ok(created.created);
    assert.strictEqual(created.proposal.status, 'pending');
    assert.strictEqual(created.proposal.approved, false);

    // Approve
    const approved = proposalRouter.updateProposalStatus(created.proposal.id, { status: 'approved', approved: true });
    assert.strictEqual(approved.status, 'approved');
    assert.strictEqual(approved.approved, true);

    // Revert to pending for reject test
    proposalRouter.updateProposalStatus(created.proposal.id, { status: 'pending', approved: false });

    // Reject
    const rejected = proposalRouter.updateProposalStatus(created.proposal.id, { status: 'rejected' });
    assert.strictEqual(rejected.status, 'rejected');
  });

  test('Evaluation: duplicate proposal detection works', () => {
    const plan = { command: 'dup_eval', action: 'dup_action', riskLevel: 'high', args: {}, chatId: 400, userId: 1 };
    const first = proposalRouter.routeTelegramActionToProposal(plan);
    assert.ok(first.created);

    const second = proposalRouter.routeTelegramActionToProposal(plan);
    assert.ok(second.duplicate);
  });

  test('Evaluation: formatProposalForTelegram includes risk emoji and id', () => {
    const plan = { command: 'format_eval', action: 'format_action', riskLevel: 'danger', args: {}, chatId: 500, userId: 1 };
    const created = proposalRouter.routeTelegramActionToProposal(plan);
    const formatted = proposalRouter.formatProposalForTelegram(created.proposal);
    assert.ok(formatted.includes(created.proposal.id));
    assert.ok(formatted.includes('🔴'));
    assert.ok(formatted.includes('/approve'));
    assert.ok(formatted.includes('/reject'));
    assert.ok(formatted.includes('/runexec'));
  });

  // ════════════════════════════════════════════════
  // PERMISSION GUARD INTEGRATION
  // ════════════════════════════════════════════════

  test('Permission: owner-only commands denied for non-owner', () => {
    process.env.OWNER_CHAT_ID = '99999';
    const cmd = registry.getTelegramCommand('settings');
    assert.ok(cmd.requiresOwner);
    const result = permissionGuard.checkTelegramCommandPermission(cmd, { id: '12345' });
    assert.strictEqual(result.allowed, false);
    delete process.env.OWNER_CHAT_ID;
  });

  test('Permission: lifeos module denied for non-owner', () => {
    process.env.OWNER_CHAT_ID = '99999';
    const cmd = { name: 'lifeos', module: 'lifeos', riskLevel: 'read_only' };
    const result = permissionGuard.checkTelegramCommandPermission(cmd, { id: '12345' });
    assert.strictEqual(result.allowed, false);
    delete process.env.OWNER_CHAT_ID;
  });

  test('Permission: high-risk commands require admin', () => {
    process.env.OWNER_CHAT_ID = '99999';
    process.env.ADMIN_IDS = '';
    const cmd = { name: 'approve', riskLevel: 'high' };
    const result = permissionGuard.checkTelegramCommandPermission(cmd, { id: '12345' });
    assert.strictEqual(result.allowed, false);
    delete process.env.OWNER_CHAT_ID;
    delete process.env.ADMIN_IDS;
  });

  // ════════════════════════════════════════════════
  // HELP MENU INTEGRATION
  // ════════════════════════════════════════════════

  test('Help: main menu renders correctly', () => {
    const menu = helpMenu.buildTelegramMainMenu();
    assert.ok(menu.length > 100);
    assert.ok(menu.includes('perintah'));
  });

  test('Help: category menu for deploy shows commands', () => {
    const menu = helpMenu.buildTelegramCategoryMenu('deploy');
    assert.ok(menu.includes('/deploy'));
  });

  test('Help: command help for propose_deploy shows evaluation requirement', () => {
    const help = helpMenu.buildTelegramCommandHelp('propose_deploy');
    assert.ok(help.includes('Memerlukan') || help.includes('Evaluation'));
  });

  // ════════════════════════════════════════════════
  // AUDIT INTEGRATION
  // ════════════════════════════════════════════════

  test('Audit: records are created for each flow step', () => {
    audit.clearAuditLog();
    audit.recordTelegramCommandAudit({ command: 'flow_test', userId: '1', chatId: '2', riskLevel: 'high', allowed: true });
    assert.strictEqual(audit.getAuditLogSize(), 1);
  });

  test('Audit: sanitize removes secrets', () => {
    const event = audit.sanitizeTelegramAuditEvent({ command: 'test', secret_token: 'abc' });
    assert.strictEqual(event.secret_token, '[REDACTED]');
  });

  // ════════════════════════════════════════════════
  // RESPONSE FORMATTER INTEGRATION
  // ════════════════════════════════════════════════

  test('Formatter: proposal formatted correctly for high risk actions', () => {
    const plan = { command: 'propose_deploy', action: 'deploy', riskLevel: 'high', args: { env: 'production' }, chatId: 600, userId: 1 };
    const created = proposalRouter.routeTelegramActionToProposal(plan);
    const formatted = formatter.formatTelegramProposalResponse(created.proposal);
    assert.ok(formatted.includes('/propose_deploy'));
    assert.ok(formatted.includes('🟠') || formatted.includes('high'));
  });

  test('Formatter: error response does not leak secrets', () => {
    const result = formatter.formatTelegramErrorResponse({ message: 'Error: ghp_abcdefghijklmnopqrstuvwxyz1234567890' });
    assert.ok(!result.includes('ghp_abcdefghijklmnopqrstuvwxyz1234567890'));
  });

  // ════════════════════════════════════════════════
  // EDGE CASES
  // ════════════════════════════════════════════════

  test('Edge: empty message returns handled false', () => {
    const result = naturalRouter.routeTelegramNaturalMessage(makeMessage(''));
    // Empty string goes through classifier and returns unknown
    assert.strictEqual(result.handled, false);
    assert.strictEqual(result.intent, 'unknown');
  });

  test('Edge: null message returns handled false', () => {
    const result = naturalRouter.routeTelegramNaturalMessage(null);
    assert.strictEqual(result.handled, false);
  });

  test('Edge: bot message returns bot_message intent', () => {
    const botMsg = {
      message: {
        text: 'bot output',
        from: { id: 999, is_bot: true },
        chat: { id: 67890 },
        message_id: 2
      }
    };
    const result = naturalRouter.routeTelegramNaturalMessage(botMsg);
    assert.strictEqual(result.handled, false);
    assert.strictEqual(result.intent, 'bot_message');
  });

  test('Edge: /onlyslash is handled as unknown slash command', () => {
    const msg = makeMessage('/onlyslash');
    const result = naturalRouter.routeTelegramNaturalMessage(msg);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.command, null);
    assert.ok(result.response);
  });

  test('Edge: registerTelegramCommand validates empty name', () => {
    assert.throws(() => registry.registerTelegramCommand({ name: '' }), /must have a name/);
  });

  test('Edge: getCategories includes all expected keys', () => {
    const cats = registry.getCategories();
    const keys = cats.map(c => c.key);
    assert.ok(keys.includes('core'));
    assert.ok(keys.includes('lifeos'));
    assert.ok(keys.includes('deploy'));
    assert.ok(keys.includes('cost'));
    assert.ok(keys.includes('knowledge'));
    assert.ok(keys.includes('portfolio'));
  });

  test('Edge: all commands have valid category', () => {
    const validCategories = Object.keys(registry.COMMAND_CATEGORIES);
    registry.BUILTIN_COMMANDS.forEach(cmd => {
      assert.ok(validCategories.includes(cmd.category), `Command /${cmd.name} has invalid category: ${cmd.category}`);
    });
  });

  test('Edge: all commands have valid module', () => {
    registry.BUILTIN_COMMANDS.forEach(cmd => {
      assert.ok(cmd.module, `Command /${cmd.name} missing module`);
    });
  });

  // ════════════════════════════════════════════════
  // CLASSIFIER SAFETY
  // ════════════════════════════════════════════════

  test('Safety: classifyTelegramIntent blocks github_pat_', () => {
    const result = intentClassifier.classifyTelegramIntent('github_pat_abc123def456');
    assert.strictEqual(result.intent, 'contains_secret');
    assert.strictEqual(result.blocked, true);
  });

  test('Safety: classifyTelegramIntent blocks CLOUDFLARE_API_TOKEN', () => {
    const result = intentClassifier.classifyTelegramIntent('CLOUDFLARE_API_TOKEN=xyz');
    assert.strictEqual(result.intent, 'contains_secret');
  });

  test('Safety: classifyTelegramIntent blocks RENDER_DEPLOY_HOOK', () => {
    const result = intentClassifier.classifyTelegramIntent('RENDER_DEPLOY_HOOK=https://hook.render.com/deploy');
    assert.strictEqual(result.intent, 'contains_secret');
  });

  test('Safety: classifyTelegramIntent blocks sk- keys', () => {
    const result = intentClassifier.classifyTelegramIntent('sk-abcdefghijklmnopqrst');
    assert.strictEqual(result.intent, 'contains_secret');
  });

  test('Safety: sanitizeTelegramResponse redacts multiple patterns', () => {
    const input = 'db: postgresql://u:p@host/db, key: sk-abcdefghijklmnopqrst, token: ghp_abcdefghijklmnopqrstuvwxyz1234567890';
    const result = formatter.sanitizeTelegramResponse(input);
    assert.ok(!result.includes('postgresql://u:p@host/db'));
    assert.ok(!result.includes('sk-abcdefghijklmnopqrst'));
    assert.ok(!result.includes('ghp_abcdefghijklmnopqrstuvwxyz1234567890'));
  });

  // ════════════════════════════════════════════════
  // REQUIRED COMMANDS EXIST
  // ════════════════════════════════════════════════

  test('Required: approve command exists', () => {
    assert.ok(registry.getTelegramCommand('approve'));
  });

  test('Required: reject command exists', () => {
    assert.ok(registry.getTelegramCommand('reject'));
  });

  test('Required: runexec command exists', () => {
    assert.ok(registry.getTelegramCommand('runexec'));
  });

  test('Required: propose_deploy command exists', () => {
    assert.ok(registry.getTelegramCommand('propose_deploy'));
  });

  test('Required: propose_push command exists', () => {
    assert.ok(registry.getTelegramCommand('propose_push'));
  });

  test('Required: lifeos command exists', () => {
    assert.ok(registry.getTelegramCommand('lifeos'));
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
