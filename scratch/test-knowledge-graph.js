'use strict';

const assert = require('assert');
const aiOS = require('../src/ai-os');

const users = new Map();

function ensureUser(userId) {
  const id = String(userId);
  if (!users.has(id)) users.set(id, { id, aios: undefined });
  return users.get(id);
}

const services = {
  aiOS,
  ensureUser,
  persist: () => {}
};

function labels(concepts) {
  return concepts.map(item => item.label || item);
}

async function run() {
  const extracted = aiOS.conceptExtractor.extractConcepts('PostgreSQL untuk persistent memory dan Redis untuk cache bot AI', { maxConcepts: 10 });
  const extractedLabels = labels(extracted);
  assert(extractedLabels.includes('PostgreSQL'), 'extractConcepts should include PostgreSQL');
  assert(extractedLabels.includes('Redis'), 'extractConcepts should include Redis');
  assert(extractedLabels.some(label => /persistent memory/i.test(label)), 'extractConcepts should include persistent memory');
  assert(extractedLabels.some(label => /^cache$/i.test(label)), 'extractConcepts should include cache');

  const first = aiOS.knowledgeGraph.upsertConcept('u1', { label: 'PostgreSQL', type: 'technology' }, services);
  const second = aiOS.knowledgeGraph.upsertConcept('u1', { label: 'postgresql', type: 'technology' }, services);
  assert(first.ok && second.ok, 'upsertConcept should succeed');
  assert.strictEqual(first.node.id, second.node.id, 'upsertConcept should not duplicate same label');
  assert(second.node.occurrenceCount >= 2, 'duplicate upsert should increase occurrenceCount');

  const link = aiOS.knowledgeGraph.linkConcepts(
    'u1',
    'PostgreSQL',
    'persistent memory',
    'supports',
    'PostgreSQL menyimpan memory jangka panjang',
    services
  );
  assert(link.ok, 'linkConcepts should create edge');
  assert.strictEqual(link.edge.relationship, 'supports', 'edge relationship should be supports');

  const duplicateLink = aiOS.knowledgeGraph.linkConcepts(
    'u1',
    'PostgreSQL',
    'persistent memory',
    'supports',
    'PostgreSQL menyimpan memory jangka panjang',
    services
  );
  assert(duplicateLink.ok, 'duplicate linkConcepts should succeed');
  assert(duplicateLink.edge.occurrenceCount >= 2, 'duplicate edge should increase occurrenceCount');

  const relevant = aiOS.graphRetriever.getRelevantGraph('u1', 'PostgreSQL memory', { nodeLimit: 8, edgeLimit: 12 }, services);
  assert(relevant.nodes.some(node => /PostgreSQL/i.test(node.label)), 'getRelevantGraph should return PostgreSQL node');
  assert(relevant.nodes.some(node => /memory/i.test(node.label)), 'getRelevantGraph should return memory node');

  const emptySummary = aiOS.graphSummarizer.summarizeGraph('empty-user', {}, services);
  assert(emptySummary.summaryText.includes('Knowledge Graph'), 'summarizeGraph should not crash on empty graph');

  const secretResult = aiOS.knowledgeGraph.evolveGraphFromText('secret-user', 'API key token password should not be stored', services);
  assert.strictEqual(secretResult.ok, false, 'graph guard should reject sensitive text');
  assert.strictEqual(aiOS.knowledgeGraph.getGraphStats('secret-user', services).nodes, 0, 'sensitive graph text should not create nodes');

  const prune = aiOS.knowledgeGraph.pruneGraph('u1', services);
  assert(Number.isFinite(prune.nodes), 'pruneGraph should return node count');

  console.log('Knowledge graph tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
