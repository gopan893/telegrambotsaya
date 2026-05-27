'use strict';

function isHighStakes(text = '') {
  const lower = String(text || '').toLowerCase();
  return /(medis|dokter|obat|hukum|legal|pengacara|investasi|saham|crypto|utang|keselamatan|darurat|bunuh diri|self harm)/i.test(lower);
}

function shouldUseAdaptive(user = {}, command = null) {
  if (command) return false;
  if (user.adaptive?.enabled === false) return false;
  if (user.manualModeOverride && user.mode && user.mode !== 'auto') return false;
  return true;
}

function capConfidence(decision = {}, text = '') {
  const next = { ...decision };
  if (isHighStakes(text)) {
    next.safetyNote = 'Topik high-stakes: perlu verifikasi manusia/profesional dan hindari kepastian palsu.';
    next.confidence = Math.min(Number(next.confidence || 0.6), 0.74);
    next.mode = 'governance-review';
  }
  if (Number(next.confidence || 0) < 0.45) {
    next.mode = 'auto';
    next.reason = 'Confidence rendah, fallback ke percakapan natural.';
  }
  return next;
}

module.exports = {
  isHighStakes,
  shouldUseAdaptive,
  capConfidence
};
