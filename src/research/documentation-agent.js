'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./research-utils');

const DOC_TYPE_MAP = {
  readme: 'README',
  env: 'env guide',
  command: 'commands guide',
  commands: 'commands guide',
  architecture: 'architecture map',
  testing: 'testing guide',
  deploy: 'deployment guide',
  deployment: 'deployment guide',
  incident: 'incident guide',
  troubleshooting: 'troubleshooting guide',
  phase: 'phase summary'
};

function detectDocTypeNeeded(input = {}) {
  const text = `${input.topic || ''} ${input.question || ''} ${input.text || ''}`.toLowerCase();
  for (const [key, type] of Object.entries(DOC_TYPE_MAP)) {
    if (text.includes(key)) return type;
  }
  if (/env|environment|variable|token|api key/.test(text)) return 'env guide';
  if (/phase\s*\d+|fase\s*\d+/.test(text)) return 'phase summary';
  return 'documentation update';
}

function docCandidatesForType(docType) {
  const map = {
    README: ['README.md'],
    'env guide': ['.env.example', 'docs/RENDER_DEPLOYMENT.md', 'docs/DASHBOARD_API.md'],
    'commands guide': ['docs/COMMANDS.md'],
    'architecture map': ['docs/ARCHITECTURE_MAP.md', 'docs/ARCHITECTURE.md'],
    'integration contract': ['docs/INTEGRATION_CONTRACT.md'],
    'testing guide': ['docs/TESTING.md'],
    'deployment guide': ['docs/RENDER_DEPLOYMENT.md', 'docs/DEPLOYMENT_RELEASE_MANAGER.md'],
    'incident guide': ['docs/INCIDENT_RESPONSE_CENTER.md', 'docs/PRODUCTION_OBSERVABILITY.md'],
    'troubleshooting guide': ['docs/RENDER_DEPLOYMENT.md', 'docs/ROOT_CAUSE_ANALYSIS.md'],
    'phase summary': ['README.md', 'docs/AGENT_HANDOFF.md']
  };
  return map[docType] || ['README.md', 'docs/COMMANDS.md'];
}

function reviewExistingDocsForTopic(topic = '', services = {}) {
  const root = process.cwd();
  const files = ['README.md', 'AGENTS.md', 'docs/COMMANDS.md', 'docs/ARCHITECTURE_MAP.md', 'docs/INTEGRATION_CONTRACT.md', 'docs/TESTING.md'];
  const query = String(topic || '');
  return files.map((file) => {
    const full = path.resolve(root, file);
    if (!full.startsWith(root) || !fs.existsSync(full)) return null;
    const content = fs.readFileSync(full, 'utf8');
    return {
      docPath: file,
      exists: true,
      relevance: Math.round(utils.textScore(query, `${file} ${content.slice(0, 10000)}`) * 100),
      excerpt: utils.sanitizeText(content.split(/\n+/).find((line) => utils.textScore(query, line) > 0) || content.slice(0, 220), 360)
    };
  }).filter(Boolean).sort((a, b) => b.relevance - a.relevance);
}

function analyzeDocumentationNeed(input = {}, services = {}) {
  const docType = detectDocTypeNeeded(input);
  const topic = utils.sanitizeText(input.topic || input.question || input.text || docType, 180);
  const existingDocs = reviewExistingDocsForTopic(topic, services);
  const relevant = existingDocs.filter((doc) => doc.relevance >= 20);
  return {
    ok: true,
    topic,
    docType,
    existingDocs,
    needsUpdate: relevant.length === 0 || /update|sinkron|belum|missing|gap|phase|env|troubleshoot/i.test(`${input.topic || ''} ${input.question || ''} ${input.text || ''}`),
    reason: relevant.length ? 'Relevant local docs exist; review/update plan can be generated.' : 'No highly relevant local doc section found.'
  };
}

function createDocumentationPlan(input = {}, services = {}) {
  const need = analyzeDocumentationNeed(input, services);
  const affectedDocs = docCandidatesForType(need.docType);
  return {
    ok: true,
    plan: {
      id: utils.createId('doc_plan'),
      workspaceId: utils.resolveWorkspaceId(input, services),
      userId: utils.resolveUserId(input, services),
      topic: need.topic,
      docType: need.docType,
      affectedDocs,
      sections: buildRecommendedSections(need.docType, need.topic),
      assumptions: ['Draft is generated from local docs/research evidence only.', 'No file will be written without explicit approval.'],
      limitations: ['Live provider docs require a configured read-only source connector.'],
      needsUpdate: need.needsUpdate,
      createdAt: utils.nowIso()
    },
    need
  };
}

function buildRecommendedSections(docType, topic) {
  if (docType === 'env guide') return ['Purpose', 'Required env names', 'Optional env names', 'Security notes', 'Render setup'];
  if (docType === 'troubleshooting guide') return ['Symptom', 'Likely causes', 'Checks', 'Safe mitigation', 'When to create proposal'];
  if (docType === 'phase summary') return ['Summary', 'Files changed', 'Commands/API', 'Tests', 'Limitations'];
  if (docType === 'commands guide') return ['Commands', 'Permission level', 'Safety behavior', 'Examples'];
  return ['Overview', 'Current behavior', 'Usage', 'Security', 'Tests', 'Limitations'];
}

function buildDocumentationRecommendation(input = {}, services = {}) {
  const result = createDocumentationPlan(input, services);
  return {
    ok: true,
    recommendation: result.plan.needsUpdate
      ? `Buat draft ${result.plan.docType} untuk ${result.plan.topic}, lalu ajukan docs update proposal.`
      : `Dokumentasi terkait ${result.plan.topic} sudah ada; review sinkronisasi sebelum update.`,
    plan: result.plan
  };
}

module.exports = {
  analyzeDocumentationNeed,
  buildDocumentationRecommendation,
  createDocumentationPlan,
  detectDocTypeNeeded,
  reviewExistingDocsForTopic
};

