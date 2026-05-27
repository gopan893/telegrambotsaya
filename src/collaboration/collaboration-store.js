'use strict';

function ensureCollab(user = {}) {
  if (!user.collaboration || typeof user.collaboration !== 'object') {
    user.collaboration = {
      insights: [],
      journal: [],
      decisions: [],
      analytics: {
        sessions: 0,
        decisions: 0,
        reflections: 0,
        learningPlans: 0
      }
    };
  }
  for (const key of ['insights', 'journal', 'decisions']) {
    if (!Array.isArray(user.collaboration[key])) user.collaboration[key] = [];
  }
  return user.collaboration;
}

function appendBounded(list, item, max = 80) {
  list.push(item);
  while (list.length > max) list.shift();
  return item;
}

function reset(user = {}) {
  user.collaboration = {
    insights: [],
    journal: [],
    decisions: [],
    analytics: {
      sessions: 0,
      decisions: 0,
      reflections: 0,
      learningPlans: 0
    }
  };
  return user.collaboration;
}

module.exports = {
  ensureCollab,
  appendBounded,
  reset
};
