'use strict';

function createInsight(userId, content, source = 'collaboration') {
  return {
    id: `ins_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: String(userId),
    type: 'collaboration-insight',
    content: String(content || '').trim().slice(0, 1000),
    source,
    relatedConcepts: [],
    confidence: 0.66,
    importance: 0.62,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  createInsight
};
