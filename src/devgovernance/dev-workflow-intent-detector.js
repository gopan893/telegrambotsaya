'use strict';

const INTENTS = {
  codex_to_opencode_recovery: {
    name: 'codex_to_opencode_recovery',
    triggers: [
      'token codex habis', 'codex habis', 'codex berhenti',
      'codex belum handoff', 'codex token habis',
      'lanjut opencode', 'ganti opencode', 'pindah opencode',
      'codex gagal', 'codex error token', 'codex interrupted'
    ],
    mode: 'recovery',
    recommendedAgent: 'opencode'
  },
  opencode_to_codex_continue: {
    name: 'opencode_to_codex_continue',
    triggers: [
      'opencode selesai', 'balik ke codex', 'lanjut codex',
      'codex lanjut', 'opencode sudah', 'opencode finish',
      'kembali ke codex', 'codex ambil alih'
    ],
    mode: 'implementation',
    recommendedAgent: 'codex'
  },
  post_codex_review: {
    name: 'post_codex_review',
    triggers: [
      'review codex', 'review hasil codex', 'audit codex',
      'cek integrasi codex', 'codex sudah selesai review',
      'periksa codex', 'inspeksi codex'
    ],
    mode: 'review',
    recommendedAgent: 'opencode'
  },
  post_opencode_review: {
    name: 'post_opencode_review',
    triggers: [
      'review opencode', 'review hasil opencode',
      'cek patch opencode', 'audit opencode',
      'opencode sudah selesai review', 'periksa opencode'
    ],
    mode: 'review',
    recommendedAgent: 'codex'
  },
  p0_recovery: {
    name: 'p0_recovery',
    triggers: [
      'dashboard rusak', 'menu masuk overview', 'banyak error',
      'kode berantakan', 'repo kacau', 'integrasi tidak nyambung',
      'broken dashboard', 'dashboard error', 'route broken',
      'overview fallback', 'tab tidak muncul', 'render error',
      'tampilan error', 'dashboard blank', 'halaman kosong'
    ],
    mode: 'p0_patch',
    recommendedAgent: 'opencode'
  },
  phase_planning: {
    name: 'phase_planning',
    triggers: [
      'lanjut phase', 'buat prompt phase', 'phase berikutnya',
      'roadmap selanjutnya', 'phase baru', 'next phase',
      'rencana phase', 'prompt phase', 'phase planning'
    ],
    mode: 'planning',
    recommendedAgent: 'hermes'
  },
  implementation_patch: {
    name: 'implementation_patch',
    triggers: [
      'perbaiki bug', 'tambahkan fitur', 'implementasikan',
      'fix ini', 'buat fungsi', 'implementasi', 'coding',
      'buat module', 'tambah command', 'buat route',
      'create feature', 'add feature',
      'buat issue', 'create issue', 'buat pr', 'create pr',
      'buat pull request', 'create pull request'
    ],
    mode: 'implementation',
    recommendedAgent: 'codex'
  },
  audit_only: {
    name: 'audit_only',
    triggers: [
      'audit dulu', 'cek kode', 'jangan edit dulu',
      'review saja', 'cek dulu', 'inspeksi', 'periksa kode',
      'analisa kode', 'cek keamanan', 'cek integrasi'
    ],
    mode: 'audit',
    recommendedAgent: 'opencode'
  }
};

function detectWorkflowIntent(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { intent: 'audit_only', confidence: 0, mode: 'audit', recommendedAgent: 'opencode' };
  }

  const lower = prompt.toLowerCase().trim();
  const scores = [];

  for (const [intentName, intent] of Object.entries(INTENTS)) {
    let score = 0;
    for (const trigger of intent.triggers) {
      if (lower.includes(trigger)) {
        score += 1;
      }
    }
    if (score > 0) {
      scores.push({ intent: intentName, score, ...intent });
    }
  }

  if (scores.length === 0) {
    const lowerCheck = lower;
    if (lowerCheck.includes('external') || lowerCheck.includes('write') || lowerCheck.includes('github') || lowerCheck.includes('push') || lowerCheck.includes('deploy')) {
      return {
        intent: 'audit_only',
        confidence: 0.5,
        mode: 'audit',
        recommendedAgent: 'opencode',
        externalActionRequired: true,
        message: 'External action terdeteksi. Required: dry-run → Evaluation v2 → executor proposal → approval → run.'
      };
    }
    return {
      intent: 'audit_only',
      confidence: 0.3,
      mode: 'audit',
      recommendedAgent: 'opencode',
      ambiguous: true,
      message: 'Prompt tidak cocok dengan intent spesifik. Default ke audit/plan.'
    };
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const confidence = best.score / Math.max(...scores.map(s => s.triggers.length));

  if (lower.includes('token') || lower.includes('habis') || lower.includes('berhenti')) {
    const tokenRelated = ['codex_to_opencode_recovery', 'opencode_to_codex_continue'];
    if (tokenRelated.includes(best.intent)) {
      return {
        intent: best.intent,
        confidence: Math.min(1, confidence + 0.3),
        mode: best.mode,
        recommendedAgent: best.recommendedAgent,
        tokenExhausted: true,
        message: 'Token agent habis terdeteksi. Recovery mode aktif. Audit dulu sebelum lanjut.'
      };
    }
    return {
      intent: best.intent,
      confidence: Math.min(1, confidence + 0.2),
      mode: 'recovery',
      recommendedAgent: best.recommendedAgent,
      tokenExhausted: true,
      message: 'Token habis terdeteksi. Jangan lanjut blind. Audit dulu.'
    };
  }

  const hasP0 = lower.includes('error') || lower.includes('rusak') || lower.includes('broken') || lower.includes('overview');
  if (hasP0 && best.intent !== 'p0_recovery') {
    return {
      intent: 'p0_recovery',
      confidence: 0.8,
      mode: 'p0_patch',
      recommendedAgent: 'opencode',
      message: 'P0 issue terdeteksi. Blok feature work. Rekomendasi P0 recovery.'
    };
  }

  if (lower.includes('external') || lower.includes('write') || lower.includes('github') || lower.includes('push') || lower.includes('deploy')) {
    return {
      intent: best.intent,
      confidence: best.score > 1 ? confidence : 0.6,
      mode: best.mode,
      recommendedAgent: best.recommendedAgent,
      externalActionRequired: true,
      message: 'External action terdeteksi. Required: dry-run → Evaluation v2 → executor proposal → approval → run.'
    };
  }

  return {
    intent: best.intent,
    confidence,
    mode: best.mode,
    recommendedAgent: best.recommendedAgent
  };
}

function getIntent(intentName) {
  return INTENTS[intentName] || null;
}

function getAllIntents() {
  return Object.keys(INTENTS).map(k => ({ id: k, ...INTENTS[k] }));
}

module.exports = {
  detectWorkflowIntent,
  getIntent,
  getAllIntents,
  INTENTS
};
