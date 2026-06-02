'use strict';

const assert = require('assert');
const assignment = require('../src/agents/agent-assignment');
const agents = require('../src/agents');

const svc = {};
const all = agents.agentRegistry.listAgents({}, svc);

assert.strictEqual(assignment.assignTaskToAgent({ type: 'coding_review', title: 'review code' }, all, {}, svc).assignedAgentId, 'coder');
assert.strictEqual(assignment.assignTaskToAgent({ type: 'planning', title: 'roadmap' }, all, {}, svc).assignedAgentId, 'planner');
assert.ok(['security', 'critic'].includes(assignment.assignTaskToAgent({ type: 'risk_review', title: 'restore backup' }, all, {}, svc).assignedAgentId));
assert.strictEqual(assignment.assignTaskToAgent({ type: 'ops_check', title: 'Render deploy error' }, all, {}, svc).assignedAgentId, 'ops');
assert.strictEqual(assignment.assignTaskToAgent({ type: 'memory_review', title: 'memory context' }, all, {}, svc).assignedAgentId, 'memory');

const disabled = all.map(agent => agent.id === 'coder' ? { ...agent, enabled: false } : agent);
assert.notStrictEqual(assignment.assignTaskToAgent({ type: 'coding_review', title: 'review code' }, disabled, {}, svc).assignedAgentId, 'coder');
assert.ok(/cocok|Fallback/i.test(assignment.explainAssignment({ type: 'planning' }, { id: 'planner', displayName: 'Planner Agent' })));

console.log('test-agent-assignment: ok');
