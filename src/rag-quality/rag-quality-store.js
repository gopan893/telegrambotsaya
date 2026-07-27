'use strict';

const qualityEntries = new Map();
const confidenceScores = new Map();
const freshnessScores = new Map();
const retrievalEvaluations = new Map();
const citationLabels = new Map();

function addQualityEntry(entry) {
  const id = entry.id || `rq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    sourceId: entry.sourceId || 'unknown',
    sourceType: entry.sourceType || 'text',
    confidence: entry.confidence || 'unknown',
    freshness: entry.freshness || 'unknown',
    sensitivity: entry.sensitivity || 'unknown',
    metadata: entry.metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  qualityEntries.set(id, record);
  return record;
}

function getQualityEntry(entryId) {
  return qualityEntries.get(String(entryId)) || null;
}

function updateQualityEntry(entryId, updates) {
  const existing = qualityEntries.get(String(entryId));
  if (!existing) return null;
  const updated = { ...existing, ...updates, id: entryId, updatedAt: new Date().toISOString() };
  qualityEntries.set(entryId, updated);
  return updated;
}

function removeQualityEntry(entryId) {
  return qualityEntries.delete(String(entryId));
}

function listQualityEntries(filter = {}) {
  let arr = Array.from(qualityEntries.values());
  if (filter.confidence) arr = arr.filter(e => e.confidence === filter.confidence);
  if (filter.freshness) arr = arr.filter(e => e.freshness === filter.freshness);
  if (filter.sensitivity) arr = arr.filter(e => e.sensitivity === filter.sensitivity);
  if (filter.sourceType) arr = arr.filter(e => e.sourceType === filter.sourceType);
  if (filter.sourceId) arr = arr.filter(e => e.sourceId === filter.sourceId);
  return arr;
}

function getQualityEntryCount() {
  return qualityEntries.size;
}

function storeConfidenceScore(sourceId, score) {
  confidenceScores.set(String(sourceId), {
    sourceId,
    score,
    updatedAt: new Date().toISOString()
  });
}

function getConfidenceScore(sourceId) {
  return confidenceScores.get(String(sourceId)) || null;
}

function storeFreshnessScore(sourceId, score) {
  freshnessScores.set(String(sourceId), {
    sourceId,
    score,
    updatedAt: new Date().toISOString()
  });
}

function getFreshnessScore(sourceId) {
  return freshnessScores.get(String(sourceId)) || null;
}

function storeRetrievalEvaluation(evalId, evaluation) {
  retrievalEvaluations.set(String(evalId), {
    id: evalId,
    ...evaluation,
    createdAt: new Date().toISOString()
  });
}

function getRetrievalEvaluation(evalId) {
  return retrievalEvaluations.get(String(evalId)) || null;
}

function storeCitationLabel(sourceId, label) {
  citationLabels.set(String(sourceId), {
    sourceId,
    label,
    updatedAt: new Date().toISOString()
  });
}

function getCitationLabel(sourceId) {
  return citationLabels.get(String(sourceId)) || null;
}

function resetStore() {
  qualityEntries.clear();
  confidenceScores.clear();
  freshnessScores.clear();
  retrievalEvaluations.clear();
  citationLabels.clear();
}

module.exports = {
  addQualityEntry,
  getQualityEntry,
  updateQualityEntry,
  removeQualityEntry,
  listQualityEntries,
  getQualityEntryCount,
  storeConfidenceScore,
  getConfidenceScore,
  storeFreshnessScore,
  getFreshnessScore,
  storeRetrievalEvaluation,
  getRetrievalEvaluation,
  storeCitationLabel,
  getCitationLabel,
  resetStore
};
