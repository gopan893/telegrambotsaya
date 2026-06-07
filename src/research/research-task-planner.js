'use strict';

const store = require('./research-store');
const safetyGate = require('./research-safety-gate');
const utils = require('./research-utils');

function classifyResearchScope(input = {}) {
  const text = `${input.scope || ''} ${input.topic || ''} ${input.question || ''}`.toLowerCase();
  if (/env|environment|variabel|configuration|config/.test(text)) return 'project_docs';
  if (/render|deploy|deployment|rollback|webhook|status 1|crash/.test(text)) return 'deployment';
  if (/security|secret|token|credential|permission|auth/.test(text)) return 'security';
  if (/cost|budget|token usage|model|pricing|biaya/.test(text)) return 'cost';
  if (/architecture|arsitektur|module|dashboard|route|database|redis|postgres/.test(text)) return 'architecture';
  if (/troubleshoot|error|gagal|failed|bug|fix|exited/.test(text)) return 'troubleshooting';
  if (/api|sdk|provider|openai|mistral|tavily|github|google/.test(text)) return 'api_docs';
  if (/tool|connector|integration|external/.test(text)) return 'external_tools';
  if (/research|riset|best practice|cara terbaik/.test(text)) return 'technical_research';
  return utils.normalizeScope(input.scope || 'general');
}

function defineResearchQuestions(input = {}) {
  const primary = utils.sanitizeText(input.question || input.topic || input.text || 'Research task', 260);
  const scope = classifyResearchScope(input);
  const base = [primary];
  if (scope === 'deployment') base.push('Apa constraint deployment project ini?', 'Sumber lokal/official apa yang mendukung mitigasi?');
  if (scope === 'project_docs') base.push('Dokumentasi lokal mana yang sudah ada?', 'Bagian apa yang belum sinkron?');
  if (scope === 'api_docs') base.push('Apakah perlu official docs terbaru?', 'Apa yang belum bisa diverifikasi tanpa connector?');
  if (scope === 'security') base.push('Apakah input mengandung secret?', 'Apa batasan penyimpanan dan approval?');
  if (scope === 'cost') base.push('Apakah Cost/Budget Guard tersedia?', 'Bagaimana cara menekan biaya riset?');
  if (base.length === 1) base.push('Sumber apa yang tersedia?', 'Apa gaps atau unknowns terbesar?');
  return [...new Set(base)].slice(0, 8);
}

function defineSourceRequirements(task = {}) {
  const scope = task.scope || classifyResearchScope(task);
  const requirements = {
    requiredTypes: ['project_doc', 'knowledge'],
    optionalTypes: [],
    freshness: 'medium',
    officialPreferred: false,
    externalSearchNeeded: false,
    costGuardNeeded: false
  };
  if (['api_docs', 'external_tools'].includes(scope)) {
    requirements.optionalTypes.push('web', 'connector');
    requirements.freshness = 'high';
    requirements.officialPreferred = true;
    requirements.externalSearchNeeded = true;
    requirements.costGuardNeeded = true;
  }
  if (scope === 'deployment') {
    requirements.optionalTypes.push('web');
    requirements.freshness = 'high';
    requirements.officialPreferred = true;
  }
  if (scope === 'project_docs' || scope === 'architecture') {
    requirements.freshness = 'local_repo_truth';
  }
  return requirements;
}

function buildResearchPlan(task = {}) {
  const sourceRequirements = task.sourceRequirements || defineSourceRequirements(task);
  const riskLevel = task.scope === 'security' ? 'medium' : 'low';
  return {
    primaryQuestion: task.question,
    subquestions: utils.safeArray(task.researchQuestions).slice(0, 8),
    requiredSourceTypes: sourceRequirements.requiredTypes,
    optionalSourceTypes: sourceRequirements.optionalTypes,
    freshnessRequirement: sourceRequirements.freshness,
    expectedOutputFormat: task.outputFormat || 'evidence_brief',
    riskLevel,
    externalSearchNeeded: sourceRequirements.externalSearchNeeded,
    costGuardNeeded: sourceRequirements.costGuardNeeded,
    approvalRequiredForWrites: true,
    notes: sourceRequirements.externalSearchNeeded
      ? 'External search is optional and read-only; missing connector produces degraded status.'
      : 'Local project docs and knowledge graph are checked first.'
  };
}

async function createResearchTask(input = {}, services = {}) {
  const safety = safetyGate.runResearchSafetyGate(input, services);
  if (!safety.allowed) return { ok: false, reason: safety.reason, safety, status: 400 };
  const safe = safety.sanitizedInput || {};
  const now = utils.nowIso();
  const scope = classifyResearchScope(safe);
  const task = {
    id: safe.id || utils.createId('research_task'),
    workspaceId: utils.resolveWorkspaceId(safe, services),
    userId: utils.resolveUserId(safe, services),
    topic: utils.sanitizeText(safe.topic || safe.question || safe.text || 'Research task', 180),
    question: utils.sanitizeText(safe.question || safe.topic || safe.text || '', 300),
    scope,
    status: 'planned',
    sourceRequirements: {},
    evidence: [],
    findings: [],
    gaps: [],
    linkedKnowledgeNodeIds: [],
    createdAt: now,
    updatedAt: now
  };
  task.researchQuestions = defineResearchQuestions(task);
  task.sourceRequirements = defineSourceRequirements(task);
  task.plan = buildResearchPlan(task);
  await store.upsertResearchItem(store.RESEARCH_TASKS_KEY, task, services);
  await utils.auditResearch('research/task_created', {
    workspaceId: task.workspaceId,
    userId: task.userId,
    targetId: task.id,
    summary: { topic: task.topic, scope: task.scope, externalSearchNeeded: task.plan.externalSearchNeeded }
  }, services);
  return { ok: true, task, plan: task.plan };
}

async function getResearchTask(taskId, services = {}) {
  return store.getResearchItem(store.RESEARCH_TASKS_KEY, taskId, services);
}

async function listResearchTasks(filters = {}, services = {}) {
  return store.listResearchItems(store.RESEARCH_TASKS_KEY, filters, services);
}

module.exports = {
  buildResearchPlan,
  classifyResearchScope,
  createResearchTask,
  defineResearchQuestions,
  defineSourceRequirements,
  getResearchTask,
  listResearchTasks
};

