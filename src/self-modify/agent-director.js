'use strict';

/**
 * Multi-Agent Director — bot bisa spawn sub-agent dengan role sendiri
 * Sub-agent punya konteks sendiri, bisa generate kode, analisa, research
 */

const codeGenerator = require('./code-generator');

const POOL = [];

/**
 * Spawn sub-agent dengan role spesifik
 */
async function spawnAgent(config, services) {
  const id = 'agent_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const agent = {
    id,
    role: config.role,
    name: config.name || config.role,
    goal: config.goal,
    context: config.context || '',
    createdAt: Date.now(),
    status: 'active',
    tasks: [],
    results: [],
    services
  };
  POOL.push(agent);
  return agent;
}

/**
 * Kirim task ke sub-agent
 */
async function delegateTask(agentId, task, services) {
  const agent = POOL.find(a => a.id === agentId);
  if (!agent) return { ok: false, error: 'Agent not found' };

  const taskId = 'task_' + Date.now().toString(36);
  agent.tasks.push({ id: taskId, task, status: 'running' });

  try {
    const prompt = [
      `Kamu adalah agent ${agent.role} — ${agent.name}.`,
      agent.context ? `\nContext:\n${agent.context}` : '',
      `\nTugas:\n${task}`,
      '\nJawab dengan hasil kerja kamu.'
    ].join('\n');

    const result = await services.askAI(
      `Kamu adalah ${agent.role} specialist AI. Selesaikan tugas berikut.`,
      prompt,
      { temperature: 0.3, maxTokens: 2000 }
    );

    agent.results.push({ taskId, result, ts: Date.now() });
    // update task status
    const t = agent.tasks.find(t => t.id === taskId);
    if (t) t.status = 'completed';

    return { ok: true, agentId, taskId, result };
  } catch (e) {
    const t = agent.tasks.find(t => t.id === taskId);
    if (t) t.status = 'failed';
    return { ok: false, error: e.message };
  }
}

/**
 * Spawn + delegate dalam 1 langkah
 */
async function runAgent(role, goal, context, services) {
  const agent = await spawnAgent({ role, goal, context }, services);
  return delegateTask(agent.id, goal, services);
}

/**
 * Council deliberation — kumpulin beberapa sub-agent bahas masalah
 */
async function councilDebate(topic, roles, services) {
  const opinions = [];

  for (const role of roles) {
    const r = await runAgent(role, `Analisa masalah berikut dari sudut pandang ${role}: ${topic}`, '', services);
    if (r.ok) {
      opinions.push({ role, opinion: r.result });
    }
  }

  // Synthesize
  const synthPrompt = [
    'Berikut pendapat dari beberapa specialist tentang suatu masalah:',
    '',
    ...opinions.map(o => `--- ${o.role} ---\n${o.opinion}`),
    '',
    'Buat kesimpulan dan rekomendasi final.'
  ].join('\n');

  const conclusion = await services.askAI(
    'Kamu adalah lead engineer. Sintesis pendapat para specialist.',
    synthPrompt,
    { temperature: 0.2, maxTokens: 1500 }
  );

  return { opinions, conclusion };
}

function listAgents() {
  return POOL.map(a => ({ id: a.id, role: a.role, name: a.name, tasks: a.tasks.length, status: a.status }));
}

module.exports = { spawnAgent, delegateTask, runAgent, councilDebate, listAgents };
