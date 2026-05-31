'use strict';

const graph = require('./knowledge-graph');
const retriever = require('./graph-retriever');
const graphUtils = require('./graph-utils');

function relationLine(edge, labelById) {
  const from = labelById.get(edge.from) || edge.from;
  const to = labelById.get(edge.to) || edge.to;
  const confidence = Number(edge.confidence || 0).toFixed(2);
  return `${from} ${edge.relationship} ${to} (confidence ${confidence})`;
}

function topBy(items = [], scorer, limit = 6) {
  return [...(Array.isArray(items) ? items : [])]
    .sort((a, b) => scorer(b) - scorer(a))
    .slice(0, limit);
}

function summarizeGraph(userId, options = {}, services = {}) {
  const stats = graph.getGraphStats(userId, services);
  const snapshot = graph.buildGraphSnapshot(userId, {
    query: options.query || '',
    nodeLimit: options.nodeLimit || 10,
    edgeLimit: options.edgeLimit || 12
  }, services);
  return {
    ...snapshot,
    stats,
    summaryText: formatGraphForTelegram({ ...snapshot, stats }, options)
  };
}

function summarizeConcept(userId, conceptLabel, options = {}, services = {}) {
  const neighbors = graph.getNeighbors(userId, conceptLabel, { limit: options.limit || 10 }, services);
  const labelById = new Map([neighbors.node, ...(neighbors.neighbors || [])].filter(Boolean).map(node => [node.id, node.label]));
  const summary = [
    `Concept: ${neighbors.node ? neighbors.node.label : conceptLabel}`,
    neighbors.node ? `Type: ${neighbors.node.type}` : 'Type: belum ada di graph',
    neighbors.node?.summary ? `Summary: ${graphUtils.compactText(neighbors.node.summary, 260)}` : '',
    '',
    'Related concepts:',
    ...(neighbors.neighbors?.length ? neighbors.neighbors.slice(0, 8).map((node, index) => `${index + 1}. ${node.label} (${node.type})`) : ['- belum ada relasi']),
    '',
    'Relationships:',
    ...(neighbors.edges?.length ? neighbors.edges.slice(0, 10).map(edge => `- ${relationLine(edge, labelById)}`) : ['- belum ada relasi']),
    '',
    neighbors.edges?.some(edge => Number(edge.confidence || 0) < 0.5) ? 'Catatan: beberapa relasi confidence rendah, perlu evidence tambahan.' : ''
  ].filter(line => line !== '').join('\n');
  return {
    node: neighbors.node,
    related: neighbors.neighbors || [],
    edges: neighbors.edges || [],
    summaryText: graphUtils.compactText(summary, options.summaryChars || graphUtils.DEFAULT_GRAPH_LIMITS.summaryChars)
  };
}

function summarizeProjectGraph(userId, options = {}, services = {}) {
  return retriever.getProjectGraphContext(userId, options.query || 'project roadmap AI OS bot', options, services);
}

function summarizeRisks(userId, options = {}, services = {}) {
  const nodes = graph.listNodes(userId, { type: 'risk', query: options.query || 'risk risiko', limit: options.limit || 8 }, services);
  const edges = graph.listEdges(userId, { relationship: 'risk_for', query: options.query || 'risk risiko', limit: options.edgeLimit || 12 }, services);
  const labelById = new Map(graph.listNodes(userId, { limit: 100 }, services).map(node => [node.id, node.label]));
  const summaryText = [
    'Risk graph:',
    '',
    nodes.length ? nodes.map((node, index) => `${index + 1}. ${node.label} - ${graphUtils.compactText(node.summary, 160)}`).join('\n') : '- Belum ada risk node eksplisit.',
    '',
    'Relasi risiko:',
    edges.length ? edges.map(edge => `- ${relationLine(edge, labelById)}`).join('\n') : '- Belum ada risk_for edge.'
  ].join('\n');
  return { nodes, edges, summaryText };
}

