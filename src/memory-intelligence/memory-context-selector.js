'use strict';

const { calculateAgeDays, freshnessLabel } = require('./memory-intelligence-utils');
const sensitivityClassifier = require('./memory-sensitivity-classifier');

function selectRelevantMemories(query, memories, options = {}) {
  if (!query || typeof query !== 'string') {
    return { selected: [], reasons: ['invalid_query'] };
  }
  if (!Array.isArray(memories) || memories.length === 0) {
    return { selected: [], reasons: ['no_memories'] };
  }

  const maxResults = options.maxResults || 10;
  const includeOwnerOnly = options.includeOwnerOnly || false;
  const callerIsOwner = options.callerIsOwner || false;
  const excludeSecrets = options.excludeSecrets !== false;

  const scored = memories
    .map(memory => ({
      memory,
      score: scoreMemoryRelevance(memory, query),
      sensitivity: sensitivityClassifier.classifySensitivity(memory)
    }))
    .filter(item => {
      if (excludeSecrets && sensitivityClassifier.shouldBlockFromRag(item.sensitivity)) return false;
      if (sensitivityClassifier.isOwnerOnly(item.sensitivity) && !callerIsOwner) return false;
      if (!includeOwnerOnly && sensitivityClassifier.isOwnerOnly(item.sensitivity)) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return {
    selected: scored.map(s => ({
      ...s.memory,
      relevanceScore: s.score,
      sensitivityLevel: s.sensitivity.level
    })),
    totalCount: scored.length,
    filteredCount: memories.length - scored.length,
    reasons: scored.length > 0 ? ['matched'] : ['no_matching_memories']
  };
}

function scoreMemoryRelevance(memory, query) {
  if (!memory || !query) return 0;
  const content = (memory.content || '').toLowerCase();
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  let termScore = 0;
  for (const term of queryTerms) {
    if (content.includes(term)) termScore++;
  }
  const termRatio = queryTerms.length > 0 ? termScore / queryTerms.length : 0;

  const tagScore = calculateTagScore(memory.tags || [], query);

  const freshnessScore = calculateFreshnessBoost(memory);

  const recencyBonus = calculateRecencyBonus(memory);

  return termRatio * 0.5 + tagScore * 0.25 + freshnessScore * 0.15 + recencyBonus * 0.1;
}

function calculateTagScore(tags, query) {
  if (!tags || tags.length === 0) return 0;
  const queryLower = query.toLowerCase();
  let matches = 0;
  for (const tag of tags) {
    if (queryLower.includes(tag.toLowerCase())) matches++;
  }
  return tags.length > 0 ? matches / tags.length : 0;
}

function calculateFreshnessBoost(memory) {
  const ageDays = calculateAgeDays(memory.updatedAt || memory.createdAt);
  const freshness = freshnessLabel(ageDays);
  const boosts = { fresh: 1.0, recent: 0.8, aging: 0.5, stale: 0.2, unknown: 0.3 };
  return boosts[freshness] || 0.3;
}

function calculateRecencyBonus(memory) {
  const lastAccessed = memory.lastAccessedAt;
  if (!lastAccessed) return 0;
  const accessAge = calculateAgeDays(lastAccessed);
  if (accessAge <= 1) return 1.0;
  if (accessAge <= 7) return 0.7;
  if (accessAge <= 30) return 0.4;
  return 0.1;
}

function selectForContext(query, memories, options = {}) {
  const result = selectRelevantMemories(query, memories, options);
  return {
    ...result,
    contextString: result.selected
      .map(m => `[${m.sensitivityLevel || 'unknown'}] ${m.content}`)
      .join('\n\n')
  };
}

module.exports = { selectRelevantMemories, selectForContext, scoreMemoryRelevance };
