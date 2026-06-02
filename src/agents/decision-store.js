'use strict';

const riskScorer = require('./advanced-risk-scorer');
const confidenceScorer = require('./confidence-scorer');
const decisionDetector = require('./decision-detector');
const decisionHistory = require('./decision-history');
const decisionMemory = require('./decision-memory');
const optionExtractor = require('./option-extractor');
const prosConsEngine = require('./pros-cons-engine');
const recommender = require('./decision-recommender');
const tradeoffAnalyzer = require('./tradeoff-analyzer');
const utils = require('./decision-utils');

function scoreOptions(options = [], criteria = [], risks = []) {
  const ranked = recommender.rankOptions(options, criteria, risks);
  return options.map(option => ranked.find(item => item.id === option.id) || option);
}

async function analyzeDecision(input = {}, services = {}) {
  const question = utils.sanitizeDecisionText(input.question || input.message || input.text || '', { max: 1200 });
  if (!question) throw new Error('DECISION_QUESTION_REQUIRED');
  if (utils.containsSecretLike(question)) throw Object.assign(new Error('DECISION_SECRET_REJECTED'), { code: 'DECISION_SECRET_REJECTED' });

  const topics = input.topics || [];
  const detector = decisionDetector.detectDecisionIntent(question, topics, input.context || {});
  const options = optionExtractor.extractOptionsFromMessage(question, input.context || {}, services);
  const criteria = utils.selectCriteria(question, topics);
  const risks = options.map(option => riskScorer.scoreDecisionRisk(option, { question, topics }, services));
  const scoredOptions = scoreOptions(options, criteria, risks);
  const prosCons = prosConsEngine.buildProsCons(scoredOptions, criteria, input.context || {}, services);
  const tradeoffs = tradeoffAnalyzer.analyzeTradeoffs(scoredOptions, criteria, prosCons, risks, services);
  const partial = utils.buildDecisionRecord({
    ...input,
    title: input.title || question,
    question,
    options: scoredOptions,
    criteria,
    prosCons,
    tradeoffs,
    risks,
    approvalRequired: risks.some(item => item.approvalRequired),
    riskLevel: riskScorer.buildRiskSummary(risks).highestRiskLevel,
    status: 'analyzing'
  });
  const confidence = confidenceScorer.scoreDecisionConfidence(partial, scoredOptions, risks, input.context || {}, services);
  const recommendation = recommender.recommendOption({ ...partial, confidence }, services);
  const record = await decisionHistory.createDecisionRecord({
    ...partial,
    confidence,
    recommendation,
    nextSteps: recommendation.nextSteps,
    status: 'recommended',
    approvalRequired: recommendation.approvalRequired,
    riskLevel: riskScorer.buildRiskSummary(risks).highestRiskLevel
  }, services);
  await decisionMemory.saveDecisionSummary(record, services);
  await utils.auditDecision(recommendation.approvalRequired ? 'agents/decision_approval_required_detected' : 'agents/decision_recommendation_generated', {
    decisionId: record.id,
    workspaceId: record.workspaceId,
    userId: record.userId,
    riskLevel: record.riskLevel,
    confidence: record.confidence?.level,
    recommendedOptionId: recommendation.recommendedOptionId,
    approvalRequired: recommendation.approvalRequired
  }, services);
  return utils.sanitizeDecisionPayload({
    ok: true,
    detection: detector,
    decision: record,
    recommendation,
    finalAnswer: formatDecisionAnswer(record)
  });
}

function formatDecisionAnswer(decision = {}, options = {}) {
  const rec = decision.recommendation || {};
  const riskSummary = riskScorer.buildRiskSummary(decision.risks || []);
  const lines = [
    `Rekomendasi: ${rec.recommendation || 'ambil langkah paling kecil dan reversible.'}`,
    '',
    'Alasan:',
    ...(rec.reasons || []).slice(0, 3).map(reason => `- ${reason}`),
    '',
    `Risiko: ${riskSummary.highestRiskLevel || decision.riskLevel || 'low'} — ${riskSummary.summary || 'Risiko besar tidak terdeteksi.'}`,
    `Confidence: ${decision.confidence?.level || 'medium'} (${Math.round(Number(decision.confidence?.score || 0.5) * 100)}%)`,
    '',
    'Langkah berikutnya:',
    ...(rec.nextSteps || decision.nextSteps || []).slice(0, 5).map((step, index) => `${index + 1}. ${step}`),
    rec.approvalRequired ? '\nCatatan: aksi write/external/danger tetap wajib lewat executor proposal dan approval eksplisit.' : ''
  ];
  return utils.sanitizeDecisionText(lines.filter(Boolean).join('\n'), { userText: decision.question || '', max: 2200 });
}

module.exports = {
  analyzeDecision,
  formatDecisionAnswer,
  ...decisionHistory
};
