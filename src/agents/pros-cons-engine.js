'use strict';

const utils = require('./decision-utils');

function buildPros(option = {}, criteria = [], context = {}) {
  const label = String(option.label || '').toLowerCase();
  const pros = [];
  if (/4 bot|bertahap|kecil|stabilisasi|preview|plan|cek/.test(label)) pros.push('Lebih mudah di-debug dan lebih aman untuk rollout bertahap.');
  if (/postgres/.test(label)) pros.push('Lebih scalable dan cocok untuk production relational data.');
  if (/json/.test(label)) pros.push('Sederhana dan tetap berguna sebagai fallback saat database tidak tersedia.');
  if (/restore plan|validasi|checksum|integrity|approval/.test(label)) pros.push('Menjaga data aman dan memberi ruang preview sebelum restore.');
  if (/istirahat|tunda/.test(label)) pros.push('Menurunkan tekanan dan menjaga kualitas keputusan.');
  if (/langsung|10 bot|restore langsung/.test(label)) pros.push('Cepat memberi hasil besar jika semua asumsi benar.');
  if (!pros.length) pros.push('Memberi arah yang jelas dan bisa dijalankan sebagai langkah berikutnya.');
  return pros.map(item => utils.sanitizeDecisionText(item, { max: 180 }));
}

function buildCons(option = {}, criteria = [], context = {}) {
  const label = String(option.label || '').toLowerCase();
  const cons = [];
  if (/10 bot|langsung|besar/.test(label)) cons.push('Risiko debugging, spam, token management, dan latency lebih tinggi.');
  if (/restore langsung|overwrite|delete/.test(label)) cons.push('Berisiko merusak data jika belum ada preview, checksum, dan approval.');
  if (/json fallback saja|json/.test(label)) cons.push('Kurang ideal untuk data relational, dashboard, audit, dan multi-user jangka panjang.');
  if (/postgres/.test(label) && !/fallback/.test(label)) cons.push('Butuh migration dan koneksi database yang stabil.');
  if (/tunda|informasi tambahan/.test(label)) cons.push('Progress terasa lebih lambat jika terlalu lama menunggu.');
  if (!cons.length) cons.push('Masih ada asumsi yang perlu divalidasi sebelum eksekusi penuh.');
  return cons.map(item => utils.sanitizeDecisionText(item, { max: 180 }));
}

function detectMissingAssumptions(options = [], context = {}) {
  const assumptions = [];
  if (!context.storageStatus) assumptions.push('Status storage/deploy aktual belum diverifikasi.');
  if (!context.userGoal) assumptions.push('Goal utama user belum eksplisit.');
  if (options.some(option => /restore|import/i.test(option.label))) assumptions.push('Backup checksum, integrity, dan diff preview harus dicek dulu.');
  return assumptions.map(item => utils.sanitizeDecisionText(item, { max: 180 }));
}

function buildProsCons(options = [], criteria = [], context = {}, services = {}) {
  const assumptions = detectMissingAssumptions(options, context);
  return options.map(option => ({
    optionId: option.id,
    pros: buildPros(option, criteria, context),
    cons: buildCons(option, criteria, context),
    assumptions: assumptions.slice(0, 3),
    unknowns: assumptions.length ? ['Beberapa konteks runtime atau preferensi user belum lengkap.'] : []
  }));
}

function summarizeProsCons(prosCons = []) {
  return prosCons.map(item => {
    const pro = item.pros?.[0] || '-';
    const con = item.cons?.[0] || '-';
    return `${item.optionId}: + ${pro} / - ${con}`;
  });
}

module.exports = {
  buildCons,
  buildPros,
  buildProsCons,
  detectMissingAssumptions,
  summarizeProsCons
};
