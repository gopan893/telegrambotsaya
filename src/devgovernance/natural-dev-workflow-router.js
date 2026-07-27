'use strict';

const intentDetector = require('./dev-workflow-intent-detector');
const policy = require('./dev-workflow-policy');
const promptBuilder = require('./dev-workflow-prompt-builder');
const utils = require('./devgovernance-utils');
const handoff = require('./handoff-orchestrator');

function routeWorkflow(prompt, context = {}) {
  if (!prompt || typeof prompt !== 'string') {
    return {
      ok: false,
      error: 'Prompt diperlukan',
      intent: 'audit_only',
      mode: 'audit'
    };
  }

  const services = context.services || {};
  const repoRoot = services.repoRoot || process.cwd();

  const intent = intentDetector.detectWorkflowIntent(prompt);
  const workflowPolicy = policy.getWorkflowPolicy(intent.intent, services);
  const response = promptBuilder.buildWorkflowResponse(prompt, intent, context);

  const decision = {
    ok: true,
    prompt: utils.maskSecrets(prompt),
    intent: intent.intent,
    confidence: intent.confidence,
    mode: intent.mode,
    recommendedAgent: intent.recommendedAgent,
    ambiguous: intent.ambiguous || false,
    message: intent.message || '',
    policy: workflowPolicy,
    response,
    timestamp: utils.now()
  };

  if (intent.tokenExhausted) {
    decision.tokenExhausted = true;
    decision.warning = 'Token agent habis. Jangan lanjut blind. Recovery handoff sudah dibuat.';
    const recovery = handoff.createRecoveryHandoffFromGitDiff(
      { lastAgent: intent.recommendedAgent, currentTask: prompt },
      services
    );
    decision.recoveryHandoffCreated = recovery.ok;
  }

  if (intent.externalActionRequired) {
    decision.externalActionRequired = true;
    decision.warning = 'External action diminta. Wajib: dry-run → Evaluation v2 → executor proposal → approval → run.';
  }

  if (workflowPolicy.riskLevel === 'critical') {
    decision.critical = true;
    decision.warning = 'P0 critical mode. Block feature work. Hanya patch P0.';
  }

  return decision;
}

function getWorkflowSummary(prompt, context = {}) {
  const decision = routeWorkflow(prompt, context);
  if (!decision.ok) return decision;

  const lines = [
    '🏛️ Natural Workflow Router',
    '',
    `Prompt: "${decision.prompt}"`,
    `Intent: ${decision.intent}`,
    `Confidence: ${(decision.confidence * 100).toFixed(0)}%`,
    `Mode: ${decision.mode}`,
    `Recommended Agent: ${decision.recommendedAgent}`,
    decision.ambiguous ? '\n⚠️ Prompt ambiguous. Default audit/plan.' : '',
    decision.tokenExhausted ? '\n⚠️ Token exhausted. Recovery mode.' : '',
    decision.externalActionRequired ? '\n⚠️ External action requires Evaluation v2.' : '',
    decision.critical ? '\n🔴 P0 critical. Block feature work.' : '',
    '',
    'Allowed:',
    ...decision.policy.allowedActions.map(a => `  + ${a}`),
    '',
    'Blocked:',
    ...decision.policy.blockedActions.map(a => `  - ${a}`),
    ''
  ];

  return { ok: true, summary: lines.join('\n'), decision };
}

module.exports = {
  routeWorkflow,
  getWorkflowSummary
};
