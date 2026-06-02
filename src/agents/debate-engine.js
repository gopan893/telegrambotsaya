'use strict';

const opinionCollector = require('./agent-opinion-collector');
const critiqueEngine = require('./cross-agent-critique');
const decisionSynthesis = require('./decision-synthesis');
const store = require('./council-store');
const {
  auditCouncil,
  createCouncilId,
  nowIso,
  sanitizeCouncilPayload,
  sanitizeCouncilText,
  unique
} = require('./council-utils');

function getDebateAgents(session = {}, requestedAgents = []) {
  const base = requestedAgents.length ? requestedAgents : session.selectedAgents || [];
  const agents = unique(['orchestrator', 'planner', 'critic', ...base]);
  if (session.riskLevel === 'high' || session.riskLevel === 'danger' || session.approvalRequired) agents.push('security');
  return unique(agents).slice(0, 5);
}

async function collectOpeningPositions(session = {}, agents = [], services = {}) {
  const ids = getDebateAgents(session, agents).filter(agentId => agentId !== 'orchestrator');
  const opinions = [];
  for (const agentId of ids) {
    opinions.push(await opinionCollector.collectOpinionFromAgent(agentId, {
      ...session,
      mode: session.mode || 'debate'
    }, services));
  }
  return opinions;
}

async function collectCritiques(session = {}, opinions = [], services = {}) {
  const criticIds = unique(['critic', session.approvalRequired ? 'security' : '', session.mode === 'coding_review' ? 'coder' : ''])
    .filter(Boolean);
  const critiques = [];
  for (const criticId of criticIds) {
    for (const opinion of opinions) {
      if (opinion.agentId !== criticId) critiques.push(critiqueEngine.critiqueOpinion(criticId, opinion, session, services));
    }
  }
  return critiques;
}

function collectRevisions(session = {}, opinions = [], critiques = []) {
  return opinions.map(opinion => {
    const related = critiques.filter(item => item.targetAgentId === opinion.agentId);
    const concerns = related.flatMap(item => item.concerns || []).slice(0, 3);
    const revisionSummary = concerns.length
      ? `Revisi ${opinion.agentId}: tetap pada rekomendasi utama, tetapi membatasi scope: ${concerns[0]}`
      : `Revisi ${opinion.agentId}: tidak ada perubahan besar.`;
    return sanitizeCouncilPayload({
      id: createCouncilId('revision'),
      sessionId: session.id,
      agentId: opinion.agentId,
      revisionSummary: sanitizeCouncilText(revisionSummary, 320),
      createdAt: nowIso()
    });
  });
}

function summarizeDebate(session = {}, opinions = [], critiques = [], revisions = []) {
  const contradictions = critiqueEngine.findContradictions(opinions);
  const risks = critiqueEngine.findRisks(opinions).slice(0, 4);
  const missing = critiqueEngine.findMissingAssumptions(opinions).slice(0, 3);
  return sanitizeCouncilText([
    `Debate ${session.mode || 'debate'} membandingkan ${opinions.length} opini agent.`,
    contradictions.length ? `Kontradiksi: ${contradictions.join(' ')}` : '',
    risks.length ? `Risiko: ${risks.join(' ')}` : '',
    missing.length ? `Asumsi hilang: ${missing.join(' ')}` : '',
    revisions.length ? 'Revisi sudah diringkas tanpa hidden chain-of-thought.' : ''
  ].filter(Boolean).join(' '), 900);
}

function decideDebateWinnerOrRecommendation(session = {}, opinions = [], critiques = []) {
  const recommendation = decisionSynthesis.buildRecommendation(session, opinions, critiques, session.riskReview || {});
  return sanitizeCouncilPayload({
    recommendation,
    reason: sanitizeCouncilText('Rekomendasi dipilih karena paling kecil scope, paling jelas verifikasinya, dan risiko bisa dikontrol.', 260),
    confidence: decisionSynthesis.buildConfidenceScore({ ...session, opinions, critiques })
  });
}

async function createDebateRound(session = {}, agents = [], services = {}) {
  const opinions = await collectOpeningPositions(session, agents, services);
  const critiques = await collectCritiques(session, opinions, services);
  const revisions = collectRevisions(session, opinions, critiques);
  const summary = summarizeDebate(session, opinions, critiques, revisions);
  const recommendation = decideDebateWinnerOrRecommendation(session, opinions, critiques);
  const record = sanitizeCouncilPayload({
    id: createCouncilId('debate'),
    sessionId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    mode: session.mode || 'debate',
    topic: session.topic,
    opinions,
    critiques,
    revisions,
    summary,
    recommendation,
    createdAt: nowIso()
  });
  await store.appendDebateRecord(record, services);
  await auditCouncil('agents/debate_round_completed', {
    sessionId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    mode: session.mode || 'debate',
    opinionCount: opinions.length,
    critiqueCount: critiques.length
  }, services);
  return record;
}

async function runDebate(session = {}, services = {}) {
  const round = await createDebateRound(session, session.selectedAgents || [], services);
  const synthesis = await decisionSynthesis.synthesizeDecision({
    ...session,
    opinions: round.opinions,
    critiques: round.critiques
  }, services);
  return sanitizeCouncilPayload({
    ...round,
    decision: synthesis.decision,
    finalAnswer: synthesis.finalAnswer,
    finalSummary: synthesis.finalSummary,
    riskReview: synthesis.riskReview
  });
}

module.exports = {
  collectCritiques,
  collectOpeningPositions,
  collectRevisions,
  createDebateRound,
  decideDebateWinnerOrRecommendation,
  runDebate,
  summarizeDebate
};
