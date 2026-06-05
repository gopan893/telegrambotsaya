'use strict';

const handoff = require('./handoff-orchestrator');
const promptGen = require('./next-agent-prompt-generator');
const utils = require('./devgovernance-utils');
const collDetector = require('./collision-detector');
const drChecker = require('./dashboard-route-consistency');
const linker = require('./backend-frontend-linker');
const intValidator = require('./integration-contract-validator');

function buildRecoveryResponse(context) {
  const services = context?.services || {};
  const recoveryHandoff = handoff.createRecoveryHandoffFromGitDiff(
    { lastAgent: context?.lastAgent || 'unknown', currentTask: context?.currentTask || 'Recovery dari workflow natural' },
    services
  );
  const prom = promptGen.generateRecoveryPrompt(context);

  return {
    detected: 'Recovery mode: agent interrupted without handoff',
    steps: [
      '1. Baca git diff untuk lihat perubahan terakhir',
      '2. Recovery handoff sudah dibuat',
      '3. Audit P0 dulu — cek dashboard routes, executor boundary, integration gate',
      '4. Patch hanya critical bugs — jangan tambah fitur',
      '5. Jalankan node --check telebot.js dan related tests',
      '6. Update handoff setelah selesai'
    ],
    handoffCreated: recoveryHandoff.ok,
    prompt: utils.maskSecrets(prom)
  };
}

function buildReviewResponse(context) {
  const services = context?.services || {};
  const coll = collDetector.detectCollisions(services);
  const dr = drChecker.validateDashboardRoutes(services);
  const bf = linker.generateLinkReport(services);
  const ic = intValidator.validateIntegrationContract(services);

  const lines = [
    '📋 Review Report',
    '',
    `Collision Check: ${coll.critical.length} critical, ${coll.warnings.length} warnings`,
    `Dashboard Routes: ${dr.critical.length} critical issues`,
    `Backend/Frontend Link: ${bf.results.missing.length} missing routes, ${bf.results.unused.length} unused`,
    `Integration Contract: ${ic.violations.length} violations (${ic.critical.length} critical)`,
    ''
  ];

  if (coll.critical.length) {
    lines.push('⚠️ Critical collisions:');
    coll.critical.forEach(c => lines.push(`  - ${c.message}`));
    lines.push('');
  }
  if (dr.critical.length) {
    lines.push('⚠️ Critical route issues:');
    dr.critical.forEach(c => lines.push(`  - ${c.message}`));
    lines.push('');
  }

  lines.push('Aman untuk lanjut? ' + (coll.critical.length === 0 && dr.critical.length === 0 ? '✅ Ya' : '❌ Tidak — perbaiki P0 dulu'));

  return { report: lines.join('\n'), collision: coll, routes: dr, link: bf, integration: ic };
}

function buildP0Response(context) {
  const services = context?.services || {};
  const dr = drChecker.validateDashboardRoutes(services);
  const coll = collDetector.detectCollisions(services);

  const lines = [
    '🔴 P0 Recovery Mode',
    'Jangan tambah fitur. Hanya patch P0.',
    '',
    'Audit Results:',
    `Dashboard Route Issues: ${dr.critical.length} critical`,
    `Collision Issues: ${coll.critical.length} critical`,
    '',
  ];

  if (dr.critical.length) {
    lines.push('Dashboard Routes to fix:');
    dr.critical.forEach(c => lines.push(`  - ${c.message}`));
  }
  if (coll.critical.length) {
    lines.push('Collisions to fix:');
    coll.critical.forEach(c => lines.push(`  - ${c.message}`));
  }

  const prom = promptGen.generateP0PatchPrompt({ issue: lines.join('; ') });

  return {
    report: lines.join('\n'),
    prompt: utils.maskSecrets(prom)
  };
}

function buildPlanningResponse(context) {
  const services = context?.services || {};
  const phaseMatch = (context?.prompt || '').match(/phase\s*(\d+)/i);
  const phaseNum = phaseMatch ? phaseMatch[1] : 'next';

  const lines = [
    `📐 Phase ${phaseNum} Planning Mode`,
    '',
    'Constraints:',
    '- Node.js 20, CommonJS only',
    '- Vanilla HTML/CSS/JS dashboard',
    '- No TypeScript, No React/Next/Vue',
    '- No large refactor',
    '- No shell executor',
    '- No direct GitHub/email/calendar/webhook write',
    '- No auto-approve, No auto-run',
    '',
    'Before implementing:',
    '1. Search src/ for existing similar modules — do NOT duplicate',
    '2. Check docs/ARCHITECTURE_MAP.md for module groups',
    '3. New tab must have: menu item + registry + renderer + optional route + test',
    '4. New route must have: auth + sanitization + fallback',
    '5. Write action: dry-run → Evaluation v2 → executor proposal → approval → run',
    '6. Update AGENT_HANDOFF.md after completion',
    '7. Run tests and update handoff',
    ''
  ];

  return { report: lines.join('\n') };
}

function buildImplementationResponse(context) {
  const services = context?.services || {};
  const intent = context?.intent || {};
  const policy = require('./dev-workflow-policy').getWorkflowPolicy(intent.intent, services);

  const lines = [
    '🛠️ Implementation Mode',
    '',
    `Agent: ${intent.recommendedAgent || 'codex'}`,
    `Risk Level: ${policy.riskLevel || 'medium'}`,
    '',
    'Must Read:',
    ...policy.mustRead.map(f => `  - ${f}`),
    '',
    'Allowed:',
    ...policy.allowedActions.map(a => `  + ${a}`),
    '',
    'Blocked:',
    ...policy.blockedActions.map(a => `  - ${a}`),
    '',
    'Tests to Run:',
    ...policy.testsToRun.map(t => `  - ${t}`),
    ''
  ];

  return { report: lines.join('\n') };
}

function buildWorkflowResponse(prompt, intent, context) {
  const services = context?.services || {};
  const ctx = { ...context, prompt, services };

  switch (intent.intent) {
    case 'codex_to_opencode_recovery':
      return buildRecoveryResponse(ctx);
    case 'opencode_to_codex_continue': {
      const prom = promptGen.generateNextCodexPrompt(ctx);
      return {
        detected: 'OpenCode → Codex continuation mode',
        steps: [
          '1. Baca AGENT_HANDOFF.md untuk task terakhir',
          '2. Jalankan integration checks',
          '3. Update handoff jika perlu',
          '4. Lanjut task berikutnya'
        ],
        prompt: utils.maskSecrets(prom)
      };
    }
    case 'post_codex_review':
    case 'post_opencode_review':
      return buildReviewResponse(ctx);
    case 'p0_recovery':
      return buildP0Response(ctx);
    case 'phase_planning':
      return buildPlanningResponse(ctx);
    case 'implementation_patch':
      return buildImplementationResponse(ctx);
    case 'audit_only':
    default: {
      const report = buildReviewResponse(ctx);
      return {
        detected: 'Audit-only mode. Tidak ada perubahan kode.',
        report: report.report
      };
    }
  }
}

module.exports = {
  buildRecoveryResponse,
  buildReviewResponse,
  buildP0Response,
  buildPlanningResponse,
  buildImplementationResponse,
  buildWorkflowResponse
};
