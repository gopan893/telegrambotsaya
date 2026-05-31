'use strict';

const guards = require('./guards');
const unifiedMemory = require('./unified-memory');
const goalManager = require('./goal-manager');
const workflowEngine = require('./workflow-engine');
const knowledgeGraph = require('./knowledge-graph');
const memoryBus = require('./memory-bus');
const insightStore = require('./insight-store');
const utils = require('./aios-utils');
const contextRelevanceGate = require('./context-relevance-gate');

function syncContext(userId, query = '', botServices, options = {}) {
  const state = guards.ensureAIOSState(userId, botServices);
  const maxChars = Number(options.maxChars || guards.DEFAULT_LIMITS.contextChars);
  let activeGoals = goalManager.getActiveGoals(userId, botServices, 5);
  let activeWorkflows = workflowEngine.listActiveWorkflows(userId, botServices, 5);
  let memories = options.skipMemory
    ? []
    : unifiedMemory.searchMemory(userId, query, { limit: options.memoryLimit || 8 }, botServices);
  const graph = options.skipGraph
    ? { nodes: [], edges: [] }
    : knowledgeGraph.searchGraph(userId, query, botServices, 6);
  let insights = memoryBus.getRecentInsights(userId, botServices, 5);

  try {
    memories = contextRelevanceGate.filterRelevantContext(query, memories);
    activeGoals = contextRelevanceGate.filterRelevantContext(query, activeGoals);
    activeWorkflows = contextRelevanceGate.filterRelevantContext(query, activeWorkflows);
    insights = contextRelevanceGate.filterRelevantContext(query, insights);
  } catch (_) {}

  const fragments = [
    formatGoals(activeGoals),
    formatWorkflows(activeWorkflows),
    unifiedMemory.compressMemory(memories, Math.floor(maxChars * 0.42)),
    formatGraph(graph, state),
    formatInsights(insights)
  ].filter(Boolean);

  const compressed = compressContextSummary(fragments, maxChars);
  return {
    userId: guards.normalizeUserId(userId),
    activeGoals,
    activeWorkflows,
    memories,
    graph,
    insights,
    memorySummary: unifiedMemory.compressMemory(memories, Math.floor(maxChars * 0.38)),
    graphSummary: formatGraph(graph, state),
    insightSummary: formatInsights(insights),
    compressedContext: compressed,
    stats: {
      memoryCount: state.memories.length,
      activeGoals: activeGoals.length,
      activeWorkflows: activeWorkflows.length,
      graphNodes: state.graph.nodes.length,
      graphEdges: state.graph.edges.length,
      recentInsights: insights.length
    }
  };
}

async function buildAIOSContext(userId, query = '', services = {}) {
  try {
    await unifiedMemory.hydrateMemoryFromStorage?.(userId, services);
    await goalManager.hydrateGoalsFromStorage?.(userId, services);
    await workflowEngine.hydrateWorkflowsFromStorage?.(userId, services);
    await insightStore.hydrateInsightsFromStorage?.(userId, services);
    await knowledgeGraph.hydrateGraphFromStorage?.(userId, services);
  } catch (_) {}

  let relevantMemory = unifiedMemory.searchMemory(userId, query, { limit: 5 }, services);
  let activeGoals = goalManager.listGoals(userId, { status: 'active', limit: 5 }, services);
  let activeWorkflows = workflowEngine.listWorkflows(userId, { status: 'active', limit: 5 }, services);
  let recentInsights = await insightStore.listInsights(userId, { limit: 5 }, services);
  const graph = knowledgeGraph.searchGraph(userId, query, services, 5);

  try {
    relevantMemory = contextRelevanceGate.filterRelevantContext(query, relevantMemory);
    activeGoals = contextRelevanceGate.filterRelevantContext(query, activeGoals);
    activeWorkflows = contextRelevanceGate.filterRelevantContext(query, activeWorkflows);
    recentInsights = contextRelevanceGate.filterRelevantContext(query, recentInsights);
  } catch (_) {}

  const summaryText = [
    activeGoals.length ? `Goals: ${activeGoals.map(goal => goal.title).join(', ')}` : '',
    activeWorkflows.length ? `Workflows: ${activeWorkflows.map(workflow => workflow.title).join(', ')}` : '',
    relevantMemory.length ? `Memory: ${relevantMemory.map(memory => utils.compactText(memory.content, 80)).join(' | ')}` : '',
    recentInsights.length ? `Insights: ${recentInsights.map(insight => utils.compactText(insight.content || insight.text, 80)).join(' | ')}` : '',
    graph.nodes.length ? `Graph: ${graph.nodes.map(node => node.label).join(', ')}` : ''
  ].filter(Boolean).join('\n') || '-';

  return {
    userId: guards.normalizeUserId(userId),
    relevantMemory,
    activeGoals,
    activeWorkflows,
    recentInsights,
    graph,
    summaryText: utils.compactText(summaryText, 1400)
  };
}

function compressContextSummary(fragments = [], maxChars = guards.DEFAULT_LIMITS.contextChars) {
  const cleaned = guards.safeArray(fragments)
    .map((part) => guards.sanitizeText(part, Math.min(maxChars, 1200)))
    .filter(Boolean);
  const compacted = guards.preventContextFragmentation({ fragments: cleaned }).fragments;
  let output = '';
  for (const fragment of compacted) {
    const next = output ? `${output}\n${fragment}` : fragment;
    if (next.length > maxChars) break;
    output = next;
  }
  return output || '-';
}

function formatGoals(goals = []) {
  if (!goals.length) return 'Goals aktif: -';
  return [
    'Goals aktif:',
    ...goals.map((goal) => `- ${goal.title} (${goal.priority}, progress ${Math.round((goal.progress || 0) * 100)}%)`)
  ].join('\n');
}

function formatWorkflows(workflows = []) {
  if (!workflows.length) return 'Workflow aktif: -';
  return [
    'Workflow aktif:',
    ...workflows.map((workflow) => {
      const done = workflow.steps.filter((step) => step.done).length;
      return `- ${workflow.title} (${done}/${workflow.steps.length} step)`;
    })
  ].join('\n');
}

function formatGraph(graph = {}, state = {}) {
  const nodes = guards.safeArray(graph.nodes).slice(0, 5);
  const edges = guards.safeArray(graph.edges).slice(0, 5);
  if (!nodes.length) return 'Knowledge graph relevan: -';
  const labelById = new Map(guards.safeArray(state.graph?.nodes).map((node) => [node.id, node.label]));
  return [
    'Knowledge graph relevan:',
    ...nodes.map((node) => `- ${node.label} (${node.type})`),
    ...edges.map((edge) => `- ${labelById.get(edge.from) || edge.from} ${edge.relationship} ${labelById.get(edge.to) || edge.to}`)
  ].join('\n');
}

function formatInsights(insights = []) {
  if (!insights.length) return 'Insight terbaru: -';
  return [
    'Insight terbaru:',
    ...insights.slice(0, 5).map((insight) => `- ${guards.compactText(insight.text, 160)}`)
  ].join('\n');
}

module.exports = {
  buildAIOSContext,
  syncContext,
  compressContextSummary,
  formatGoals,
  formatWorkflows,
  formatGraph,
  formatInsights
};
