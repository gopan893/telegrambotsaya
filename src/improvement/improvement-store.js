const { generateId } = require('./improvement-utils');

const TYPES = ['feedback', 'outcomes', 'weaknesses', 'patterns', 'lessons', 'regressionCases', 'plans'];

class ImprovementStore {
  constructor() {
    this._store = {
      feedback: [],
      outcomes: [],
      weaknesses: [],
      patterns: [],
      lessons: [],
      regressionCases: [],
      plans: [],
    };
  }

  _validateType(type) {
    if (!TYPES.includes(type)) {
      throw new Error(`Invalid store type "${type}". Valid types: ${TYPES.join(', ')}`);
    }
  }

  getAll(type) {
    this._validateType(type);
    return this._store[type].slice();
  }

  getById(type, id) {
    this._validateType(type);
    return this._store[type].find(item => item.id === id) || null;
  }

  add(type, item) {
    this._validateType(type);
    const entry = { ...item };
    if (!entry.id) {
      entry.id = generateId();
    }
    this._store[type].push(entry);
    return entry;
  }

  update(type, id, updates) {
    this._validateType(type);
    const idx = this._store[type].findIndex(item => item.id === id);
    if (idx === -1) return null;
    this._store[type][idx] = { ...this._store[type][idx], ...updates };
    return this._store[type][idx];
  }

  remove(type, id) {
    this._validateType(type);
    const idx = this._store[type].findIndex(item => item.id === id);
    if (idx === -1) return null;
    this._store[type][idx].status = 'archived';
    return this._store[type][idx];
  }

  find(type, predicate) {
    this._validateType(type);
    return this._store[type].filter(predicate);
  }

  clear() {
    for (const key of TYPES) {
      this._store[key] = [];
    }
  }

  getStats() {
    const stats = {};
    for (const key of TYPES) {
      stats[key] = this._store[key].length;
    }
    return stats;
  }
}

let defaultInstance = null;

function getDefaultStore() {
  if (!defaultInstance) {
    defaultInstance = new ImprovementStore();
  }
  return defaultInstance;
}

module.exports = {
  ImprovementStore,
  getDefaultStore,
};