function summarizeDependencies(userId, options = {}, services = {}) {
  const relationships = ['depends_on', 'requires', 'blocks'];
  const edges = relationships.flatMap(rel => graph.listEdges(userId, { relationship: rel, limit: options.edgeLimit || 8 }, services));
  const nodes = graph.listNodes(userId, { limit: 100 }, services);
  const labelById = new Map(nodes.map(node => [node.id, node.label]));
  const summaryText = [
    'Dependency utama:',
    '',
    edges.length ? edges.slice(0, 12).map((edge, index) => `${index + 1}. ${relationLine(edge, labelById)}`).join('\n') : 'Belum ada dependency eksplisit di graph.',
    '',
    'Saran: tambahkan relasi dengan /relate <A> | <B> | depends_on | evidence jika dependency penting belum muncul.'
  ].join('\n');
  return { nodes: topBy(nodes, node => graphUtils.scoreNode(node), 8), edges: edges.slice(0, 12), summaryText };
}

function summarizeContradictions(userId, options = {}, services = {}) {
  const edges = graph.listEdges(userId, { relationship: 'contradicts', limit: options.edgeLimit || 12 }, services);
  const nodes = graph.listNodes(userId, { limit: 100 }, services);
  const labelById = new Map(nodes.map(node => [node.id, node.label]));
  const summaryText = [
    'Kontradiksi / tension:',
    '',
    edges.length ? edges.map((edge, index) => `${index + 1}. ${relationLine(edge, labelById)}\n   Evidence: ${graphUtils.compactText(edge.evidence, 180)}`).join('\n') : 'Belum ada kontradiksi eksplisit.',
    '',
    'Catatan: graph tidak membuktikan kontradiksi final; ini hanya sinyal untuk review.'
  ].join('\n');
  return { nodes: [], edges, summaryText };
}

function formatGraphForTelegram(snapshot = {}, options = {}) {
  const nodes = snapshot.nodes || [];
  const edges = snapshot.edges || [];
  const stats = snapshot.stats || {};
  const labelById = new Map(nodes.map(node => [node.id, node.label]));
  const topConcepts = topBy(nodes.filter(node => node.type === 'concept'), node => graphUtils.scoreNode(node), 5);
  const topTechnologies = topBy(nodes.filter(node => ['technology', 'tool'].includes(node.type)), node => graphUtils.scoreNode(node), 5);
  const topRisks = topBy(nodes.filter(node => node.type === 'risk'), node => graphUtils.scoreNode(node), 5);
  const linkedGoals = topBy(nodes.filter(node => ['goal', 'workflow'].includes(node.type)), node => graphUtils.scoreNode(node), 5);

  return [
    options.title || 'Knowledge Graph',
    '',
    `Total nodes: ${stats.nodes ?? snapshot.allNodeCount ?? nodes.length}`,
    `Total edges: ${stats.edges ?? snapshot.allEdgeCount ?? edges.length}`,
    '',
    'Top concepts:',
    ...(topConcepts.length ? topConcepts.map(node => `- ${node.label}`) : ['- belum cukup data']),
    '',
    'Top technologies/tools:',
    ...(topTechnologies.length ? topTechnologies.map(node => `- ${node.label}`) : ['- belum cukup data']),
    '',
    'Goals/workflows linked:',
    ...(linkedGoals.length ? linkedGoals.map(node => `- ${node.label}`) : ['- belum cukup data']),
    '',
    'Top risks:',
    ...(topRisks.length ? topRisks.map(node => `- ${node.label}`) : ['- belum ada risk eksplisit']),
    '',
    'Recent relationships:',
    ...(edges.length ? edges.slice(0, 8).map(edge => `- ${relationLine(edge, labelById)}`) : ['- belum ada relasi']),
    '',
    'Suggested next review:',
    '- Tambahkan evidence untuk relasi confidence rendah.',
    '- Hubungkan goal/workflow penting dengan konsep teknis yang relevan.'
  ].join('\n');
}

module.exports = {
  formatGraphForTelegram,
  summarizeConcept,
  summarizeContradictions,
  summarizeDependencies,
  summarizeGraph,
  summarizeProjectGraph,
  summarizeRisks
};
