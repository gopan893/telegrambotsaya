const { truncate, sanitizeImprovementText } = require('./improvement-utils');

const SEVERITY_LEVELS = ['info', 'low', 'medium', 'high', 'critical'];

const CRITICAL_PATTERNS = [
  /secret\s*(leak|exposed|bocor)/i,
  /executor\s*bypass/i,
  /integration\s*EV2\s*bypass/i,
  /direct\s*(deploy|push|rollback)\s*bypass/i,
  /dashboard\s*all\s*tabs\s*fallback\s*overview/i,
  /app\s*cannot\s*start/i,
];

const SAFETY_PATTERNS = [
  /secret/i,
  /executor/i,
  /bypass/i,
  /direct\s*write/i,
  /auth|token|credential/i,
];

function detectSeverity(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  for (const pattern of CRITICAL_PATTERNS) {
    if (pattern.test(text)) return 'critical';
  }
  if (/(error|fail|crash|down)/i.test(text)) return 'high';
  if (/(warn|degrad|slow|timeout)/i.test(text)) return 'medium';
  if (/(info|notice|ping|heartbeat)/i.test(text)) return 'info';
  return 'low';
}

function detectCategory(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  if (/secret|leak|token|credential/.test(text)) return 'secret_safety';
  if (/executor|proposal|bypass/.test(text)) return 'proposal_wrong';
  if (/deploy|render|rollback/.test(text)) return 'deploy_failure';
  if (/dashboard|regression/.test(text)) return 'dashboard_bug';
  if (/telegram|command/.test(text)) return 'telegram_command_bug';
  if (/workflow|pipeline|action/.test(text)) return 'workflow_failure';
  if (/memory|konteks|context/.test(text)) return 'memory_wrong';
  if (/lambat|slow|timeout/.test(text)) return 'slow_response';
  if (/biaya|cost|mahal/.test(text)) return 'cost_too_high';
  return 'answer_quality';
}

function detectAffectedModule(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  if (/dashboard/.test(text)) return 'dashboard';
  if (/telegram/.test(text)) return 'telegram';
  if (/deploy|render/.test(text)) return 'deploy';
  if (/executor|proposal/.test(text)) return 'executor';
  if (/workflow|github|action/.test(text)) return 'workflow';
  if (/memory|context/.test(text)) return 'memory';
  if (/lifeos/.test(text)) return 'lifeos';
  if (/portfolio/.test(text)) return 'portfolio';
  if (/coding|workspace/.test(text)) return 'coding_workspace';
  return 'general';
}

function detectLikelyCause(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  if (/timeout|time.?out/.test(text)) return 'timeout';
  if (/rate.?limit/.test(text)) return 'rate_limit';
  if (/auth|unauthorized/.test(text)) return 'authentication';
  if (/not.?found|404/.test(text)) return 'not_found';
  if (/network|connect/.test(text)) return 'network';
  if (/memory|oom/.test(text)) return 'out_of_memory';
  if (/config|misconfig/.test(text)) return 'misconfiguration';
  return 'unknown';
}

function detectRecommendedAction(input) {
  const severity = detectSeverity(input);
  const category = detectCategory(input);
  if (category === 'secret_safety') return 'rotate_credentials';
  if (category === 'deploy_failure') return 'rollback_deploy';
  if (severity === 'critical') return 'immediate_investigation';
  if (severity === 'high') return 'schedule_hotfix';
  if (severity === 'medium') return 'create_ticket';
  return 'monitor';
}

function classifyQualitySignal(input, services) {
  const category = detectCategory(input);
  const severity = detectSeverity(input);
  const confidence = severity === 'critical' ? 0.95 : severity === 'high' ? 0.85 : severity === 'medium' ? 0.7 : 0.5;
  return {
    category,
    severity,
    confidence,
    affectedModule: detectAffectedModule(input),
    likelyCause: detectLikelyCause(input),
    recommendedActionType: detectRecommendedAction(input),
    safetyRelevant: detectSafetyRelevantSignal(input, services),
  };
}

function classifyFeedbackCategory(feedback, services) {
  const text = (feedback && feedback.rawTextRedacted) || (feedback && feedback.summary) || '';
  return detectCategory(text);
}

function classifyOutcomeQuality(outcome, services) {
  const status = outcome && outcome.status;
  const severity = status === 'failed' ? 'high' : status === 'partial' ? 'medium' : status === 'blocked' ? 'high' : 'low';
  return {
    category: 'outcome_quality',
    severity,
    confidence: severity === 'high' ? 0.85 : 0.6,
    affectedModule: detectAffectedModule(outcome),
    likelyCause: status === 'failed' ? 'execution_error' : 'unknown',
    recommendedActionType: status === 'failed' ? 'investigate_outcome' : 'monitor',
    safetyRelevant: status === 'blocked',
  };
}

function detectSafetyRelevantSignal(input, services) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  return SAFETY_PATTERNS.some(p => p.test(text));
}

function buildQualitySignalSummary(signal, services) {
  const parts = [
    `[${signal.severity.toUpperCase()}]`,
    signal.category,
    signal.affectedModule ? `(${signal.affectedModule})` : '',
    signal.safetyRelevant ? '🔒' : '',
    `confidence:${Math.round(signal.confidence * 100)}%`,
    signal.likelyCause !== 'unknown' ? `cause:${signal.likelyCause}` : '',
    `action:${signal.recommendedActionType}`,
  ];
  return truncate(parts.filter(Boolean).join(' '), 500);
}

module.exports = {
  SEVERITY_LEVELS,
  classifyQualitySignal,
  classifyFeedbackCategory,
  classifyOutcomeQuality,
  detectSafetyRelevantSignal,
  buildQualitySignalSummary,
  detectSeverity,
  detectCategory,
};
