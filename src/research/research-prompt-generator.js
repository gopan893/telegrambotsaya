'use strict';

const utils = require('./research-utils');

function generateCodexPromptFromResearch(taskId, services = {}) {
  const base = buildBasePrompt(taskId, services);
  return {
    target: 'Codex',
    prompt: [
      base.goal,
      base.context,
      base.constraints,
      base.implementationPlan,
      base.safetyRules,
      'Tests: jalankan test terkait setelah implementasi.',
      'Commit: gunakan format conventional commit.'
    ].join('\n\n')
  };
}

function generateOpenCodePromptFromResearch(taskId, services = {}) {
  const base = buildBasePrompt(taskId, services);
  return {
    target: 'OpenCode',
    prompt: [
      base.goal,
      base.context,
      base.constraints,
      base.implementationPlan,
      base.safetyRules,
      'Tests: jalankan test terkait setelah implementasi.',
      'Commit: gunakan format conventional commit.'
    ].join('\n\n')
  };
}

function generateHermesPromptFromResearch(taskId, services = {}) {
  const base = buildBasePrompt(taskId, services);
  return {
    target: 'Hermes',
    prompt: [
      base.goal,
      base.context,
      base.constraints,
      base.implementationPlan,
      base.safetyRules,
      'Tests: jalankan test terkait setelah implementasi.',
      'Commit: gunakan format conventional commit.'
    ].join('\n\n')
  };
}

function generateSecurityReviewPromptFromResearch(taskId, services = {}) {
  return {
    target: 'Security',
    prompt: `Review keamanan untuk riset task ${taskId}:\n- Periksa secret exposure\n- Periksa permission boundaries\n- Periksa approval bypass paths\n- Laporkan findings tanpa raw secrets`
  };
}

function generateDocsUpdatePromptFromResearch(taskId, services = {}) {
  return {
    target: 'Docs',
    prompt: `Update dokumentasi berdasarkan riset task ${taskId}:\n- Periksa docs gap\n- Buat update plan\n- Proposal-only — jangan langsung write`
  };
}

function buildBasePrompt(taskId, services = {}) {
  return {
    goal: `Implementasi berdasarkan riset task: ${taskId}`,
    context: 'Berdasarkan hasil riset dan implementation plan.',
    constraints: 'CommonJS, Node 20, no TS, no React, no external write, proposal-only untuk write/danger.',
    implementationPlan: 'Lihat implementation plan dari task.',
    safetyRules: 'No auto-approve, no auto-run, no secret exposure, proposal-only untuk external write.'
  };
}

module.exports = { generateCodexPromptFromResearch, generateOpenCodePromptFromResearch, generateHermesPromptFromResearch, generateSecurityReviewPromptFromResearch, generateDocsUpdatePromptFromResearch };
