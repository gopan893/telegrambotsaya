'use strict';

const assert = require('assert');
const aiOS = require('../src/ai-os');

const userMemory = {};
const services = {
  ensureUser(userId) {
    const id = String(userId);
    if (!userMemory[id]) userMemory[id] = { mode: 'strategic-thinking' };
    return userMemory[id];
  },
  persist() {
    return Promise.resolve();
  }
};

const userId = 'test-user';

const goal = aiOS.goalManager.createGoal(userId, {
  title: 'Belajar backend 30 hari',
  description: 'Membangun dasar Node.js, database, API, dan deploy.',
  priority: 'high'
}, services);
assert.equal(goal.ok, true);

const workflow = aiOS.workflowEngine.createWorkflow(userId, {
  title: 'Roadmap backend minggu pertama',
  description: 'Setup dasar JavaScript backend.',
  goalId: goal.goal.id
}, services);
assert.equal(workflow.ok, true);

const step = aiOS.workflowEngine.addStep(userId, workflow.workflow.id, 'Pelajari Express middleware', services);
assert.equal(step.ok, true);

const prepared = aiOS.processInput('trace-test', {
  userId,
  userMessage: 'Bantu saya buat strategi belajar backend selama 30 hari',
  userMode: 'strategic-thinking'
}, services);
assert.equal(prepared.ok, true);
assert.ok(prepared.promptContext.includes('Goals aktif'));

const graph = aiOS.knowledgeGraph.evolveGraphFromText(userId, 'Backend depends on HTTP, database, API design, testing, and deployment.', services);
assert.equal(graph.ok, true);
assert.ok(graph.nodes.length > 0);

const strategy = aiOS.strategicReasoning.analyzeGoal('Saya ingin belajar backend selama 30 hari', prepared.cognitiveContext);
assert.ok(strategy.confidence > 0);
assert.ok(strategy.nextActions.length > 0);

const after = aiOS.afterResponse('trace-test', {
  userId,
  userMessage: 'Bantu saya buat strategi belajar backend selama 30 hari',
  userMode: 'strategic-thinking',
  strategy: prepared.strategy
}, 'Mulai dari HTTP, Express, database, testing, lalu deploy.', services);
assert.equal(after.ok, true);

const status = aiOS.getStatus(userId, services);
assert.ok(status.totalMemory > 0);
assert.ok(status.activeGoals >= 1);
assert.ok(status.activeWorkflows >= 1);

console.log('AI OS smoke test passed');
