'use strict';

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '50%';
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

function explainDecision(decision = {}) {
  const risk = decision.risk || {};
  const policy = decision.policy || {};
  const parts = [
    `Keputusan governance: ${decision.decision || 'UNKNOWN'}.`,
    `Risk level: ${risk.riskLevel || policy.riskLevel || 'unknown'} (${formatPercent(risk.riskScore)}).`,
    `Context trust: ${formatPercent(risk.contextTrustScore)}.`,
    `Policy: ${policy.capability || 'conversation'} - ${policy.description || 'Tidak ada deskripsi policy.'}`
  ];

  if (decision.violations?.length) {
    parts.push(`Alasan pembatasan: ${decision.violations.join(', ')}.`);
  }
  if (risk.factors?.length) {
    parts.push(`Faktor risiko: ${risk.factors.join(', ')}.`);
  }
  if (decision.permission && decision.permission.allowed === false) {
    parts.push(`Permission ditolak untuk role ${decision.permission.role}.`);
  }

  return parts.join(' ');
}

function buildUserFacingDecision(decision = {}) {
  const policy = decision.policy || {};
  const risk = decision.risk || {};

  if (decision.decision === 'BLOCKED') {
    return [
      '🛡️ Aksi ini saya tahan demi keamanan.',
      '',
      `Alasan: ${decision.violations?.join(', ') || 'risiko terlalu tinggi atau policy tidak mengizinkan.'}`,
      `Risk: ${risk.riskLevel || 'unknown'} (${formatPercent(risk.riskScore)}).`,
      'Saya bisa bantu jelaskan opsi yang lebih aman.'
    ].join('\n');
  }

  if (decision.decision === 'APPROVAL_REQUIRED') {
    return [
      '🛂 Aksi ini butuh konfirmasi sebelum dijalankan.',
      '',
      `Aksi: ${decision.intent}`,
      `Alasan: ${policy.description || 'Aksi ini punya efek samping.'}`,
      `Risk: ${risk.riskLevel || 'unknown'} (${formatPercent(risk.riskScore)}).`,
      '',
      `Ketik: konfirmasi ${decision.approvalId}`,
      'atau abaikan pesan ini kalau tidak ingin menjalankannya.'
    ].join('\n');
  }

  if (decision.decision === 'SAFE_FALLBACK') {
    return [
      'Saya akan jawab sebagai percakapan biasa dulu karena confidence atau context trust belum cukup untuk menjalankan aksi otomatis.',
      `Risk: ${risk.riskLevel || 'unknown'} (${formatPercent(risk.riskScore)}).`
    ].join('\n');
  }

  return explainDecision(decision);
}

function buildPromptConstraint(decision = {}) {
  const risk = decision.risk || {};
  const policy = decision.policy || {};
  return [
    '[GOVERNANCE CONSTRAINT]',
    `Decision: ${decision.decision || 'ALLOW'}`,
    `Policy capability: ${policy.capability || 'conversation'}`,
    `Risk: ${risk.riskLevel || 'low'} (${formatPercent(risk.riskScore)})`,
    `Context trust: ${formatPercent(risk.contextTrustScore)}`,
    'Jika risk/context lemah, jelaskan batasan dan jangan mengklaim aksi dijalankan.'
  ].join('\n');
}

module.exports = {
  explainDecision,
  buildUserFacingDecision,
  buildPromptConstraint
};
