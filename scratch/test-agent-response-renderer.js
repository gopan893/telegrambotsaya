'use strict';

const assert = require('assert');
const renderer = require('../src/agents/agent-response-renderer');

const route = {
  topics: ['planning', 'roadmap'],
  risk: { level: 'low' },
  selectedAgents: ['orchestrator', 'planner', 'critic'],
  internalOnlyAgents: [],
  mutedAgents: ['coder'],
  approvalRequired: false,
  policy: { mode: 'natural_smart' }
};

const drafts = [
  { agentId: 'orchestrator', text: 'Saya bertindak sebagai Orchestrator Agent. Saya pilih mode natural_smart untuk topik planning.' },
  { agentId: 'planner', text: 'Saya bertindak sebagai Planner Agent. Fokus saya: buat phase berikutnya.' },
  { agentId: 'critic', text: 'Saya bertindak sebagai Critic Agent. Risiko utama: scope melebar.' }
];

const normal = renderer.renderNaturalSmartReply({
  text: 'saya bingung lanjut phase berapa'
}, route, drafts, {
  text: 'saya bingung lanjut phase berapa',
  route,
  topics: route.topics
});

assert.ok(/Phase 22/i.test(normal));
assert.ok(!/Smart Agent Router/i.test(normal));
assert.ok(!/Mode:/i.test(normal));
assert.ok(!/^Agent:/im.test(normal));
assert.ok(!/Saya bertindak sebagai/i.test(normal));

const danger = renderer.renderNaturalSmartReply({
  text: 'Saya ingin restore backup'
}, {
  topics: ['restore', 'executor', 'security'],
  risk: { level: 'danger' },
  selectedAgents: ['orchestrator', 'security', 'executor'],
  approvalRequired: true,
  policy: { mode: 'natural_smart' }
}, drafts, {
  text: 'Saya ingin restore backup',
  topics: ['restore', 'executor', 'security']
});
assert.ok(/approval|approve|proposal/i.test(danger));
assert.ok(!/Smart Agent Router/i.test(danger));

const debug = renderer.renderDebugRouterReply(route);
assert.ok(/Smart Agent Router/i.test(debug));
assert.ok(/Mode:/i.test(debug));
assert.ok(/Agent:/i.test(debug));

const council = renderer.renderCouncilReply(drafts, { route: { selectedAgents: ['orchestrator', 'planner', 'critic'] } });
assert.ok(/Planner:/i.test(council));
assert.ok(/Critic:/i.test(council));

const emotional = renderer.renderNaturalSmartReply({
  text: 'Saya capek hari ini'
}, {
  topics: ['emotional'],
  selectedAgents: ['orchestrator', 'reflection'],
  risk: { level: 'low' },
  policy: { mode: 'natural_smart' }
}, drafts, {
  text: 'Saya capek hari ini',
  topics: ['emotional']
});
assert.ok(/lelah|langkah kecil|mengganggu/i.test(emotional));
assert.ok(!/PostgreSQL|Redis|Render/i.test(emotional));

console.log('test-agent-response-renderer: ok');
