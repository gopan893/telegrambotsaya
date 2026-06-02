'use strict';

const agentRegistry = require('./agent-registry');
const promptComposer = require('./agent-prompt-composer');
const taskQueue = require('./agent-task-queue');
const taskStore = require('./agent-task-store');
const utils = require('./delegation-utils');

function buildReasoningChecklist(task = {}, agent = {}) {
  const type = task.type || 'planning';
  if (type === 'ops_check') {
    return [
      'Cek health endpoint, webhook URL, env wajib, dan log deploy terakhir.',
      'Pastikan storage driver, PostgreSQL/Redis fallback, dan migration status sehat.',
      'Isolasi perubahan terakhir sebelum deploy.'
    ];
  }
  if (type === 'coding_review') {
    return [
      'Cari modul yang paling dekat dengan request.',
      'Buat perubahan kecil dan terukur.',
      'Jalankan syntax/regression test yang relevan.'
    ];
  }
  if (type === 'risk_review') {
    return [
      'Identifikasi write/external/danger action.',
      'Pastikan approval eksplisit sebelum aksi berisiko.',
      'Jangan menyimpan atau menampilkan secret.'
    ];
  }
  if (type === 'research_note') {
    return [
      'Pisahkan asumsi dari fakta.',
      'Jika butuh data terbaru, gunakan search/tool yang aman.',
      'Ringkas opsi dan trade-off.'
    ];
  }
  if (type === 'memory_review') {
    return [
      'Ambil hanya memory relevan dan user-scoped.',
      'Jangan membawa konteks file/visual lama kecuali diminta.',
      'Simpan summary aman jika berguna.'
    ];
  }
  if (type === 'decision_support') {
    return [
      'Tentukan opsi utama.',
      'Bandingkan pro/kontra, risiko, dan reversibility.',
      'Rekomendasikan langkah kecil yang aman.'
    ];
  }
  return [
    'Pecah scope menjadi langkah kecil.',
    'Urutkan prioritas berdasar impact, risiko, dan effort.',
    'Akhiri dengan next step yang bisa langsung dikerjakan.'
  ];
}

function composeTaskPrompt(task = {}, agent = {}, context = {}, services = {}) {
  return [
    `Agent: ${agent.displayName || agent.id || task.assignedAgentId || 'orchestrator'}`,
    `Task type: ${task.type}`,
    `Risk: ${task.riskLevel}`,
    `Expected output: ${task.expectedOutput || '-'}`,
    '',
    `Input: ${utils.sanitizeDelegationText(task.input || task.description || '', { max: 1000 })}`,
    '',
    'Batasan: reasoning/planning only, no external/write/danger execution, no private reasoning details.'
  ].join('\n');
}

async function executeAgentReasoningTask(task = {}, services = {}) {
  const agent = agentRegistry.getAgent(task.assignedAgentId || 'orchestrator', services) || agentRegistry.getAgent('orchestrator', services) || {};
  let memoryExplanation = '';
  try {
    const composed = await promptComposer.composeAgentFinalPrompt(agent.id || 'orchestrator', task.input || task.description || '', {
      workspaceId: task.workspaceId,
      userId: task.userId,
      topics: [task.type],
      risk: task.riskLevel,
      mode: 'delegation_task'
    }, services);
    memoryExplanation = composed?.memoryExplanation || '';
  } catch (_) {
    memoryExplanation = 'Memory agent tidak tersedia; task memakai fallback reasoning.';
  }

  const checklist = buildReasoningChecklist(task, agent);
  const needsProposal = task.requiresApproval || utils.requiresApprovalForText(`${task.input} ${task.description}`, task.riskLevel);
  const summary = [
    `${agent.displayName || agent.id || 'Agent'} menyelesaikan ${task.type}.`,
    `Fokus: ${utils.sanitizeDelegationText(task.title || task.description, { max: 180 })}`,
    needsProposal ? 'Catatan: aksi write/external/danger harus menjadi executor proposal, bukan direct run.' : '',
    memoryExplanation ? `Konteks: ${utils.sanitizeDelegationText(memoryExplanation, { max: 220 })}` : ''
  ].filter(Boolean).join(' ');

  return sanitizeTaskResult({
    taskId: task.id,
    agentId: agent.id || task.assignedAgentId,
    promptPreview: composeTaskPrompt(task, agent, {}, services).slice(0, 900),
    summary,
    checklist,
    recommendations: checklist.slice(0, 3),
    proposalRecommendation: needsProposal ? 'Buat executor proposal dan minta approval eksplisit sebelum menjalankan aksi.' : '',
    confidence: needsProposal ? 0.58 : 0.72
  });
}

function sanitizeTaskResult(result = {}) {
  const text = JSON.stringify(result || {});
  const safe = utils.sanitizeDelegationPayload(result);
  if (/chain[-\s]?of[-\s]?thought|internal reasoning/i.test(text)) {
    safe.hiddenReasoningRemoved = true;
  }
  return safe;
}

function buildTaskResultSummary(result = {}) {
  return utils.sanitizeDelegationText([
    result.summary || '',
    (result.recommendations || []).slice(0, 2).join(' '),
    result.proposalRecommendation || ''
  ].filter(Boolean).join(' '), { max: 700 });
}

async function handleTaskRunnerFailure(task, error, services = {}) {
  return taskQueue.markAgentTaskFailed(task.id, error, services);
}

async function runAgentTask(taskId, services = {}) {
  const task = await taskStore.getTask(taskId, services);
  if (!task) throw new Error('AGENT_TASK_NOT_FOUND');
  try {
    await taskQueue.markAgentTaskRunning(taskId, services);
    const result = await executeAgentReasoningTask(task, services);
    return await taskQueue.markAgentTaskCompleted(taskId, {
      ...result,
      resultSummary: buildTaskResultSummary(result)
    }, services);
  } catch (err) {
    return handleTaskRunnerFailure(task, err, services);
  }
}

module.exports = {
  buildTaskResultSummary,
  composeTaskPrompt,
  executeAgentReasoningTask,
  handleTaskRunnerFailure,
  runAgentTask,
  sanitizeTaskResult
};
