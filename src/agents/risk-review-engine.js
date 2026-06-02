'use strict';

const {
  auditCouncil,
  inferRiskLevel,
  isDangerousActionText,
  sanitizeCouncilPayload,
  sanitizeCouncilText
} = require('./council-utils');

function detectApprovalNeeded(session = {}, services = {}) {
  const text = `${session.originalMessage || ''} ${session.topic || ''}`;
  return Boolean(
    session.approvalRequired ||
    isDangerousActionText(text) ||
    ['high', 'danger'].includes(session.riskLevel)
  );
}

function classifyCouncilRisk(session = {}, opinions = [], critiques = [], services = {}) {
  if (detectApprovalNeeded(session, services)) {
    if (/\b(restore|import|delete|hapus|overwrite)\b/i.test(`${session.originalMessage} ${session.topic}`)) return 'danger';
    return session.riskLevel === 'low' ? 'medium' : inferRiskLevel(session.riskLevel);
  }
  if ((critiques || []).some(item => item.severity === 'high')) return 'high';
  return inferRiskLevel(session.riskLevel || 'low');
}

function buildRiskMitigationPlan(session = {}, services = {}) {
  const approval = detectApprovalNeeded(session, services);
  const items = approval
    ? [
        'Buat proposal eksekusi, jangan jalankan langsung.',
        'Cek permission owner/admin dan audit log.',
        'Validasi data dengan checksum/integrity check jika restore/import.',
        'Jangan kirim token atau credential di chat.'
      ]
    : [
        'Batasi scope perubahan.',
        'Jalankan regression test terkait.',
        'Simpan keputusan penting sebagai summary, bukan raw debate.'
      ];
  return items.map(item => sanitizeCouncilText(item, 220));
}

function blockUnsafeRecommendation(session = {}, services = {}) {
  if (!detectApprovalNeeded(session, services)) return { blocked: false, reason: '' };
  return {
    blocked: true,
    reason: 'Write/external/danger action memerlukan proposal dan approval eksplisit sebelum dijalankan.'
  };
}

async function runRiskReview(session = {}, services = {}) {
  const approvalRequired = detectApprovalNeeded(session, services);
  const riskLevel = classifyCouncilRisk(session, session.opinions || [], session.critiques || [], services);
  const mitigationPlan = buildRiskMitigationPlan({ ...session, riskLevel, approvalRequired }, services);
  const block = blockUnsafeRecommendation({ ...session, riskLevel, approvalRequired }, services);
  const result = sanitizeCouncilPayload({
    riskLevel,
    approvalRequired,
    mitigationPlan,
    unsafeBlocked: block.blocked,
    blockReason: block.reason
  });
  await auditCouncil(approvalRequired ? 'agents/council_approval_required_detected' : 'agents/council_risk_review_run', {
    sessionId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    mode: session.mode,
    riskLevel,
    approvalRequired,
    result
  }, services);
  return result;
}

module.exports = {
  blockUnsafeRecommendation,
  buildRiskMitigationPlan,
  classifyCouncilRisk,
  detectApprovalNeeded,
  runRiskReview
};
