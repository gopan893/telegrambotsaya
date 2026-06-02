'use strict';

const assert = require('assert');
const agentRouter = require('../src/agents/agent-router');
const councilEngine = require('../src/agents/council-engine');

(() => {
  const services = { __agentMemory: {} };

  const casualRoute = agentRouter.routeMessage('Halo', {
    groupSettings: { mode: 'natural_smart', maxAutoAgents: 3 }
  }, services);
  assert.strictEqual(councilEngine.shouldTriggerCouncil('Halo', { source: 'natural_chat' }, casualRoute, services).needed, false);

  const mathRoute = agentRouter.routeMessage('25*4', {
    groupSettings: { mode: 'natural_smart', maxAutoAgents: 3 }
  }, services);
  assert.strictEqual(councilEngine.shouldTriggerCouncil('25*4', { source: 'natural_chat' }, mathRoute, services).needed, false);

  const phaseRoute = agentRouter.routeMessage('saya bingung lanjut phase berapa', {
    groupSettings: { mode: 'natural_smart', maxAutoAgents: 3 }
  }, services);
  const phaseNeed = councilEngine.shouldTriggerCouncil('saya bingung lanjut phase berapa', { source: 'natural_chat' }, phaseRoute, services);
  assert.strictEqual(phaseNeed.needed, true);
  assert.ok(['planning_review', 'decision_review', 'quick_council'].includes(phaseNeed.mode));

  const restoreRoute = agentRouter.routeMessage('Saya ingin restore backup ini sekarang', {
    groupSettings: { mode: 'natural_smart', maxAutoAgents: 3 }
  }, services);
  const restoreNeed = councilEngine.shouldTriggerCouncil('Saya ingin restore backup ini sekarang', { source: 'natural_chat' }, restoreRoute, services);
  assert.strictEqual(restoreNeed.needed, true);
  assert.strictEqual(restoreNeed.mode, 'risk_review');

  console.log('test-council-natural-routing: ok');
})();
