'use strict';

function summarize(collab = {}) {
  return {
    insights: (collab.insights || []).length,
    journalEntries: (collab.journal || []).length,
    decisions: (collab.decisions || []).length,
    sessions: collab.analytics?.sessions || 0,
    reflections: collab.analytics?.reflections || 0,
    learningPlans: collab.analytics?.learningPlans || 0
  };
}

module.exports = {
  summarize
};
