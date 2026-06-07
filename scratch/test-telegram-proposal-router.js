'use strict';

const assert = require('assert');
const proposalRouter = require('../src/telegram-control/telegram-proposal-router');

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

function makeActionPlan(overrides) {
  return {
    command: 'testcmd',
    action: 'test_action',
    intent: 'test_intent',
    riskLevel: 'low',
    args: { raw: '/testcmd', matched: '/testcmd' },
    chatId: 67890,
    userId: 12345,
    ...overrides
  };
}

function run() {
  console.log('=== test-telegram-proposal-router.js ===\n');

  // ── routeTelegramActionToProposal ──

  test('routeTelegramActionToProposal returns error for null', () => {
    const result = proposalRouter.routeTelegramActionToProposal(null);
    assert.ok(result.error);
    assert.strictEqual(result.error, 'No action plan provided');
  });

  test('routeTelegramActionToProposal returns error for missing command', () => {
    const result = proposalRouter.routeTelegramActionToProposal({});
    assert.ok(result.error);
  });

  test('routeTelegramActionToProposal creates proposal', () => {
    const result = proposalRouter.routeTelegramActionToProposal(makeActionPlan());
    assert.ok(result.created);
    assert.ok(result.proposal);
    assert.strictEqual(result.proposal.command, 'testcmd');
    assert.strictEqual(result.proposal.status, 'pending');
  });

  test('routeTelegramActionToProposal detects duplicate', () => {
    const plan = makeActionPlan({ command: 'dupcmd', action: 'dup_action', chatId: 999 });
    const first = proposalRouter.routeTelegramActionToProposal(plan);
    assert.ok(first.created);

    const second = proposalRouter.routeTelegramActionToProposal(plan);
    assert.ok(second.duplicate);
    assert.ok(second.proposal);
    assert.strictEqual(second.proposal.command, 'dupcmd');
  });

  test('routeTelegramActionToProposal duplicate different chatId is not duplicate', () => {
    const plan1 = makeActionPlan({ command: 'chatdiff', action: 'act', chatId: 111 });
    const plan2 = makeActionPlan({ command: 'chatdiff', action: 'act', chatId: 222 });
    const r1 = proposalRouter.routeTelegramActionToProposal(plan1);
    assert.ok(r1.created);
    const r2 = proposalRouter.routeTelegramActionToProposal(plan2);
    assert.ok(r2.created);
  });

  // ── createTelegramExecutorProposal ──

  test('createTelegramExecutorProposal creates proposal with correct fields', () => {
    const plan = makeActionPlan({ command: 'deploy', riskLevel: 'high' });
    const result = proposalRouter.createTelegramExecutorProposal(plan);
    assert.ok(result.created);
    assert.ok(result.proposal.id);
    assert.ok(result.proposal.id.startsWith('prop'));
    assert.strictEqual(result.proposal.type, 'telegram_control');
    assert.strictEqual(result.proposal.command, 'deploy');
    assert.strictEqual(result.proposal.riskLevel, 'high');
    assert.strictEqual(result.proposal.source, 'telegram');
    assert.strictEqual(result.proposal.status, 'pending');
    assert.strictEqual(result.proposal.approved, false);
    assert.strictEqual(result.proposal.executed, false);
  });

  test('createTelegramExecutorProposal includes chatId and userId', () => {
    const plan = makeActionPlan({ chatId: 111, userId: 222 });
    const result = proposalRouter.createTelegramExecutorProposal(plan);
    assert.strictEqual(result.proposal.chatId, 111);
    assert.strictEqual(result.proposal.userId, 222);
  });

  test('createTelegramExecutorProposal includes intent and args', () => {
    const plan = makeActionPlan({ intent: 'my_intent', args: { foo: 'bar' } });
    const result = proposalRouter.createTelegramExecutorProposal(plan);
    assert.strictEqual(result.proposal.intent, 'my_intent');
    assert.deepStrictEqual(result.proposal.args, { foo: 'bar' });
  });

  // ── linkTelegramMessageToProposal ──

  test('linkTelegramMessageToProposal returns false for null messageId', () => {
    assert.strictEqual(proposalRouter.linkTelegramMessageToProposal(null, 'prop_1'), false);
  });

  test('linkTelegramMessageToProposal returns false for null proposalId', () => {
    assert.strictEqual(proposalRouter.linkTelegramMessageToProposal(1, null), false);
  });

  test('linkTelegramMessageToProposal returns true on success', () => {
    assert.strictEqual(proposalRouter.linkTelegramMessageToProposal(42, 'prop_abc'), true);
  });

  // ── formatProposalForTelegram ──

  test('formatProposalForTelegram returns default for null', () => {
    assert.strictEqual(proposalRouter.formatProposalForTelegram(null), 'No proposal data.');
  });

  test('formatProposalForTelegram formats proposal', () => {
    const plan = makeActionPlan({ command: 'testcmd', riskLevel: 'read_only' });
    const created = proposalRouter.createTelegramExecutorProposal(plan);
    const result = proposalRouter.formatProposalForTelegram(created.proposal);
    assert.ok(result.includes(created.proposal.id));
    assert.ok(result.includes('/testcmd'));
    assert.ok(result.includes('read_only'));
    assert.ok(result.includes('/approve'));
    assert.ok(result.includes('/reject'));
    assert.ok(result.includes('/runexec'));
  });

  test('formatProposalForTelegram includes args', () => {
    const plan = makeActionPlan({ args: { key: 'value', raw: '/cmd' } });
    const created = proposalRouter.createTelegramExecutorProposal(plan);
    const result = proposalRouter.formatProposalForTelegram(created.proposal);
    assert.ok(result.includes('key'));
    assert.ok(result.includes('value'));
  });

  test('formatProposalForTelegram with risk emoji', () => {
    const plan = makeActionPlan({ riskLevel: 'danger' });
    const created = proposalRouter.createTelegramExecutorProposal(plan);
    const result = proposalRouter.formatProposalForTelegram(created.proposal);
    assert.ok(result.includes('🔴'));
  });

  // ── getPendingProposalForTelegramContext ──

  test('getPendingProposalForTelegramContext returns null for null context', () => {
    assert.strictEqual(proposalRouter.getPendingProposalForTelegramContext(null), null);
  });

  test('getPendingProposalForTelegramContext returns pending proposal by chatId', () => {
    const plan = makeActionPlan({ command: 'ctx_check', chatId: 777, userId: 111 });
    const created = proposalRouter.routeTelegramActionToProposal(plan);
    assert.ok(created.created);

    const found = proposalRouter.getPendingProposalForTelegramContext({ chatId: 777 });
    assert.ok(found);
    assert.strictEqual(found.command, 'ctx_check');
  });

  test('getPendingProposalForTelegramContext returns pending proposal by userId', () => {
    const found = proposalRouter.getPendingProposalForTelegramContext({ userId: 111 });
    assert.ok(found);
  });

  test('getPendingProposalForTelegramContext prefers chatId', () => {
    const found = proposalRouter.getPendingProposalForTelegramContext({ chatId: 777, userId: 111 });
    assert.ok(found);
  });

  // ── findDuplicateProposal ──

  test('findDuplicateProposal returns null for non-duplicate', () => {
    const plan = makeActionPlan({ command: 'unique_cmd_' + Date.now(), chatId: 99999 });
    const result = proposalRouter.findDuplicateProposal(plan);
    assert.strictEqual(result, null);
  });

  test('findDuplicateProposal finds duplicate by command, action, chatId', () => {
    const plan = makeActionPlan({ command: 'find_dup', action: 'act', chatId: 555 });
    proposalRouter.routeTelegramActionToProposal(plan);
    const dup = proposalRouter.findDuplicateProposal(plan);
    assert.ok(dup);
    assert.strictEqual(dup.command, 'find_dup');
  });

  // ── getProposalById ──

  test('getProposalById returns null for unknown', () => {
    assert.strictEqual(proposalRouter.getProposalById('nonexistent_id'), null);
  });

  test('getProposalById returns proposal', () => {
    const plan = makeActionPlan({ command: 'get_by_id_cmd' });
    const created = proposalRouter.routeTelegramActionToProposal(plan);
    const found = proposalRouter.getProposalById(created.proposal.id);
    assert.ok(found);
    assert.strictEqual(found.id, created.proposal.id);
  });

  // ── updateProposalStatus ──

  test('updateProposalStatus returns null for unknown', () => {
    assert.strictEqual(proposalRouter.updateProposalStatus('nonexistent', { status: 'approved' }), null);
  });

  test('updateProposalStatus updates proposal', () => {
    const plan = makeActionPlan({ command: 'update_cmd' });
    const created = proposalRouter.routeTelegramActionToProposal(plan);
    const updated = proposalRouter.updateProposalStatus(created.proposal.id, { status: 'approved', approved: true });
    assert.ok(updated);
    assert.strictEqual(updated.status, 'approved');
    assert.strictEqual(updated.approved, true);
    assert.ok(updated.updatedAt);
  });

  test('updateProposalStatus preserves other fields', () => {
    const plan = makeActionPlan({ command: 'preserve_cmd' });
    const created = proposalRouter.routeTelegramActionToProposal(plan);
    proposalRouter.updateProposalStatus(created.proposal.id, { status: 'rejected' });
    const found = proposalRouter.getProposalById(created.proposal.id);
    assert.strictEqual(found.status, 'rejected');
    assert.strictEqual(found.command, 'preserve_cmd');
  });

  // ── listPendingProposals ──

  test('listPendingProposals returns only pending', () => {
    const pending = proposalRouter.listPendingProposals();
    assert.ok(Array.isArray(pending));
    pending.forEach(p => assert.strictEqual(p.status, 'pending'));
  });

  test('listPendingProposals does not include approved/rejected', () => {
    const pendingBefore = proposalRouter.listPendingProposals().length;

    const plan = makeActionPlan({ command: 'lp_test' });
    const created = proposalRouter.routeTelegramActionToProposal(plan);
    proposalRouter.updateProposalStatus(created.proposal.id, { status: 'approved' });

    const pendingAfter = proposalRouter.listPendingProposals().length;
    assert.strictEqual(pendingAfter, pendingBefore);
  });

  // ── getProposalByMessageId ──

  test('getProposalByMessageId returns null for unlinked message', () => {
    assert.strictEqual(proposalRouter.getProposalByMessageId(99999), null);
  });

  test('getProposalByMessageId returns linked proposal', () => {
    const plan = makeActionPlan({ command: 'msg_link' });
    const created = proposalRouter.routeTelegramActionToProposal(plan);
    proposalRouter.linkTelegramMessageToProposal(100, created.proposal.id);
    const found = proposalRouter.getProposalByMessageId(100);
    assert.ok(found);
    assert.strictEqual(found.id, created.proposal.id);
  });

  // ── listAllProposals ──

  test('listAllProposals returns array', () => {
    const all = proposalRouter.listAllProposals();
    assert.ok(Array.isArray(all));
    assert.ok(all.length > 0);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
