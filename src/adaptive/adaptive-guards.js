'use strict';

function isHighStakes(text = '') {
  const lower = String(text || '').toLowerCase();
  return /(medis|dokter|obat|hukum|legal|pengacara|investasi|saham|crypto|utang|keselamatan|darurat|bunuh diri|self harm)/i.test(lower);
}

function isHealthRelated(text = '') {
  const lower = String(text || '').toLowerCase();
  return /(pusing|sakit kepala|mual|demam|batuk|flu|lemas|capek|sakit perut|tidak enak badan|medis|dokter|obat)/i.test(lower);
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
    if (isHealthRelated(text)) {
      next.mode = 'health';
    } else if (!next.mode || next.mode === 'simple') {
      next.mode = 'decision';
    }
  }
  if (Number(next.confidence || 0) < 0.45) {
    next.mode = 'simple';
    next.reason = 'Confidence rendah, fallback ke percakapan natural.';
  }
  return next;
}

module.exports = {
  isHighStakes,
  isHealthRelated,
  shouldUseAdaptive,
  capConfidence
};
