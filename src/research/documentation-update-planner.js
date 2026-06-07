'use strict';

const store = require('./research-store');
const utils = require('./research-utils');

function detectAffectedDocs(docDraft = {}, services = {}) {
  const docs = Array.isArray(docDraft.affectedDocs) ? docDraft.affectedDocs : [];
  if (docs.length) return docs.map((doc) => utils.sanitizeText(doc, 160));
  const type = String(docDraft.docType || '').toLowerCase();
  if (type.includes('env')) return ['.env.example', 'docs/RENDER_DEPLOYMENT.md'];
  if (type.includes('command')) return ['docs/COMMANDS.md'];
  if (type.includes('phase')) return ['README.md', 'docs/AGENT_HANDOFF.md'];
  return ['README.md'];
}

async function createDocumentationUpdatePlan(docDraft = {}, services = {}) {
  if (utils.containsSecretLike(docDraft)) return { ok: false, reason: 'SECRET_LIKE_DOC_DRAFT_REJECTED', status: 400 };
  const plan = {
    id: utils.createId('docs_update_plan'),
    workspaceId: utils.resolveWorkspaceId(docDraft, services),
    userId: utils.resolveUserId(docDraft, services),
    draftId: docDraft.id || '',
    topic: utils.sanitizeText(docDraft.topic || 'Documentation update', 180),
    affectedDocs: detectAffectedDocs(docDraft, services),
    proposedChanges: [
      'Review draft against current repo docs.',
      'Patch only affected docs after explicit approval.',
      'Run docs/dashboard route tests if command/dashboard docs changed.'
    ],
    requiresEvaluation: true,
    requiresExecutorApproval: true,
    status: 'proposal_ready',
    createdAt: utils.nowIso(),
    updatedAt: utils.nowIso(),
    draftPreview: utils.sanitizeText(docDraft.body || '', 1600)
  };
  await store.upsertResearchItem(store.RESEARCH_DOC_PLANS_KEY, plan, services);
  await utils.auditResearch('research/docs_update_plan_created', {
    workspaceId: plan.workspaceId,
    userId: plan.userId,
    targetId: plan.id,
    summary: { affectedDocs: plan.affectedDocs, requiresEvaluation: true }
  }, services);
  return { ok: true, updatePlan: plan };
}

async function createDocsUpdateProposal(updatePlan = {}, services = {}) {
  if (utils.containsSecretLike(updatePlan)) return { ok: false, reason: 'SECRET_LIKE_DOC_PLAN_REJECTED', status: 400 };
  const proposal = {
    id: utils.createId('docs_proposal'),
    workspaceId: utils.resolveWorkspaceId(updatePlan, services),
    userId: utils.resolveUserId(updatePlan, services),
    sourceType: 'documentation_update_plan',
    sourceId: updatePlan.id || '',
    title: `Docs update proposal: ${utils.sanitizeText(updatePlan.topic || 'Documentation update', 120)}`,
    status: 'pending_approval',
    requiresEvaluation: true,
    requiresExecutorApproval: true,
    directFileWrite: false,
    riskLevel: 'medium',
    affectedDocs: updatePlan.affectedDocs || [],
    nextPrompt: createNextCodexOpenCodeDocsPrompt(updatePlan, services).prompt,
    createdAt: utils.nowIso()
  };
  await utils.auditResearch('research/docs_proposal_created', {
    workspaceId: proposal.workspaceId,
    userId: proposal.userId,
    targetId: proposal.id,
    summary: { affectedDocs: proposal.affectedDocs, directFileWrite: false }
  }, services);
  return { ok: true, proposal };
}

function createNextCodexOpenCodeDocsPrompt(updatePlan = {}, services = {}) {
  const files = detectAffectedDocs(updatePlan, services);
  const prompt = [
    'TASK: Apply approved documentation update',
    '',
    'Rules:',
    '- CommonJS/Node.js project constraints remain unchanged.',
    '- Do not expose secrets or env values.',
    '- Edit only approved documentation files.',
    '- Run listed tests and report PASS/FAIL/SKIPPED.',
    '',
    'Files to review/edit:',
    ...files.map((file) => `- ${file}`),
    '',
    'Proposed changes:',
    ...(updatePlan.proposedChanges || []).map((item) => `- ${item}`),
    '',
    'Tests:',
    '- node --check telebot.js',
    '- node scratch/test-dashboard-router-registry.js if dashboard docs/routes changed'
  ].join('\n');
  return { ok: true, prompt: utils.sanitizeText(prompt, 2400) };
}

module.exports = {
  createDocumentationUpdatePlan,
  createDocsUpdateProposal,
  createNextCodexOpenCodeDocsPrompt,
  detectAffectedDocs
};

