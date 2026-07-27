'use strict';

const INJECTION_PATTERNS = [
  { pattern: /abaikan\s+(semua\s+)?aturan/i, label: 'ignore_rules', risk: 'critical' },
  { pattern: /ignore\s+(all\s+)?(previous\s+)?instructions/i, label: 'ignore_instructions', risk: 'critical' },
  { pattern: /reveal\s+(system\s+)?prompt/i, label: 'reveal_system_prompt', risk: 'critical' },
  { pattern: /tampilkan\s+(semua\s+)?(secret|rahasia|token|key)/i, label: 'reveal_secrets', risk: 'critical' },
  { pattern: /bypass\s+(all\s+)?(approval|safety|security)/i, label: 'bypass_safety', risk: 'critical' },
  { pattern: /auto\s*approve/i, label: 'auto_approve', risk: 'critical' },
  { pattern: /approve\s+(yourself|sendiri)/i, label: 'self_approve', risk: 'critical' },
  { pattern: /disable\s+(safety|security|protection)/i, label: 'disable_safety', risk: 'critical' },
  { pattern: /run\s+(tool|command|shell)\s+directly/i, label: 'direct_tool', risk: 'critical' },
  { pattern: /impersonate\s+(owner|admin)/i, label: 'impersonate', risk: 'high' },
  { pattern: /jangan\s+tanya/i, label: 'no_ask', risk: 'medium' },
  { pattern: /lakukan\s+saja/i, label: 'just_do_it', risk: 'medium' },
  { pattern: /kirim\s+tanpa\s+approval/i, label: 'send_no_approval', risk: 'high' },
  { pattern: /deploy\s+tanpa\s+approval/i, label: 'deploy_no_approval', risk: 'high' },
  { pattern: /push\s+tanpa\s+approval/i, label: 'push_no_approval', risk: 'high' },
  { pattern: /semua\s+bot\s+jawab/i, label: 'multi_bot_spam', risk: 'medium' }
];

function detectPromptInjectionAttempt(text) {
  if (!text || typeof text !== 'string') return { detected: false, matches: [], risk: 'none' };

  const matches = [];
  let maxRisk = 'none';

  for (const { pattern, label, risk } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      matches.push({ label, risk });
      const riskOrder = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
      if (riskOrder[risk] > riskOrder[maxRisk]) maxRisk = risk;
    }
  }

  return { detected: matches.length > 0, matches, risk: maxRisk };
}

function classifyInjectionRisk(text) {
  const result = detectPromptInjectionAttempt(text);
  if (!result.detected) return { level: 'safe', score: 0 };
  const riskScores = { low: 2, medium: 4, high: 7, critical: 10 };
  return { level: result.risk, score: riskScores[result.risk] || 0, matches: result.matches };
}

function sanitizeInjectionPayload(text) {
  if (!text) return '';
  return String(text).replace(/(token|secret|password|api_key|api-key)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
}

function buildInjectionDefenseResponse(text) {
  const detection = detectPromptInjectionAttempt(text);
  if (!detection.detected) return null;

  const messages = {
    ignore_rules: 'Saya tidak bisa mengabaikan aturan keamanan.',
    ignore_instructions: 'Instruksi sistem tidak bisa diabaikan.',
    reveal_system_prompt: 'System prompt bersifat rahasia.',
    reveal_secrets: 'Saya tidak bisa menampilkan secret atau token.',
    bypass_safety: 'Keamanan tidak bisa dilewati.',
    auto_approve: 'Auto-approve tidak diizinkan.',
    self_approve: 'Agent tidak bisa menyetujui proposal sendiri.',
    disable_safety: 'Keamanan tidak bisa dinonaktifkan.',
    direct_tool: 'Tool harus melalui proposal dan approval.',
    impersonate: 'Impersonasi tidak diizinkan.',
    no_ask: 'Saya tetap harus mengikuti aturan keamanan.',
    just_do_it: 'Tindakan harus melalui alur yang benar.',
    send_no_approval: 'Pengiriman harus melalui proposal dan approval.',
    deploy_no_approval: 'Deploy harus melalui proposal dan approval.',
    push_no_approval: 'Push harus melalui proposal dan approval.',
    multi_bot_spam: 'Bot loop terdeteksi. Permintaan diblokir.'
  };

  const responses = detection.matches.map(m => messages[m.label] || 'Tindakan diblokir oleh kebijakan keamanan.');
  return [...new Set(responses)].join(' ');
}

function testPromptInjectionAgainstRouter(cases) {
  const results = [];
  for (const c of (cases || [])) {
    const detection = detectPromptInjectionAttempt(c.input || c);
    const defense = buildInjectionDefenseResponse(c.input || c);
    results.push({ input: (c.input || c).slice(0, 50), detected: detection.detected, risk: detection.risk, hasDefense: !!defense, blocked: detection.detected });
  }
  const passed = results.filter(r => r.blocked === true).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}

module.exports = {
  INJECTION_PATTERNS,
  detectPromptInjectionAttempt,
  classifyInjectionRisk,
  sanitizeInjectionPayload,
  buildInjectionDefenseResponse,
  testPromptInjectionAgainstRouter
};
