'use strict';

const utils = require('../ai-os/aios-utils');

const STORAGE_KEY = 'collaboration_state';

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

async function hydrate(userId, user = {}, services = {}) {
  const collab = ensureCollab(user);
  if (!services.storageManager?.loadData) return collab;
  try {
    const stored = await utils.loadUserBucket(STORAGE_KEY, userId, services, null);
    if (stored && typeof stored === 'object') {
      user.collaboration = normalizeCollab(stored);
    }
  } catch (_) {}
  return ensureCollab(user);
}

async function mirror(userId, user = {}, services = {}) {
  const collab = ensureCollab(user);
  if (!services.storageManager?.saveData) return false;
  try {
    return await utils.saveUserBucket(STORAGE_KEY, userId, normalizeCollab(collab), services);
  } catch (_) {
    return false;
  }
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

function normalizeCollab(value = {}) {
  const collab = {
    insights: Array.isArray(value.insights) ? value.insights.slice(-80) : [],
    journal: Array.isArray(value.journal) ? value.journal.slice(-80) : [],
    decisions: Array.isArray(value.decisions) ? value.decisions.slice(-80) : [],
    analytics: {
      sessions: Number(value.analytics?.sessions || 0),
      decisions: Number(value.analytics?.decisions || 0),
      reflections: Number(value.analytics?.reflections || 0),
      learningPlans: Number(value.analytics?.learningPlans || 0)
    }
  };
  return collab;
}

module.exports = {
  STORAGE_KEY,
  ensureCollab,
  hydrate,
  mirror,
  appendBounded,
  reset,
  normalizeCollab
};
