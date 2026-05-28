'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const aiOS = require('../src/ai-os');
const collaboration = require('../src/collaboration');
const { createStorageManager } = require('../src/storage');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-foundation-'));
  const storageManager = createStorageManager({
    env: { DATABASE_URL: '', REDIS_URL: '', STORAGE_DRIVER: 'auto' },
    jsonBaseDir: dir
  });
  await storageManager.initStorage();

  const users = {};
  const services = {
    storageManager,
    ensureUser(userId) {
      const id = String(userId);
      if (!users[id]) users[id] = { mode: 'auto' };
      return users[id];
    },
    persist() {}
  };

  const userId = 'test-user';
  const memory = await aiOS.unifiedMemory.createMemory(userId, {
    content: 'Saya sedang membangun AI bot Telegram dengan Node.js',
    type: 'semantic',
    source: 'test'
  }, services);
  assert.equal(memory.ok, true);
  assert.equal((await aiOS.unifiedMemory.listMemories(userId, { limit: 10 }, services)).length, 1);

  const goal = aiOS.goalManager.createGoal(userId, {
    title: 'Bangun AI bot production',
    description: 'Membuat bot AI stabil',
    priority: 'high'
  }, services);
  assert.equal(goal.ok, true);
  assert.equal(aiOS.goalManager.listGoals(userId, { status: 'active' }, services).length, 1);

  const workflow = aiOS.workflowEngine.createWorkflow(userId, {
    title: 'Migrasi storage',
    description: 'Pindahkan data ke PostgreSQL',
    goalId: goal.goal.id
  }, services);
  assert.equal(workflow.ok, true);
  const step = aiOS.workflowEngine.addStep(userId, workflow.workflow.id, 'Buat schema memory', services);
  assert.equal(step.ok, true);
  const done = aiOS.workflowEngine.markStepDone(userId, workflow.workflow.id, 1, services);
  assert.equal(done.ok, true);

  const insight = await aiOS.insightStore.createInsight(userId, {
    content: 'Storage harus punya fallback aman',
    source: 'test'
  }, services);
  assert.equal(insight.ok, true);

  const graph = aiOS.knowledgeGraph.evolveGraphFromText(userId, 'AI bot Telegram membutuhkan memory, workflow, dan storage fallback', services, {
    source: 'test',
    maxConcepts: 5
  });
  assert.equal(graph.ok, true);

  const collabResponse = await collaboration.respond('/think', 'Bagaimana membuat bot lebih stabil?', userId, users[userId], services);
  assert.match(collabResponse, /Ringkasan masalah:/);

  await new Promise(resolve => setTimeout(resolve, 50));
  const storedGoals = await storageManager.loadData('aios_goals', {});
  assert.equal(storedGoals[userId].length, 1);
  const storedGraph = await storageManager.loadData('aios_graph', {});
  assert.ok(storedGraph[userId].nodes.length > 0);
  const storedCollab = await storageManager.loadData('collaboration_state', {});
  assert.ok(storedCollab[userId].analytics.sessions >= 1);
  const context = await aiOS.contextSync.buildAIOSContext(userId, 'langkah berikutnya bot', services);
  assert.equal(context.activeGoals.length, 1);
  assert.equal(context.activeWorkflows.length, 1);
  assert.ok(context.graph.nodes.length > 0);

  await storageManager.closeStorage();
  console.log('aios foundation checks passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
