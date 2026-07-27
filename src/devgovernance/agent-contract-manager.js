'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./devgovernance-utils');
const store = require('./devgovernance-store');

const REQUIRED_SECTIONS = [
  'Project Rules', 'Forbidden', 'Security', 'Approval rules',
  'Dashboard rules', 'Known dashboard tabs', 'Agent routing rules',
  'Integration rule', 'Module creation check', 'Testing rule', 'Commit rules'
];

const DEFAULT_CONTRACT = `# AGENTS.md

## Project Rules

Project: Telegram AI OS.

Runtime:
- Node.js 20
- CommonJS only
- Express webhook
- Vanilla HTML/CSS/JS dashboard
- PostgreSQL primary
- Redis optional/fallback

## Forbidden

- No TypeScript
- No React/Next/Vue
- No large refactor
- No shell executor
- No direct GitHub/email/calendar/webhook write
- No direct repo mutation from bot runtime
- No auto-approve
- No auto-run write/external/danger actions
- No secret/token/env exposure

## Security

Never print/log values from:
- TELEGRAM_TOKEN
- DATABASE_URL
- REDIS_URL
- DASHBOARD_ADMIN_TOKEN
- API keys
- GITHUB_TOKEN
- GOOGLE_CLIENT_SECRET
- CLOUDFLARE_API_TOKEN

Redact secrets as:
[REDACTED_SECRET]

## Approval rules

Write/external/danger actions must go through:

dry-run
→ Evaluation v2
→ executor proposal
→ approval
→ run

## Dashboard rules

- Known tabs must not fallback to System Overview.
- Unknown tabs may fallback to Overview.
- Service worker must not cache /api/dashboard/*.
- input/select/textarea must use dark UI.

## Known dashboard tabs

overview, ops-viewer, workspaces, users, permissions, memory,
goals, workflows, planner, executor, agents, tools, integrations,
backup, insights, agent-evaluation, coding-workspace, release,
routines, selfhealing, monitoring, cicd, devgovernance.

## Agent routing rules

- Personal/school/emotional chat → orchestrator/reflection.
- Coding/error/deploy chat → coder/ops/critic.
- Restore/delete/secret/external write → security/executor.
- Short follow-up must use replied message or latest relevant context.
- No stale file-analysis note in normal chat.

## Integration rule

Before creating/editing feature, inspect existing modules first.
Do not duplicate systems.
Reuse existing modules when possible.
If new module is necessary, connect it to entry point or route, dashboard/frontend, API client, test file, and handoff.
If two modules overlap, pick one canonical and document the other.

## Module creation check

Before creating any new file/module:
1. Search existing modules in src/ for similar functionality.
2. If similar module exists, reuse/extend it — do NOT duplicate.
3. Only create new module if no suitable existing module found.
4. Connect new module to entry point, dashboard, tests, and docs.

## Testing rule

Always run:
- node --check telebot.js

Run existing related scratch tests.
If test file is missing, report SKIPPED honestly.
Do not invent passing results.

## Commit rules

- Do NOT commit unless explicitly asked.
- Before committing, inspect git status and git diff.
- Write concise commit messages matching repo style.
- Do NOT commit secrets or .env files.
`;

const CONTRACT_SUMMARY = {
  ok: true,
  hasAllRequiredSections: true,
  sectionCount: 11,
  sections: REQUIRED_SECTIONS,
  lastValidated: null
};

function _getContractPath(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const candidates = [
    path.join(repoRoot, 'AGENTS.md'),
    path.join(repoRoot, 'docs', 'AGENTS.md')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function ensureAgentContractExists(services) {
  const cp = _getContractPath(services);
  if (fs.existsSync(cp)) {
    const content = fs.readFileSync(cp, 'utf8');
    const missing = REQUIRED_SECTIONS.filter(s => !content.includes(`## ${s}`));
    if (missing.length === 0) {
      return { ok: true, path: cp, existed: true };
    }
    fs.appendFileSync(cp, `\n\n## Missing sections (auto-appended)\n\n${missing.map(s => `- ${s}: [TODO]`).join('\n')}\n`, 'utf8');
    return { ok: true, path: cp, existed: true, appendedMissing: missing };
  }
  fs.writeFileSync(cp, DEFAULT_CONTRACT, 'utf8');
  return { ok: true, path: cp, created: true };
}

function readAgentContract(services) {
  const cp = _getContractPath(services);
  if (!fs.existsSync(cp)) return { ok: false, error: 'AGENTS.md not found' };
  const content = fs.readFileSync(cp, 'utf8');
  return { ok: true, path: cp, content, length: content.length };
}

function validateAgentContract(services) {
  const result = readAgentContract(services);
  if (!result.ok) return { ok: false, errors: [result.error] };

  const content = result.content;
  const errors = [];
  const warnings = [];
  const sections = REQUIRED_SECTIONS.filter(s => content.includes(`## ${s}`));

  if (sections.length < REQUIRED_SECTIONS.length) {
    const missing = REQUIRED_SECTIONS.filter(s => !content.includes(`## ${s}`));
    errors.push(`Missing required sections: ${missing.join(', ')}`);
  }

  if (!content.includes('[REDACTED_SECRET]')) {
    warnings.push('No [REDACTED_SECRET] placeholder found');
  }

  const forbidden = [
    'No TypeScript', 'No React/Next/Vue', 'No large refactor',
    'No shell executor', 'No auto-approve'
  ];
  for (const f of forbidden) {
    if (!content.includes(f)) {
      warnings.push(`Missing forbidden rule: ${f}`);
    }
  }

  const hasRedact = content.includes('[REDACTED_SECRET]');
  const hasDryRun = content.includes('dry-run');

  CONTRACT_SUMMARY.lastValidated = utils.now();
  CONTRACT_SUMMARY.hasAllRequiredSections = errors.length === 0;
  CONTRACT_SUMMARY.sectionCount = sections.length;

  const passed = errors.length === 0;
  return {
    ok: passed,
    passed,
    errors,
    warnings,
    summary: {
      sectionCount: sections.length,
      hasRedactSection: hasRedact,
      hasDryRunApprovalFlow: hasDryRun,
      hasAllRequiredSections: errors.length === 0
    }
  };
}

function updateAgentContractSection(section, content, services) {
  const cp = _getContractPath(services);
  if (!fs.existsSync(cp)) {
    ensureAgentContractExists(services);
  }
  const existing = fs.readFileSync(cp, 'utf8');
  const sectionHeader = `## ${section}`;
  const sectionPattern = new RegExp(`${sectionHeader}[\\s\\S]*?(?=\\n## |\\n$|$)`);
  if (sectionPattern.test(existing)) {
    const updated = existing.replace(sectionPattern, `${sectionHeader}\n\n${content}`);
    fs.writeFileSync(cp, updated, 'utf8');
  } else {
    fs.appendFileSync(cp, `\n${sectionHeader}\n\n${content}\n`, 'utf8');
  }
  return { ok: true, section };
}

function getAgentContractSummary(services) {
  const result = readAgentContract(services);
  if (!result.ok) return result;
  const validation = validateAgentContract(services);
  return {
    ok: true,
    exists: true,
    path: result.path,
    length: result.length,
    validation
  };
}

module.exports = {
  ensureAgentContractExists,
  readAgentContract,
  validateAgentContract,
  updateAgentContractSection,
  getAgentContractSummary
};
