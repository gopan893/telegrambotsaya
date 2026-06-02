'use strict';

const assert = require('assert');
const councilEngine = require('../src/agents/council-engine');
const agentRouter = require('../src/agents/agent-router');

function createServices() {
  const audit = [];
  return {
    __agentMemory: {},
    workspaceId: 'default',
    actorId: 'tester',
    auditLog: {
      async recordAuditLog(entry) {
        audit.push(entry);
        return entry;
      }
    },
    get audit() {
      return audit;
    }
  };
}

(async () => {
  const services = createServices();

  const simple = councilEngine.shouldTriggerCouncil('Halo', { source: 'natural_chat' }, {}, services);
  assert.strictEqual(simple.needed, false, 'greeting must not trigger council');

  const route = agentRouter.routeMessage('saya bingung lanjut phase berapa', {
    userId: 'u1',
    groupSettings: { mode: 'natural_smart', maxAutoAgents: 3 }
  }, services);
  const need = councilEngine.shouldTriggerCouncil('saya bingung lanjut phase berapa', {
    source: 'natural_chat',
    userId: 'u1',
    workspaceId: 'default'
  }, route, services);
  assert.strictEqual(need.needed, true, 'roadmap/phase message should trigger council');

  const result = await councilEngine.runCouncil({
    workspaceId: 'default',
    userId: 'u1',
    source: 'natural_chat',
    topic: 'saya bingung lanjut phase berapa',
    originalMessage: 'saya bingung lanjut phase berapa',
    routerPolicy: route,
    skipDuplicateCheck: true
  }, services);
  assert.strictEqual(result.handled, true);
  assert.ok(result.session.id, 'session id required');
  assert.ok(result.finalAnswer.includes('Phase 22'), 'phase recommendation expected');
  assert.ok(!/Smart Agent Router|Mode:|Agent:/i.test(result.finalAnswer), 'natural final answer must hide diagnostics');

  const restore = await councilEngine.runCouncil({
    workspaceId: 'default',
    userId: 'u1',
    source: 'telegram_command',
    mode: 'risk_review',
    topic: 'Saya ingin restore backup production',
    originalMessage: 'Saya ingin restore backup production',
    riskLevel: 'high',
    approvalRequired: true
  }, services);
  assert.strictEqual(restore.riskReview.approvalRequired, true, 'restore/import requires approval');
  assert.ok(/approval/i.test(restore.finalAnswer), 'restore answer should mention approval');

  await assert.rejects(
    () => councilEngine.runCouncil({
      workspaceId: 'default',
      userId: 'u1',
      source: 'dashboard',
      topic: 'api_key=sk-testsecret123456789',
      originalMessage: 'api_key=sk-testsecret123456789'
    }, services),
    /COUNCIL_SECRET_LIKE_CONTENT_REJECTED/
  );

  const sessions = await councilEngine.listSessions({ limit: 10 }, services);
  assert.ok(sessions.length >= 2, 'sessions should be stored');
  assert.ok(services.audit.some(item => item.action === 'agents/council_session_completed'), 'completion must be audited');

  console.log('test-council-engine: ok');
})();
