'use strict';

const {
  isDangerousActionText,
  sanitizeCouncilPayload,
  sanitizeCouncilText
} = require('./council-utils');
const critique = require('./cross-agent-critique');
const riskReviewEngine = require('./risk-review-engine');

function buildRecommendation(session = {}, opinions = [], critiques = [], riskReview = {}) {
  const text = `${session.originalMessage || ''} ${session.topic || ''}`;
  if (/phase|tahap|lanjut/i.test(text)) {
    return 'Lanjut ke Phase 22 — Agent Council + Internal Debate Engine.';
  }
  if (/10 bot|4 dulu|langsung/i.test(text)) {
    return 'Mulai dari 4 bot inti dulu, lalu tambah agent lain bertahap setelah routing stabil.';
  }
  if (/\b(restore|import|overwrite)\b/i.test(text)) {
    return 'Jangan restore/import langsung. Buat proposal, validasi backup, cek integrity, lalu minta approval eksplisit.';
  }
  if (/\b(error|deploy|render|webhook|crash)\b/i.test(text)) {
    return 'Mulai dari diagnosis kecil: cek health, log Render, webhook, active storage driver, lalu isolasi perubahan terakhir.';
  }
  const planner = opinions.find(item => item.agentId === 'planner');
  return planner?.recommendations?.[0] || 'Ambil opsi dengan scope paling kecil, risiko paling rendah, dan verifikasi paling jelas.';
}

function buildProsCons(session = {}) {
  const text = `${session.originalMessage || ''} ${session.topic || ''}`;
  if (/10 bot|4 dulu|langsung/i.test(text)) {
    return {
      pros: ['10 bot memberi role lebih lengkap sejak awal.', 'Council bisa terlihat lebih kaya.'],
      cons: ['Risiko spam dan debugging naik.', 'Webhook/token management lebih rumit.', 'Biaya/latency bisa terasa berat.']
    };
  }
  return {
    pros: ['Membuat keputusan lebih seimbang.', 'Risiko bisa terlihat sebelum implementasi.'],
    cons: ['Scope bisa melebar jika debat terlalu panjang.']
  };
}

function buildNextSteps(session = {}) {
  const text = `${session.originalMessage || ''} ${session.topic || ''}`;
  if (/phase|tahap|lanjut/i.test(text)) {
    return [
      'Batasi Phase 22 ke quick council, debate satu ronde, risk review, dan synthesis final.',
      'Pastikan normal chat tetap satu jawaban bersih.',
      'Tambahkan dashboard/session audit sanitized.',
      'Jalankan regression Phase 19/20/21.'
    ];
  }
  if (/\b(restore|import|overwrite)\b/i.test(text)) {
    return [
      'Jalankan integrity check.',
      'Buat restore proposal, jangan direct run.',
      'Minta approval owner/admin.',
      'Restore hanya setelah preview/diff aman.'
    ];
  }
  if (/\b(error|deploy|render|webhook|crash)\b/i.test(text)) {
    return [
      'Cek `/health` dan `/dbstatus`.',
      'Baca log Render terakhir.',
      'Pastikan webhook URL benar.',
      'Rollback perubahan terakhir jika crash berulang.'
    ];
  }
  return ['Pilih satu opsi.', 'Buat test kecil.', 'Review risiko.', 'Commit perubahan kecil.'];
}

function buildConfidenceScore(session = {}) {
  let score = 0.68;
  if (session.opinions?.length >= 3) score += 0.08;
  if (session.critiques?.length) score += 0.04;
  if (session.riskReview?.approvalRequired) score -= 0.08;
  return Math.max(0.25, Math.min(0.92, score));
}

function buildFinalUserAnswer(session = {}, options = {}) {
  const recommendation = session.decision?.recommendation || buildRecommendation(session, session.opinions || [], session.critiques || [], session.riskReview || {});
  const nextSteps = session.decision?.nextSteps || buildNextSteps(session);
  const risks = session.decision?.risks || critique.findRisks(session.opinions || []).slice(0, 3);
  const confidence = session.decision?.confidence ?? buildConfidenceScore(session);
  const approvalRequired = Boolean(session.approvalRequired || session.riskReview?.approvalRequired);
  const text = `${session.originalMessage || ''} ${session.topic || ''}`;

  if (session.source === 'natural_chat') {
    const lines = [
      `Menurut saya ${recommendation}`,
      '',
      /phase|tahap|lanjut/i.test(text)
        ? 'Phase 20 sudah membuat router multi-agent, dan Phase 21 membuat personality serta memory tiap agent. Jadi langkah logis berikutnya adalah membuat agent bisa berdiskusi internal dan menyatukan keputusan.'
        : 'Saya menilai dari beberapa sudut pandang agent yang relevan, lalu mengambil opsi dengan risiko paling terkendali.',
      '',
      'Langkah berikutnya:',
      ...nextSteps.slice(0, 4).map((step, idx) => `${idx + 1}. ${step}`),
      risks.length ? `\nRisiko utama: ${sanitizeCouncilText(risks[0], 220)}` : '',
      approvalRequired ? '\nCatatan: aksi write/external/danger tetap perlu proposal dan approval eksplisit sebelum dijalankan.' : ''
    ];
    return lines.filter(Boolean).join('\n');
  }

  return [
    `Rekomendasi: ${recommendation}`,
    `Confidence: ${Math.round(confidence * 100)}%`,
    '',
    'Risiko:',
    ...(risks.length ? risks.slice(0, 4).map(risk => `- ${risk}`) : ['- Risiko besar tidak terdeteksi.']),
    '',
    'Langkah berikutnya:',
    ...nextSteps.slice(0, 5).map(step => `- ${step}`),
    approvalRequired ? '\nApproval required: yes' : '\nApproval required: no'
  ].join('\n');
}

function buildDecision(session = {}, opinions = [], critiques = [], riskReview = {}) {
  const recommendation = buildRecommendation(session, opinions, critiques, riskReview);
  const prosCons = buildProsCons(session);
  const risks = critique.findRisks(opinions).concat(riskReview.mitigationPlan || []).slice(0, 6);
  const nextSteps = buildNextSteps(session);
  return sanitizeCouncilPayload({
    recommendation,
    pros: prosCons.pros,
    cons: prosCons.cons,
    risks,
    nextSteps,
    confidence: buildConfidenceScore({ ...session, opinions, critiques, riskReview }),
    unsafeBlocked: riskReview.unsafeBlocked || isDangerousActionText(session.originalMessage || '')
  });
}

async function synthesizeDecision(session = {}, services = {}) {
  const riskReview = session.riskReview || await riskReviewEngine.runRiskReview(session, services);
  const decision = buildDecision(session, session.opinions || [], session.critiques || [], riskReview);
  const finalAnswer = buildFinalUserAnswer({ ...session, decision, riskReview, approvalRequired: riskReview.approvalRequired }, {});
  return sanitizeCouncilPayload({
    decision,
    finalAnswer,
    finalSummary: sanitizeCouncilText(finalAnswer, 1600),
    riskReview
  });
}

module.exports = {
  buildConfidenceScore,
  buildDecision,
  buildFinalUserAnswer,
  buildNextSteps,
  buildProsCons,
  buildRecommendation,
  synthesizeDecision
};
