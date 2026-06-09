'use strict';

const utils = require('./release-utils');

async function generateReleaseNotes(releaseCandidateId, services = {}) {
  const featureSummary = await generateFeatureSummary(services);
  const safetySummary = await generateSafetySummary(services);
  const knownLimitations = await generateKnownLimitations(services);
  const upgradeNotes = await generateUpgradeNotes(services);
  const rollbackNotes = await generateRollbackNotes(services);

  const releaseStore = require('./release-candidate-store');
  const candidate = releaseStore.getReleaseCandidate(releaseCandidateId);

  const notes = {
    title: candidate ? candidate.title : 'Stable AI OS v1 Release Candidate',
    version: candidate ? candidate.version : 'v1.0.0-rc.1',
    date: utils.formatTimestamp(),
    featureSummary,
    safetySummary,
    knownLimitations,
    upgradeNotes,
    rollbackNotes,
    sections: {
      majorCapabilities: featureSummary,
      approvalSafety: safetySummary,
      environmentRequirements: 'See FINAL_ENVIRONMENT_CHECKLIST.md',
      securityNotes: 'See AI_OS_V1_SECURITY_PRIVACY_NOTES.md',
      knownLimitations: 'See AI_OS_V1_KNOWN_LIMITATIONS.md',
      productionReadiness: 'See PRODUCTION_READINESS_CHECKLIST.md'
    },
    timestamp: utils.formatTimestamp()
  };

  return notes;
}

async function generateFeatureSummary(services = {}) {
  return {
    core: [
      'Telegram AI OS base bot with Express webhook and multi-agent architecture',
      'PostgreSQL primary storage with Redis optional caching and JSON fallback',
      'Vanilla HTML/CSS/JS dashboard with PWA support and mobile responsiveness'
    ],
    governance: [
      'Unified Governance Policy Engine with capability control center (Phase 47)',
      'Permission engine with owner/admin/user roles and workspace isolation',
      'Risk engine with 6 levels (read-only to blocked) and danger pattern detection',
      'Secret guard with 21 pattern types and automatic redaction',
      'Approval policy requiring proposals for external_write and danger actions',
      'Evaluation v2 gate for all risky actions',
      'Cost policy with soft failure when cost module is unavailable',
      'Action policy simulator for testing actions, commands, and intents'
    ],
    security: [
      'Security audit center with 8 audit types (Phase 48)',
      'Secret surface scanner across 10+ surfaces with 28 patterns',
      'Environment drift detector checking 50+ expected variables and dangerous flags',
      'Red-team simulator with 13 test cases across 10 attack categories',
      'Prompt injection tester with 16 injection patterns',
      'Security scorecard with 6 sub-scores and overall rating',
      'Credential rotation planner (manual checklists only)'
    ],
    privacy: [
      'Privacy center with data inventory scanning 24 categories (Phase 49)',
      'Data classification engine with 5 sensitivity levels',
      'Retention policy manager with 9 default policies',
      'Export control with strict redaction (no secrets ever exported)',
      'Delete request manager — soft delete only by default',
      'Archive cleanup planner with stale data detection',
      'Life OS privacy guard — mood/energy data is owner-only'
    ],
    telegram: [
      'Universal Telegram Control Layer with ~250 commands across 20 categories',
      'Natural language router with 50+ intent patterns',
      'Permission guard, risk classifier, and rate limiting',
      'Bot-to-bot loop prevention',
      'Session context for short follow-ups within 30-minute windows'
    ],
    devops: [
      'Deploy/Release manager with Render deploy gate',
      'GitHub Ops pipeline with proposal-only write actions',
      'CI/CD quality gates',
      'Rollback plan generator'
    ]
  };
}

async function generateSafetySummary(services = {}) {
  return {
    approvalBoundary: 'All write/external/danger actions require dry-run -> Evaluation v2 -> executor proposal -> approval -> run',
    noAutoApprove: 'AUTO_APPROVE_ENABLED must be false; if true, release is blocked',
    noAutoRun: 'AUTO_RUN_ENABLED must be false; if true, release is blocked',
    noShellExecutor: 'SHELL_EXECUTOR_ENABLED must be false; if true, release is blocked',
    noDirectGitHubWrite: 'GitHub push/tag/release is proposal-only; no direct GitHub write from runtime',
    noDirectDeploy: 'Deploy/rollback is proposal-only; no direct deploy from runtime',
    secretRedaction: 'All secrets redacted in dashboard, audit logs, reports, Telegram output',
    hardDeleteBlocked: 'Hard delete blocked by default; soft delete/archive preferred',
    botLoopPrevention: 'Bot-to-bot loops prevented; bot messages ignored by default'
  };
}

async function generateKnownLimitations(services = {}) {
  return [
    'In-memory stores reset on restart (audit, sessions, rate-limit counters)',
    'No Postgres persistence for governance, security, privacy data (Phase 47-49 scope)',
    'Telegram Control Layer not yet wired to legacy-runtime.js message dispatch',
    'Security/privacy modules standalone; runtime wiring pending',
    'Export generates manifest/report only, not actual file artifacts',
    'Credential rotation is manual-checklist only; no automatic rotation',
    'Research/Docs Agent generates draft proposals only; no direct docs file write',
    'Life OS Gmail/Calendar/routine actions are proposal-only',
    'Operating Loop suggests next actions but cannot auto-release',
    'Dashboard service worker must not cache /api/dashboard/* (enforced)'
  ];
}

async function generateUpgradeNotes(services = {}) {
  return [
    'Minimum Node.js 20 required',
    'PostgreSQL required; Redis optional but recommended',
    'Set DASHBOARD_ADMIN_TOKEN for dashboard access',
    'Configure WEBHOOK_URL, TELEGRAM_TOKEN, OWNER_CHAT_ID for bot operation',
    'Ensure AUTO_APPROVE_ENABLED=false, AUTO_RUN_ENABLED=false, SHELL_EXECUTOR_ENABLED=false',
    'See FINAL_ENVIRONMENT_CHECKLIST.md for complete env requirements',
    'All existing Phase 1-49 features remain compatible'
  ];
}

async function generateRollbackNotes(services = {}) {
  return [
    'Rollback deploy via Render dashboard or render.yaml commit revert',
    'Restore backup via Backup & Recovery dashboard or /restore command',
    'Data archive/delete requests are soft by default; undoable via restore flow',
    'GitHub Operations rollback requires proposal -> approval -> run pipeline',
    'Downgrade: re-deploy previous release tag via deploy proposal'
  ];
}

module.exports = {
  generateReleaseNotes,
  generateFeatureSummary,
  generateSafetySummary,
  generateKnownLimitations,
  generateUpgradeNotes,
  generateRollbackNotes
};
