'use strict';

const listeners = new Map();

function on(eventName, handler, pluginId = 'system') {
  if (!listeners.has(eventName)) listeners.set(eventName, []);
  listeners.get(eventName).push({ handler, pluginId });
  return () => off(eventName, handler);
}

function off(eventName, handler) {
  if (!listeners.has(eventName)) return;
  listeners.set(eventName, listeners.get(eventName).filter(l => l.handler !== handler));
}

async function emit(eventName, payload = {}) {
  const handlers = listeners.get(eventName) || [];
  const results = [];
  for (const { handler, pluginId } of handlers) {
    try {
      const result = await handler({ event: eventName, payload, pluginId });
      results.push({ ok: true, pluginId, result });
    } catch (err) {
      results.push({ ok: false, pluginId, error: err.message });
    }
  }
  return results;
}

function getListenerCount(eventName) {
  return (listeners.get(eventName) || []).length;
}

function listActiveEvents() {
  return Array.from(listeners.keys()).sort();
}

function clearAll() {
  listeners.clear();
}

module.exports = { on, off, emit, getListenerCount, listActiveEvents, clearAll };
