const { sanitizeImprovementText, truncate, now, generateId } = require('./improvement-utils');

const SENSITIVITY_LEVELS = ['low', 'medium', 'high'];

const FEEDBACK_CATEGORIES = [
  'answer_quality',
  'wrong_routing',
  'dashboard_bug',
  'telegram_command_bug',
  'deploy_failure',
  'workflow_failure',
  'cost_too_high',
  'memory_wrong',
  'context_leak',
  'secret_safety',
  'proposal_wrong',
  'agent_spam',
  'slow_response',
  'user_preference',
  'project_process',
];

const POSITIVE_WORDS = ['bagus', 'baik', 'suka', 'mantap', 'hebat'];
const NEGATIVE_WORDS = ['salah', 'error', 'rusak', 'boros', 'gagal', 'lambat'];

function detectSentiment(text) {
  const lower = text.toLowerCase();
  const hasPositive = POSITIVE_WORDS.some(w => lower.includes(w));
  const hasNegative = NEGATIVE_WORDS.some(w => lower.includes(w));
  if (hasPositive && hasNegative) return 'mixed';
  if (hasPositive) return 'positive';
  if (hasNegative) return 'negative';
  return 'neutral';
}

function autoClassifyCategory(text) {
  const lower = text.toLowerCase();
  if (/jawab|answer|respon|response|kualitas/.test(lower)) return 'answer_quality';
  if (/routing|salah arah|wrong/.test(lower)) return 'wrong_routing';
  if (/dashboard|bug|tampilan/.test(lower)) return 'dashboard_bug';
  if (/telegram|command|perintah/.test(lower)) return 'telegram_command_bug';
  if (/deploy|gagal|deployment/.test(lower)) return 'deploy_failure';
  if (/workflow|alur|pipeline/.test(lower)) return 'workflow_failure';
  if (/mahal|biaya|cost|boros/.test(lower)) return 'cost_too_high';
  if (/lupa|memory|ingat|konteks/.test(lower)) return 'memory_wrong';
  if (/bocor|kebocoran|leak|privasi/.test(lower)) return 'context_leak';
  if (/rahasia|secret|token|api_key/.test(lower)) return 'secret_safety';
  if (/proposal|salah.usul/.test(lower)) return 'proposal_wrong';
  if (/spam|berulang|repetitive/.test(lower)) return 'agent_spam';
  if (/lambat|lama|slow/.test(lower)) return 'slow_response';
  if (/preferensi|prefer|suka|mau/.test(lower)) return 'user_preference';
  if (/proyek|project|proses|process/.test(lower)) return 'project_process';
  return 'answer_quality';
}

function buildFeedback(input) {
  const nowISO = now();
  return {
    id: input.id || generateId(),
    workspaceId: input.workspaceId || null,
    userId: input.userId || null,
    chatId: input.chatId || null,
    source: input.source || 'system',
    targetType: input.targetType || null,
    targetId: input.targetId || null,
    sentiment: input.sentiment || detectSentiment(input.text || ''),
    category: input.category || autoClassifyCategory(input.text || ''),
    summary: truncate(input.summary || input.text || '', 500),
    rawTextRedacted: sanitizeImprovementText(input.text || ''),
    sensitivity: input.sensitivity || 'low',
    status: input.status || 'new',
    createdAt: input.createdAt || nowISO,
    updatedAt: nowISO,
  };
}

function collectUserFeedback(input, services) {
  const sanitized = sanitizeFeedbackText(input.text || '', services);
  const feedback = buildFeedback({
    ...input,
    text: sanitized,
    source: 'telegram',
    sentiment: input.sentiment || detectSentiment(sanitized),
    category: input.category || autoClassifyCategory(sanitized),
  });
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  return store.add('feedback', feedback);
}

function collectTelegramFeedback(message, context, services) {
  const text = (message && message.text) || '';
  const sanitized = sanitizeFeedbackText(text, services);
  const feedback = buildFeedback({
    text: sanitized,
    source: 'telegram',
    userId: context && context.userId,
    chatId: (message && message.chat && message.chat.id) || (context && context.chatId),
    sentiment: detectSentiment(sanitized),
    category: autoClassifyCategory(sanitized),
  });
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  return store.add('feedback', feedback);
}

function collectDashboardFeedback(input, services) {
  const sanitized = sanitizeFeedbackText(input.text || '', services);
  const feedback = buildFeedback({
    ...input,
    text: sanitized,
    source: 'dashboard',
    sentiment: input.sentiment || detectSentiment(sanitized),
    category: input.category || autoClassifyCategory(sanitized),
  });
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  return store.add('feedback', feedback);
}

function collectImplicitFeedback(signal, services) {
  const text = (signal && signal.message) || (signal && signal.text) || '';
  const sanitized = sanitizeFeedbackText(text, services);
  const feedback = buildFeedback({
    text: sanitized,
    source: 'implicit',
    targetType: signal && signal.source,
    targetId: signal && signal.sourceId,
    sentiment: detectSentiment(sanitized),
    category: autoClassifyCategory(sanitized),
    summary: signal && signal.summary,
    sensitivity: 'medium',
  });
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  return store.add('feedback', feedback);
}

function sanitizeFeedbackText(text, services) {
  let result = sanitizeImprovementText(text);
  result = truncate(result, 5000);
  return result;
}

function linkFeedbackToTarget(feedbackId, targetType, targetId, services) {
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  const feedback = store.getById('feedback', feedbackId);
  if (!feedback) return null;
  const updated = store.update('feedback', feedbackId, { targetType, targetId, updatedAt: now() });
  return updated;
}

module.exports = {
  SENSITIVITY_LEVELS,
  FEEDBACK_CATEGORIES,
  collectUserFeedback,
  collectTelegramFeedback,
  collectDashboardFeedback,
  collectImplicitFeedback,
  sanitizeFeedbackText,
  linkFeedbackToTarget,
  detectSentiment,
  autoClassifyCategory,
};
