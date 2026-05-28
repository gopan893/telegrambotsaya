'use strict';

const guards = require('./guards');
const unifiedMemory = require('./unified-memory');
const goalManager = require('./goal-manager');
const workflowEngine = require('./workflow-engine');
const knowledgeGraph = require('./knowledge-graph');
const memoryBus = require('./memory-bus');

function collect(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const memoryStats = unifiedMemory.getMemoryStats(userId, botServices);
  const activeGoals = goalManager.getActiveGoals(userId, botServices, 100);
  const activeWorkflows = workflowEngine.listActiveWorkflows(userId, botServices, 100);
  const graphStats = knowledgeGraph.getGraphStats(userId, botServices);
  const staleGoals = goalManager.detectStaleGoals(userId, botServices);
  const staleWorkflows = workflowEngine.detectStaleWorkflows(userId, botServices);
  const workflowConflicts = workflowEngine.detectWorkflowConflicts(userId, botServices);
  const insights = memoryBus.getRecentInsights(userId, botServices, 5);
  const avgConfidence = averageConfidence(state);
  const workflowCompletionRatio = computeWorkflowCompletionRatio(state.workflows);
  const researchMemoryCount = state.memories.filter((memory) => memory.type === 'research').length;

  state.analytics.events = Number(state.analytics.events || 0) + 1;
  state.analytics.averageConfidence = avgConfidence;
  state.analytics.lastUpdatedAt = guards.nowIso();

  return {
    totalMemory: memoryStats.total,
    memoryByType: memoryStats.byType,
    activeGoals: activeGoals.length,
    activeWorkflows: activeWorkflows.length,
    graphNodes: graphStats.nodes,
    graphEdges: graphStats.edges,
    staleItems: staleGoals.length + staleWorkflows.length,
    staleGoals: staleGoals.length,
    staleWorkflows: staleWorkflows.length,
    workflowConflicts: workflowConflicts.length,
    reflectionCount: state.reflections.length,
    averageConfidence: avgConfidence,
    recentInsights: insights,
    researchSessions: state.researchSessions.length,
    researchMemoryCount,
    workspaces: state.workspaces.length,
    learningPatterns: state.learningPatterns.length,
    workflowCompletionRatio,
    updatedAt: guards.nowIso()
  };
}

function averageConfidence(state) {
  const values = [];
  for (const memory of state.memories) values.push(memory.confidence || 0.5);
  for (const node of state.graph.nodes) values.push(node.confidence || 0.5);
  for (const edge of state.graph.edges) values.push(edge.confidence || 0.5);
  for (const insight of state.insights) values.push(insight.confidence || 0.5);
  if (!values.length) return 0.5;
  return Number((values.reduce((sum, value) => sum + guards.clamp01(value, 0.5), 0) / values.length).toFixed(3));
}

function summarizeAnalytics(analytics) {
  return [
    `Memory: ${analytics.totalMemory}`,
    `Goals aktif: ${analytics.activeGoals}`,
    `Workflow aktif: ${analytics.activeWorkflows}`,
    `Graph: ${analytics.graphNodes} node, ${analytics.graphEdges} edge`,
    `Insight terbaru: ${analytics.recentInsights.length}`,
    `Average confidence: ${analytics.averageConfidence.toFixed(2)}`,
    `Stale goals/workflows: ${analytics.staleGoals}/${analytics.staleWorkflows}`,
    `Workflow completion: ${Math.round((analytics.workflowCompletionRatio || 0) * 100)}%`,
    `Workflow conflicts: ${analytics.workflowConflicts}`
  ].join('\n');
}

function computeWorkflowCompletionRatio(workflows = []) {
  const active = guards.safeArray(workflows).filter((workflow) => workflow.status !== 'archived');
  let done = 0;
  let total = 0;
  for (const workflow of active) {
    const steps = guards.safeArray(workflow.steps);
    done += steps.filter((step) => step.done).length;
    total += steps.length;
  }
  if (!total) return 0;
  return Number((done / total).toFixed(3));
}

module.exports = {
  collect,
  averageConfidence,
  computeWorkflowCompletionRatio,
  summarizeAnalytics
};
