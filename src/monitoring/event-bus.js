'use strict';

const utils = require('./monitoring-utils');

function createEventBus() {
  const listeners = {};
  const history = [];
  const MAX_HISTORY = 500;

  function on(topic, fn) {
    if (!listeners[topic]) listeners[topic] = new Set();
    listeners[topic].add(fn);
    return () => listeners[topic].delete(fn);
  }

  function emit(event) {
    const e = { id: utils.generateId('evt'), ...event, createdAt: utils.nowISO() };
    const sanitized = utils.sanitize(e);
    history.push(sanitized);
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    const topic = sanitized.topic || 'health';
    if (listeners[topic]) listeners[topic].forEach(fn => { try { fn(sanitized); } catch (_) {} });
    if (listeners['*']) listeners['*'].forEach(fn => { try { fn(sanitized); } catch (_) {} });
    return sanitized;
  }

  function getHistory(filter) {
    if (!filter) return history;
    return history.filter(e => {
      if (filter.topic && e.topic !== filter.topic) return false;
      if (filter.severity && e.severity !== filter.severity) return false;
      if (filter.source && e.source !== filter.source) return false;
      return true;
    });
  }

  function clear() { history.length = 0; }

  return { on, emit, getHistory, clear };
}

module.exports = { createEventBus };
