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
  const insights = memoryBus.getRecentInsights(userId, botServices, 5);
  const avgConfidence = averageConfidence(state);

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
    staleItems: staleGoals.length,
    reflectionCount: state.reflections.length,
    averageConfidence: avgConfidence,
    recentInsights: insights,
    researchSessions: state.researchSessions.length,
    workspaces: state.workspaces.length,
    learningPatterns: state.learningPatterns.length,
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
    `Stale item: ${analytics.staleItems}`
  ].join('\n');
}

module.exports = {
  collect,
  averageConfidence,
  summarizeAnalytics
};
