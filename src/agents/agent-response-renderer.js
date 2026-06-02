'use strict';

const { buildSafeText, maskSecret } = require('./agent-utils');
const outputSanitizer = require('../ai-os/output-sanitizer');
const fileIntentGuard = require('../multimodal/file-intent-guard');
const topicClassifier = require('./topic-classifier');

const DEBUG_PATTERNS = [
  /^Smart Agent Router\b/im,
  /^Mode:\s.*$/gim,
  /^Risk:\s.*$/gim,
  /^Agent:\s.*$/gim,
  /^Selected:\s.*$/gim,
  /^Internal:\s.*$/gim,
  /^Muted:\s.*$/gim
];

function stripAgentSelfIntro(text = '') {
  return String(text || '')
    .replace(/Saya bertindak sebagai\s+[^.]+\.?\s*/gi, '')
    .replace(/Saya pilih mode\s+[^.]+\.?\s*/gi, '')
    .replace(/Routing aman dan hemat agent\.?\s*/gi, '')
    .replace(/Konteks memory relevan:\s*[^.]+\.?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripDebugFromNaturalReply(text = '') {
  let output = String(text || '');
  for (const pattern of DEBUG_PATTERNS) output = output.replace(pattern, '');
  return stripAgentSelfIntro(maskSecret(output)).replace(/\n{3,}/g, '\n\n').trim();
}

function sanitizeRenderedReply(text = '', context = {}, event = {}) {
  const fileRelated = fileIntentGuard.isFileRelatedMessage(context.text || event.text || '', {
    ...context,
    event,
    hasAttachment: context.hasAttachment
  });
  const topics = context.topics || context.route?.topics || [];
  const personalDomain = topicClassifier.isPersonalDomainMessage?.(context.text || event.text || '', topics);
  let clean = stripDebugFromNaturalReply(text);
  if (personalDomain) {
    clean = clean
      .split('\n')
      .filter(line => {
        const raw = line.toLowerCase();
        if (raw.includes('fokus saya: cek akar masalah teknis')) return false;
        if (raw.includes('risiko regresi')) return false;
        if (raw.includes('langkah implementasi paling kecil')) return false;
        if (raw.includes('error python')) return false;
        if (raw.includes('stack trace')) return false;
        if (raw.includes('debug') || raw.includes('deploy')) return false;
        return true;
      })
      .join('\n')
      .trim();
  }
  return outputSanitizer.sanitizeAssistantVisibleText(clean, {
    userText: context.text || event.text || '',
    fileRelated,
    forceClean: true
  });
}

function getDraft(agentDrafts = [], agentId) {
  return agentDrafts.find(draft => draft.agentId === agentId) || null;
}

function hasTopic(context = {}, topic) {
  return (context.topics || context.route?.topics || []).includes(topic);
}

function getInputText(context = {}, event = {}) {
  return String(context.text || event.text || '').trim();
}

function detectRoadmapQuestion(text = '', context = {}) {
  const low = text.toLowerCase();
  return hasTopic(context, 'planning') || hasTopic(context, 'roadmap') || /\b(phase|tahap|lanjut|prioritas|roadmap|rencana)\b/i.test(low);
}

function renderPlanningFallback(text = '', context = {}) {
  if (/phase|tahap|lanjut/i.test(text)) {
    return [
      'Menurut saya lanjut ke Phase 22 — Agent Council + Internal Debate Engine.',
      '',
      'Alasannya: Phase 20 sudah membuat router multi-agent, dan Phase 21 sudah memberi personality serta memory per agent. Langkah logis berikutnya adalah membuat agent bisa berdiskusi internal lalu menghasilkan satu keputusan yang rapi.',
      '',
      'Langkah berikutnya:',
      '1. Batasi scope Phase 22 ke council/debate ringan.',
      '2. Buat hasil akhir tetap satu jawaban dari Orchestrator.',
      '3. Simpan keputusan penting ke memory/graph.',
      '4. Jaga action berbahaya tetap lewat approval.',
      '',
      'Risiko kecilnya: jangan membuat semua agent bicara terlalu panjang. Mulai dari diskusi internal singkat dulu.'
    ].join('\n');
  }

  return [
    'Rekomendasi saya: pilih langkah yang paling dekat dengan roadmap sekarang, lalu pecah jadi 2-3 task kecil.',
    '',
    'Langkah berikutnya:',
    '1. Tentukan outcome yang ingin selesai minggu ini.',
    '2. Pilih satu fitur paling berdampak.',
    '3. Jalankan test kecil sebelum menambah scope.'
  ].join('\n');
}

function renderOpsFallback(text = '') {
  return [
    'Saya sarankan mulai dari cek stabilitas dasar dulu.',
    '',
    'Langkah cepat:',
    '1. Cek `/health` dan `/dbstatus`.',
    '2. Pastikan webhook Render aktif.',
    '3. Lihat log deploy terakhir.',
    '4. Kalau error teknis muncul, kirim potongan error tanpa token atau API key.'
  ].join('\n');
}

function renderSecurityFallback(route = {}) {
  const approval = route.approvalRequired
    ? 'Aksi ini tidak boleh dijalankan langsung. Buat proposal dulu, lalu approve secara eksplisit sebelum run.'
    : 'Tetap jangan kirim token, API key, DATABASE_URL, atau credential di chat.';
  return [
    'Ini termasuk area yang perlu guard keamanan.',
    '',
    approval,
    '',
    'Langkah aman:',
    '1. Jelaskan target aksinya tanpa menyertakan secret.',
    '2. Buat proposal eksekusi jika ini restore/import/write action.',
    '3. Review risiko sebelum approve.'
  ].join('\n');
}

function renderEmotionalFallback() {
  return [
    'Aku paham, rasanya bisa melelahkan kalau banyak phase dan fitur menumpuk.',
    '',
    'Ambil satu langkah kecil dulu: tulis satu hal yang paling mengganggu sekarang, lalu pilih satu tindakan yang bisa selesai kurang dari 30 menit.',
    '',
    'Kalau mau, mulai dari pertanyaan sederhana: “bagian mana yang paling bikin macet?”'
  ].join('\n');
}

function renderPersonalAdviceFallback(text = '', topics = []) {
  if (topics.includes('school_life') || /\b(guru|sekolah|telat|dimarahin|dimarahi)\b/i.test(text)) {
    return [
      'Tenang dulu. Saat guru sedang marah, jangan membalas atau memotong pembicaraan.',
      '',
      'Yang paling aman:',
      '1. Dengarkan dulu sampai selesai.',
      '2. Minta maaf singkat tanpa banyak alasan.',
      '3. Akui bagian yang memang salah.',
      '4. Tawarkan perbaikan yang jelas.',
      '',
      'Contoh kalimat:',
      '"Maaf Pak/Bu, saya terlambat. Saya paham ini salah, dan saya akan berusaha datang lebih awal. Kalau ada tugas atau konsekuensi, saya siap memperbaiki."',
      '',
      'Kalau guru masih emosi, cukup jawab pendek dan sopan. Jelaskan alasan nanti saat suasananya lebih tenang.'
    ].join('\n');
  }

  return [
    'Mulai dari menenangkan situasi dulu, lalu jawab dengan sopan dan singkat.',
    '',
    'Langkah praktis:',
    '1. Dengarkan tanpa membalas saat emosi sedang tinggi.',
    '2. Minta maaf untuk bagian yang memang salah.',
    '3. Jelaskan seperlunya tanpa menyalahkan orang lain.',
    '4. Tunjukkan satu tindakan perbaikan yang bisa kamu lakukan sekarang.'
  ].join('\n');
}

function renderFinalSynthesis(orchestratorDraft = {}, specialistDrafts = [], context = {}) {
  const event = context.event || {};
  const route = context.route || context.policy || {};
  const text = getInputText(context, event);
  const topics = context.topics || route.topics || [];
  let answer = '';

  const personalDomain = topicClassifier.isPersonalDomainMessage?.(text, topics);
  if (personalDomain && (topics.includes('school_life') || topics.includes('social_advice') || topics.includes('daily_life') || topics.includes('emotional_support'))) {
    answer = renderPersonalAdviceFallback(text, topics);
  } else if (topics.includes('emotional') || topics.includes('personal_reflection')) {
    answer = renderEmotionalFallback();
  } else if (topics.includes('security') || topics.includes('secret') || topics.includes('restore') || topics.includes('import') || topics.includes('executor')) {
    answer = renderSecurityFallback(route);
  } else if (topics.includes('ops') || topics.includes('deploy')) {
    answer = renderOpsFallback(text);
  } else if (detectRoadmapQuestion(text, { topics })) {
    answer = renderPlanningFallback(text, context);
  } else {
    const cleanSpecialists = specialistDrafts
      .slice(0, 2)
      .map(draft => stripDebugFromNaturalReply(draft.text))
      .filter(Boolean);
    answer = [
      stripDebugFromNaturalReply(orchestratorDraft.text) || 'Saya bantu jawab ringkas.',
      cleanSpecialists.length ? `\nCatatan tambahan:\n${cleanSpecialists.map(item => `- ${item}`).join('\n')}` : ''
    ].filter(Boolean).join('\n');
  }

  if (route.approvalRequired && !/approval|approve|proposal/i.test(answer)) {
    answer += '\n\nCatatan: aksi write/external/danger tetap perlu proposal dan approval eksplisit sebelum dijalankan.';
  }

  return sanitizeRenderedReply(answer, context, event);
}

function renderNaturalSmartReply(event = {}, policyOrRoute = {}, agentDrafts = [], context = {}, services = {}) {
  const route = policyOrRoute.route || policyOrRoute || {};
  const selected = new Set(route.selectedAgents || []);
  const visibleDrafts = agentDrafts.filter(draft => selected.has(draft.agentId));
  const orchestratorDraft = getDraft(visibleDrafts, 'orchestrator') || visibleDrafts[0] || {};
  const specialistDrafts = visibleDrafts.filter(draft => draft.agentId !== 'orchestrator').slice(0, 2);

  const mode = route.policy?.mode || route.mode || route.commandMode || 'natural_smart';
  if (mode === 'council' || mode === 'debate' || mode === 'allagents') {
    return renderCouncilReply(visibleDrafts, { ...context, event, route });
  }

  return renderFinalSynthesis(orchestratorDraft, specialistDrafts, {
    ...context,
    event,
    route,
    topics: route.topics || context.topics || []
  });
}

function renderDebugRouterReply(policyOrRoute = {}, scores = [], context = {}) {
  const route = policyOrRoute.route || policyOrRoute || {};
  return [
    'Smart Agent Router',
    `Mode: ${route.policy?.mode || route.commandMode || route.mode || 'natural_smart'}`,
    `Topics: ${(route.topics || []).join(', ') || '-'}`,
    `Risk: ${route.risk?.level || route.riskLevel || 'low'}`,
    `Agent: ${(route.selectedAgents || []).join(', ') || '-'}`,
    `Internal: ${(route.internalOnlyAgents || []).join(', ') || '-'}`,
    `Muted: ${(route.mutedAgents || []).slice(0, 8).join(', ') || '-'}`,
    route.approvalRequired ? 'Approval: required' : 'Approval: not required',
    context.reason ? `Reason: ${buildSafeText(context.reason, 220)}` : ''
  ].filter(Boolean).join('\n');
}

function renderCouncilReply(agentDrafts = [], context = {}) {
  const route = context.route || {};
  const selected = new Set(route.selectedAgents || agentDrafts.map(d => d.agentId));
  const visible = agentDrafts.filter(draft => selected.has(draft.agentId));
  const lines = [];
  for (const draft of visible) {
    const label = draft.agentId.charAt(0).toUpperCase() + draft.agentId.slice(1);
    const clean = sanitizeRenderedReply(draft.text, context, context.event || {});
    if (clean) lines.push(`${label}: ${clean}`);
  }
  return lines.length ? lines.join('\n\n') : 'Council belum punya opini yang relevan.';
}

module.exports = {
  renderCouncilReply,
  renderDebugRouterReply,
  renderFinalSynthesis,
  renderNaturalSmartReply,
  stripAgentSelfIntro,
  stripDebugFromNaturalReply
};
