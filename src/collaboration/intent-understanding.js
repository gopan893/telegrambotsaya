'use strict';

function understand(text = '') {
  const lower = String(text || '').toLowerCase();
  if (/pilih|keputusan|opsi|lebih baik/.test(lower)) return { intent: 'decision', confidence: 0.78 };
  if (/belajar|roadmap|ajarkan/.test(lower)) return { intent: 'learning', confidence: 0.76 };
  if (/blind spot|asumsi|perspektif|risiko/.test(lower)) return { intent: 'critical-thinking', confidence: 0.74 };
  if (/strategi|planning|tujuan/.test(lower)) return { intent: 'strategy', confidence: 0.72 };
  return { intent: 'thinking', confidence: 0.55 };
}

module.exports = {
  understand
};
