'use strict';

const {
  createCouncilId,
  isDangerousActionText,
  nowIso,
  sanitizeCouncilPayload,
  sanitizeCouncilText
} = require('./council-utils');

function critiqueOpinion(criticAgentId, targetOpinion = {}, session = {}, services = {}) {
  const concerns = [];
  if (criticAgentId === 'critic') {
    concerns.push('Perlu batasi scope agar tidak melebar.');
    concerns.push('Validasi asumsi sebelum menambah fitur besar.');
  }
  if (criticAgentId === 'security') {
    concerns.push(session.approvalRequired ? 'Aksi ini harus lewat approval eksplisit.' : 'Pastikan tidak ada secret tersimpan atau tampil.');
  }
  if (criticAgentId === 'coder') concerns.push('Pastikan perubahan kecil dan test regression jalan.');
  if (criticAgentId === 'ops') concerns.push('Cek dampak ke Render free tier, storage fallback, dan webhook.');
  if (criticAgentId === 'planner') concerns.push('Urutan kerja harus jelas dan bisa selesai.');

  return sanitizeCouncilPayload({
    id: createCouncilId('critique'),
    sessionId: session.id,
    criticAgentId,
    targetAgentId: targetOpinion.agentId,
    summary: sanitizeCouncilText(concerns[0] || 'Tidak ada kritik besar.', 240),
    concerns: concerns.slice(0, 4).map(item => sanitizeCouncilText(item, 220)),
    severity: session.riskLevel === 'danger' ? 'high' : (session.riskLevel === 'high' ? 'medium' : 'low'),
    createdAt: nowIso()
  });
}

function findContradictions(opinions = []) {
  const hasSupport = opinions.some(item => item.stance === 'support');
  const hasRisk = opinions.some(item => item.stance === 'risk' || item.agentId === 'critic' || item.agentId === 'security');
  return hasSupport && hasRisk ? ['Ada dukungan untuk lanjut, tetapi ada risiko scope/safety yang perlu dibatasi.'] : [];
}

function findMissingAssumptions(opinions = []) {
  const text = opinions.map(item => `${item.summary} ${(item.recommendations || []).join(' ')}`).join(' ');
  const missing = [];
  if (!/test|verifikasi|cek/i.test(text)) missing.push('Belum jelas verifikasi/test yang akan dipakai.');
  if (!/scope|batasi|kecil/i.test(text)) missing.push('Batas scope belum cukup eksplisit.');
  return missing;
}

function findRisks(opinions = []) {
  const risks = [];
  for (const opinion of opinions) {
    for (const concern of opinion.concerns || []) risks.push(concern);
  }
  return Array.from(new Set(risks)).slice(0, 8);
}

function generateAlternativeOptions(opinions = [], session = {}) {
  const text = `${session.originalMessage || ''} ${session.topic || ''}`;
  if (/10 bot|4 dulu/i.test(text)) {
    return ['Mulai dari 4 bot inti dulu.', 'Aktifkan 10 bot hanya setelah routing dan anti-spam stabil.'];
  }
  if (isDangerousActionText(text)) {
    return ['Buat proposal approval.', 'Jalankan integrity/checksum check sebelum restore/import.'];
  }
  return ['Lanjutkan scope kecil.', 'Tunda fitur besar sampai stabilitas terverifikasi.'];
}

function buildCritiqueSummary(critiques = []) {
  if (!critiques.length) return 'Tidak ada kritik besar.';
  const concerns = [];
  for (const critique of critiques) {
    concerns.push(...(critique.concerns || []));
  }
  return Array.from(new Set(concerns)).slice(0, 5).join(' ');
}

module.exports = {
  buildCritiqueSummary,
  critiqueOpinion,
  findContradictions,
  findMissingAssumptions,
  findRisks,
  generateAlternativeOptions
};
