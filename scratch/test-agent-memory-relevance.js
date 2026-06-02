'use strict';

const assert = require('assert');
const relevance = require('../src/agents/agent-memory-relevance');

const memories = [
  {
    id: 'm1',
    agentId: 'coder',
    workspaceId: 'ws1',
    userId: 'u1',
    type: 'technical_pattern',
    title: 'CommonJS Render',
    content: 'Gunakan Node.js 20 CommonJS dan Render-compatible deployment.',
    tags: ['nodejs', 'render'],
    confidence: 0.9,
    importance: 0.9
  },
  {
    id: 'm2',
    agentId: 'coder',
    workspaceId: 'ws2',
    userId: 'u1',
    type: 'technical_pattern',
    title: 'Workspace lain',
    content: 'Jangan bocor ke workspace berbeda.',
    confidence: 1,
    importance: 1
  },
  {
    id: 'm3',
    agentId: 'coder',
    workspaceId: 'ws1',
    userId: 'u1',
    type: 'technical_pattern',
    title: 'Secret',
    content: 'api_key=secret-value',
    confidence: 1,
    importance: 1
  }
];

const selected = relevance.filterRelevantMemories(memories, 'Bot error deploy di Render dengan Node.js', { id: 'coder' }, {
  workspaceId: 'ws1',
  userId: 'u1',
  topics: ['coding', 'deploy']
});

assert.ok(selected.some(item => item.id === 'm1'));
assert.ok(!selected.some(item => item.id === 'm2'));
assert.ok(!selected.some(item => item.id === 'm3'));

const emotional = relevance.filterRelevantMemories(memories, 'Saya capek hari ini', { id: 'coder' }, {
  workspaceId: 'ws1',
  userId: 'u1',
  topics: ['emotional']
});
assert.ok(!emotional.some(item => item.id === 'm1'));

console.log('test-agent-memory-relevance: ok');
