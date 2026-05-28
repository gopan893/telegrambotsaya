'use strict';

function trimArray(value, max) {
  return Array.isArray(value) && value.length > max ? value.slice(-max) : value;
}

function cleanupRuntimeState(state) {
  const {
    userMemory,
    botSettings,
    setShortMemory,
    getShortMemory,
    setKnowledgeBase,
    getKnowledgeBase,
    setAbLog,
    getAbLog,
    aiCache,
    cleanupPatchState,
    rateBuckets,
    now
  } = state;

  for (const key of Object.keys(userMemory || {})) {
    const u = userMemory[key];
    if (!u) continue;
    u.todos = trimArray(u.todos, 50) || u.todos;
    u.reminders = trimArray(u.reminders, 20) || u.reminders;
    u.tags = trimArray(u.tags, 20) || u.tags;
  }

  const shortMemory = getShortMemory();
  if (shortMemory.length > botSettings.maxShortMemory) {
    setShortMemory(shortMemory.slice(-botSettings.maxShortMemory));
  }

  const knowledgeBase = getKnowledgeBase();
  if (knowledgeBase.length > botSettings.maxKnowledge) {
    setKnowledgeBase(knowledgeBase.slice(-botSettings.maxKnowledge));
  }

  const abLog = getAbLog();
  if (abLog.length > botSettings.maxAbLog) {
    setAbLog(abLog.slice(-botSettings.maxAbLog));
  }

  aiCache.cleanup();
  cleanupPatchState();

  const current = now();
  for (const [key, value] of rateBuckets.entries()) {
    if (current - (value.last || 0) > 10 * 60 * 1000) {
      rateBuckets.delete(key);
    }
  }
}

module.exports = {
  cleanupRuntimeState
};
