'use strict';

const utils = require('./release-utils');

const PHASES = [
  { phase: 'Phase 1-18', description: 'Foundation, core bot, basic memory, dashboard, agents, executor' },
  { phase: 'Phase 19', description: 'Backup & Recovery, PWA support, export/import' },
  { phase: 'Phase 20-28', description: 'Multi-bot, agent council, debate, delegation, decision system' },
  { phase: 'Phase 29-32', description: 'Coding Workspace, regression testing, research agent' },
  { phase: 'Phase 33-35', description: 'Self-healing, monitoring, CI/CD, Dev Governance' },
  { phase: 'Phase 36', description: 'Deploy/Release Manager, Render deploy gate, rollback' },
  { phase: 'Phase 37', description: 'Production Observability, Incident Response Center' },
  { phase: 'Phase 38', description: 'Cost/Token/Budget Governance' },
  { phase: 'Phase 39-40', description: 'Operator Agent, Semi-Autonomous Project Operator' },
  { phase: 'Phase 41', description: 'Multi-Project Portfolio Manager' },
  { phase: 'Phase 42', description: 'Knowledge Graph, Decision Memory' },
  { phase: 'Phase 43', description: 'Research/Docs Agent' },
  { phase: 'Phase 44', description: 'Personal Life OS' },
  { phase: 'Phase 44.5', description: 'Universal Telegram Control Layer' },
  { phase: 'Phase 45', description: 'Stable Autonomous Operating Loop' },
  { phase: 'Phase 46', description: 'Continuous Improvement & Learning Engine' },
  { phase: 'Phase 47', description: 'Unified Governance Policy Engine & Capability Control Center' },
  { phase: 'Phase 48', description: 'Security Hardening & Red-Team Safety Audit' },
  { phase: 'Phase 49', description: 'Privacy, Data Retention & Export Control' },
  { phase: 'Phase 50', description: 'Stable AI OS v1 Release Candidate — freeze, readiness gates, release docs' }
];

async function generateChangelogSinceLastRelease(services = {}) {
  const groupedByPhase = await groupChangesByPhase(services);
  const groupedByModule = await groupChangesByModule(services);
  const humanReadable = await buildHumanReadableChangelog(services);

  return {
    version: 'v1.0.0-rc.1',
    previousVersion: 'v0.0.0 (initial release candidate)',
    date: utils.formatTimestamp(),
    groupedByPhase,
    groupedByModule,
    humanReadable,
    totalPhases: PHASES.length
  };
}

async function groupChangesByPhase(services = {}) {
  return PHASES.map(p => ({
    ...p,
    summary: p.description,
    changes: []
  }));
}

async function groupChangesByModule(services = {}) {
  return {
    core: ['Telegram bot with Express webhook', 'PostgreSQL + Redis + JSON storage', 'Multi-agent architecture'],
    dashboard: ['40+ dashboard tabs', 'PWA support with service worker', 'Mobile responsive design'],
    governance: ['Unified Governance Policy Engine', 'Capability Control Center', 'Action Policy Simulator'],
    security: ['Security audit center', 'Secret surface scanner', 'Red-team simulator', 'Security scorecard'],
    privacy: ['Data inventory scanner', 'Privacy policy engine', 'Retention policy', 'Export control'],
    telegram: ['Universal Telegram Control Layer', '250+ commands', 'Natural language routing'],
    devops: ['Deploy/Release manager', 'GitHub Ops pipeline', 'CI/CD quality gates'],
    lifeos: ['Personal Life OS', 'Daily/weekly planner', 'Habit/reminder trackers'],
    improvement: ['Continuous Improvement engine', 'Feedback/outcome collectors', 'Weakness/pattern detection']
  };
}

async function buildHumanReadableChangelog(services = {}) {
  let changelog = '## Stable AI OS v1.0.0-rc.1\n\n';
  changelog += 'This is the first Release Candidate for Stable AI OS v1.\n\n';

  for (const p of PHASES) {
    changelog += `### ${p.phase}: ${p.description}\n`;
    changelog += `- ${p.description}\n\n`;
  }

  changelog += '### Key Safety Features\n';
  changelog += '- All write/external/danger actions require Evaluation v2 + executor approval\n';
  changelog += '- No auto-approve, no auto-run, no shell executor\n';
  changelog += '- Secrets redacted in all outputs\n';
  changelog += '- Hard delete blocked by default\n';
  changelog += '- Bot-to-bot loop prevention\n';
  changelog += '- Dashboard known tabs never fallback to Overview\n';
  changelog += '- Service worker never caches /api/dashboard/*\n';

  return changelog;
}

module.exports = {
  generateChangelogSinceLastRelease,
  groupChangesByPhase,
  groupChangesByModule,
  buildHumanReadableChangelog,
  PHASES
};
