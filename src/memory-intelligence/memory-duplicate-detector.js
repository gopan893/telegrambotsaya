'use strict';

const store = require('./memory-intelligence-store');

const SIMILARITY_THRESHOLD = 0.85;
const EXACT_MATCH_THRESHOLD = 1.0;

function detectDuplicateMemories(memories, options = {}) {
  if (!Array.isArray(memories) || memories.length < 2) {
    return { duplicates: [], pairCount: 0, message: 'Need at least 2 memories to compare' };
  }

  const threshold = options.threshold || SIMILARITY_THRESHOLD;
  const duplicates = [];

  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const similarity = calculateSimilarity(memories[i], memories[j]);
      if (similarity >= threshold) {
        const pair = {
          memoryA: memories[i].id,
          memoryB: memories[j].id,
          similarity,
          type: similarity >= EXACT_MATCH_THRESHOLD ? 'exact' : 'near',
          contentA: truncate(memories[i].content),
          contentB: truncate(memories[j].content),
          recommendation: 'proposal_only',
          status: 'detected'
        };
        duplicates.push(pair);
        store.storeDuplicatePair(`${memories[i].id}_${memories[j].id}`, pair);
      }
    }
  }

  return {
    duplicates,
    pairCount: duplicates.length,
    exactDuplicates: duplicates.filter(d => d.type === 'exact').length,
    nearDuplicates: duplicates.filter(d => d.type === 'near').length,
    message: duplicates.length > 0
      ? `Found ${duplicates.length} duplicate pair(s). All are report/proposal only — no auto-delete.`
      : 'No duplicates detected'
  };
}

function calculateSimilarity(memA, memB) {
  if (!memA || !memB) return 0;
  const contentA = (memA.content || '').toLowerCase();
  const contentB = (memB.content || '').toLowerCase();
  if (contentA === contentB) return 1.0;

  const termsA = new Set(contentA.split(/\s+/).filter(t => t.length > 2));
  const termsB = new Set(contentB.split(/\s+/).filter(t => t.length > 2));
  if (termsA.size === 0 || termsB.size === 0) return 0;

  let intersection = 0;
  for (const term of termsA) {
    if (termsB.has(term)) intersection++;
  }
  const union = termsA.size + termsB.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;

  const tagA = new Set((memA.tags || []).map(t => t.toLowerCase()));
  const tagB = new Set((memB.tags || []).map(t => t.toLowerCase()));
  let tagOverlap = 0;
  for (const tag of tagA) {
    if (tagB.has(tag)) tagOverlap++;
  }
  const tagUnion = tagA.size + tagB.size - tagOverlap;
  const tagSim = tagUnion > 0 ? tagOverlap / tagUnion : 0;

  return jaccard * 0.8 + tagSim * 0.2;
}

function truncate(text) {
  if (!text) return '';
  return text.length > 80 ? text.slice(0, 77) + '...' : text;
}

function generateDuplicateReport(duplicates) {
  const pairs = Array.isArray(duplicates) ? duplicates : (duplicates && duplicates.duplicates ? duplicates.duplicates : []);
  if (!pairs || pairs.length === 0) {
    return { summary: 'No duplicates found', pairs: [], actions: [] };
  }
  return {
    summary: `Found ${pairs.length} duplicate pair(s). All are report/proposal only — no auto-delete.`,
    pairs: pairs.map(d => ({
      memoryA: d.memoryA,
      memoryB: d.memoryB,
      similarity: d.similarity,
      type: d.type,
      recommendation: 'Create merge proposal for user review'
    })),
    actions: pairs.map(d => ({
      type: 'merge_proposal',
      memoryA: d.memoryA,
      memoryB: d.memoryB,
      note: 'Proposal only. Originals preserved until user approves merge.'
    }))
  };
}

module.exports = { detectDuplicateMemories, calculateSimilarity, generateDuplicateReport };
