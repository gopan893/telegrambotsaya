'use strict';

const STORAGE_KEY = 'autonomy_agent_workflows';

function createAgentWorkflow(options = {}) {
  const storage = options.storageManager;
  const callbacks = options.callbacks || {};
  let cache = [];

  async function read() {
    try {
      const val = storage?.safeRead ? await storage.safeRead(STORAGE_KEY, [])
        : storage?.loadData ? await storage.loadData(STORAGE_KEY, [])
          : storage?.get ? await storage.get(STORAGE_KEY) : [];
      cache = Array.isArray(val) ? val : [];
    } catch (_) { cache = []; }
  }

  async function write() {
    try {
      if (storage?.safeWrite) await storage.safeWrite(STORAGE_KEY, cache);
      else if (storage?.saveData) await storage.saveData(STORAGE_KEY, cache);
      else if (storage?.set) await storage.set(STORAGE_KEY, cache);
    } catch (_) {}
  }

  async function start(input = {}) {
    await read();
    const session = {
      id: Math.random().toString(36).slice(2, 10),
      goal: input.goal || '',
      status: 'planning',
      outputs: {},
      error: null,
      createdAt: new Date().toISOString()
    };
    cache.push(session);
    await write();
    return session;
  }

  async function getSession(id) {
    await read();
    return cache.find(s => s.id === id) || null;
  }

  async function tick(id) {
    await read();
    const idx = cache.findIndex(s => s.id === id);
    if (idx === -1) return null;
    const session = cache[idx];

    // State machine steps: planning -> coding -> reviewing -> deploying -> done
    try {
      if (session.status === 'planning') {
        if (typeof callbacks.planner === 'function') {
          session.outputs.planner = await callbacks.planner(session);
        }
        session.status = 'coding';
      } else if (session.status === 'coding') {
        if (typeof callbacks.coder === 'function') {
          session.outputs.coder = await callbacks.coder(session);
        }
        session.status = 'reviewing';
      } else if (session.status === 'reviewing') {
        if (typeof callbacks.reviewer === 'function') {
          const rev = await callbacks.reviewer(session);
          session.outputs.reviewer = rev;
          if (rev && rev.ok === false) {
            throw new Error(`Review failed: ${rev.reason || 'low score'}`);
          }
        }
        session.status = 'deploying';
      } else if (session.status === 'deploying') {
        if (typeof callbacks.deployer === 'function') {
          session.outputs.deployer = await callbacks.deployer(session);
        }
        session.status = 'done';
      }
    } catch (err) {
      session.status = 'failed';
      session.error = err.message;
    }

    cache[idx] = { ...session, updatedAt: new Date().toISOString() };
    await write();
    return cache[idx];
  }

  return { start, tick, getSession };
}

module.exports = { createAgentWorkflow, STORAGE_KEY };
