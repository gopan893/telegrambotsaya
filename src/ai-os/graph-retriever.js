'use strict';

const graph = require('./knowledge-graph');
const graphGuards = require('./graph-guards');
const graphUtils = require('./graph-utils');

function labelsById(nodes = []) {
  return new Map((Array.isArray(nodes) ? nodes : []).map(node => [node.id, node.label]));
}

function formatSummary(nodes = [], edges = []) {
  const labelById = labelsById(nodes);
  const nodeText = nodes.length
    ? nodes.map(node => `${node.label} (${node.type})`).join(', ')
    : '-';
  const edgeText = edges.length
    ? edges.map(edge => `${labelById.get(edge.from) || edge.from} ${edge.relationship} ${labelById.get(edge.to) || edge.to}`).join('; ')
    : '-';
  return graphUtils.compactText(`Konsep relevan: ${nodeText}\nRelasi relevan: ${edgeText}`, graphUtils.DEFAULT_GRAPH_LIMITS.summaryChars);
}

function searchNodes(userId, query = '', options = {}, services = {}) {
  return graph.listNodes(userId, {
    query,
    type: options.type,
    limit: options.limit || options.topK || graphUtils.DEFAULT_GRAPH_LIMITS.topK
  }, services);
}

function searchEdges(userId, query = '', options = {}, services = {}) {
  return graph.listEdges(userId, {
    query,
    relationship: options.relationship,
    limit: options.limit || options.topK || graphUtils.DEFAULT_GRAPH_LIMITS.edgeTopK
  }, services);
}

function getRelevantGraph(userId, query = '', options = {}, services = {}) {
  try {
    const nodes = searchNodes(userId, query, { limit: options.nodeLimit || options.topK || 8, type: options.type }, services);
    const nodeIds = new Set(nodes.map(node => node.id));
    const allEdges = searchEdges(userId, query, { limit: options.edgeLimit || 12, relationship: options.relationship }, services);
    const edges = allEdges
      .filter(edge => !nodeIds.size || nodeIds.has(edge.from) || nodeIds.has(edge.to))
      .slice(0, options.edgeLimit || 12);
    const snapshot = { nodes, edges, summaryText: formatSummary(nodes, edges) };
    return graphGuards.limitGraphContext(snapshot, options);
  } catch (err) {
    return graphGuards.safeGraphFallback(err, { nodes: [], edges: [], summaryText: '' });
  }
}

function getRelatedConcepts(userId, query = '', options = {}, services = {}) {
  const relevant = getRelevantGraph(userId, query, options, services);
  const related = [];
  for (const node of relevant.nodes || []) {
    const neighbors = graph.getNeighbors(userId, node.id, { limit: options.neighborLimit || 6 }, services);
    related.push(...(neighbors.neighbors || []));
  }
  return graphUtils.limitArray(
    [...relevant.nodes, ...related]
      .filter(Boolean)
      .filter((node, index, arr) => arr.findIndex(item => item.id === node.id) === index),
    options.limit || 12
  );
}

function getProjectGraphContext(userId, query = 'project', options = {}, services = {}) {
  return getRelevantGraph(userId, query || 'project bot AI roadmap AI OS', {
    ...options,
    nodeLimit: options.nodeLimit || 8,
    edgeLimit: options.edgeLimit || 12
  }, services);
}

function getGoalGraphContext(userId, goalIdOrQuery = '', options = {}, services = {}) {
  return getRelevantGraph(userId, goalIdOrQuery || 'goal tujuan roadmap', {
    ...options,
    nodeLimit: options.nodeLimit || 8,
    edgeLimit: options.edgeLimit || 12
  }, services);
}

function getWorkflowGraphContext(userId, workflowIdOrQuery = '', options = {}, services = {}) {
  return getRelevantGraph(userId, workflowIdOrQuery || 'workflow step blocker dependency', {
    ...options,
    nodeLimit: options.nodeLimit || 8,
    edgeLimit: options.edgeLimit || 12
  }, services);
}

module.exports = {
  getGoalGraphContext,
  getProjectGraphContext,
  getRelevantGraph,
  getRelatedConcepts,
  getWorkflowGraphContext,
  searchEdges,
  searchNodes
};
