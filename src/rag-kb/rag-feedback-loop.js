'use strict';

const feedbackStore = [];

function recordFeedback(query, docId, relevant, metadata = {}) {
  const entry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    query,
    docId,
    relevant: Boolean(relevant),
    timestamp: new Date().toISOString(),
    metadata
  };
  feedbackStore.push(entry);
  if (feedbackStore.length > 5000) feedbackStore.splice(0, feedbackStore.length - 5000);
  return entry;
}

function getPositiveExamples(minScore = 0.7) {
  return feedbackStore.filter(f => f.relevant);
}

function getNegativeExamples() {
  return feedbackStore.filter(f => !f.relevant);
}

function getFeedbackStats() {
  const total = feedbackStore.length;
  const positive = feedbackStore.filter(f => f.relevant).length;
  return { total, positive, negative: total - positive, positiveRate: total > 0 ? positive / total : 0 };
}

function getFeedbackForDoc(docId) {
  return feedbackStore.filter(f => f.docId === docId);
}

function clearFeedback() {
  feedbackStore.length = 0;
}

module.exports = { recordFeedback, getPositiveExamples, getNegativeExamples, getFeedbackStats, getFeedbackForDoc, clearFeedback };
