'use strict';

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s_-]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function getTaskText(task = {}) {
  return normalize(`${task.title || ''} ${task.description || ''}`);
}

function detectDependencies(tasks = [], goals = [], workflows = [], graph = {}) {
  const list = Array.isArray(tasks) ? tasks : [];
  const byTitle = list.map(task => ({ task, text: getTaskText(task) }));
  const edges = [];

  for (const task of list) {
    const explicit = Array.isArray(task.dependencies) ? task.dependencies : [];
    for (const dependency of explicit) {
      edges.push({
        fromTaskId: dependency,
        toTaskId: task.id,
        type: 'explicit',
        confidence: 0.9,
        evidence: `Task ${task.id} mencantumkan dependency ${dependency}.`
      });
    }

    const text = getTaskText(task);
    if (/\b(setelah|after|menunggu|waiting|butuh|requires?|depends?)\b/i.test(text)) {
      for (const candidate of byTitle) {
        if (candidate.task.id === task.id) continue;
        const words = candidate.text.split(' ').filter(word => word.length > 4).slice(0, 4);
        if (words.some(word => text.includes(word))) {
          edges.push({
            fromTaskId: candidate.task.id,
            toTaskId: task.id,
            type: 'heuristic',
            confidence: 0.58,
            evidence: `Teks task menyebut dependency yang mirip dengan "${candidate.task.title}".`
          });
        }
      }
    }
  }

  for (const edge of graph.edges || []) {
    if (!['depends_on', 'requires', 'blocks'].includes(edge.relationship)) continue;
    edges.push({
      fromTaskId: edge.from || edge.fromNodeId,
      toTaskId: edge.to || edge.toNodeId,
      type: 'graph',
      confidence: Number(edge.confidence || 0.5),
      evidence: edge.evidence || 'Dependency dari knowledge graph.'
    });
  }

  return edges;
}

function findBlockedTasks(tasks = []) {
  const doneIds = new Set((tasks || []).filter(task => task.status === 'done').map(task => task.id));
  return (tasks || []).filter(task => {
    if (task.status === 'blocked') return true;
    const deps = Array.isArray(task.dependencies) ? task.dependencies : [];
    return deps.some(dep => !doneIds.has(dep));
  });
}

function suggestDependencyOrder(tasks = []) {
  const list = Array.isArray(tasks) ? tasks.slice() : [];
  const done = new Set(list.filter(task => task.status === 'done').map(task => task.id));
  const output = [];
  const remaining = new Map(list.filter(task => task.status !== 'archived').map(task => [task.id, task]));

  while (remaining.size) {
    const ready = Array.from(remaining.values())
      .filter(task => (task.dependencies || []).every(dep => done.has(dep) || !remaining.has(dep)))
      .sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
    if (!ready.length) {
      output.push(...Array.from(remaining.values()));
      break;
    }
    for (const task of ready) {
      output.push(task);
      done.add(task.id);
      remaining.delete(task.id);
    }
  }
  return output;
}

function detectCircularDependencies(tasks = []) {
  const taskMap = new Map((tasks || []).map(task => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];

  function walk(taskId, path = []) {
    if (visiting.has(taskId)) {
      const start = path.indexOf(taskId);
      cycles.push(path.slice(start >= 0 ? start : 0).concat(taskId));
      return;
    }
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    const task = taskMap.get(taskId);
    for (const dep of task?.dependencies || []) {
      if (taskMap.has(dep)) walk(dep, path.concat(taskId));
    }
    visiting.delete(taskId);
    visited.add(taskId);
  }

  for (const task of taskMap.values()) walk(task.id, []);
  return cycles;
}

module.exports = {
  detectCircularDependencies,
  detectDependencies,
  findBlockedTasks,
  suggestDependencyOrder
};
