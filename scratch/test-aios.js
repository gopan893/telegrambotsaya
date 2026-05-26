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
assert.ok(workflow.workflow.nextAction);

const step = aiOS.workflowEngine.addStep(userId, workflow.workflow.id, 'Pelajari Express middleware', services);
assert.equal(step.ok, true);
const decision = aiOS.workflowEngine.addDecision(userId, workflow.workflow.id, 'Mulai dari Express sebelum database', services);
assert.equal(decision.ok, true);
const blocker = aiOS.workflowEngine.addBlocker(userId, workflow.workflow.id, 'Belum memilih database latihan', services);
assert.equal(blocker.ok, true);

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
const graphSummary = aiOS.knowledgeGraph.summarizeGraph(userId, services, 'backend database');
assert.ok(graphSummary.typeSummary);

const strategy = aiOS.strategicReasoning.analyzeGoal('Saya ingin belajar backend selama 30 hari', prepared.cognitiveContext);
assert.ok(strategy.confidence > 0);
assert.ok(strategy.nextActions.length > 0);
assert.ok(strategy.recommendation);
assert.ok(strategy.evidenceQuality);

const research = aiOS.researchIntelligence.createResearchSession(userId, 'Backend learning evidence', services, {
  linkedGoalIds: [goal.goal.id],
  linkedWorkflowIds: [workflow.workflow.id]
});
assert.equal(research.ok, true);
const evidence = aiOS.researchIntelligence.addEvidence(userId, research.session.id, {
  title: 'Express docs',
  url: 'https://expressjs.com/',
  text: 'Express is a minimal and flexible Node.js web application framework.',
  confidence: 0.8
}, services);
assert.equal(evidence.ok, true);

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
assert.ok(status.graphNodes > 0);
assert.ok(status.workflowConflicts >= 0);

console.log('AI OS smoke test passed');
