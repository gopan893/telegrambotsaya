'use strict';

function isHighStakes(text = '') {
  return /(medis|hukum|legal|investasi|saham|crypto|keselamatan|darurat|utang|diagnosis|obat)/i.test(String(text));
}

function addHumanJudgmentNote(text, confidence = 0.65) {
  if (!isHighStakes(text) && confidence >= 0.55) return '';
  return 'Catatan: confidence terbatas. Gunakan ini sebagai kerangka berpikir, bukan keputusan final.';
}

function preventOverAnalysis(text = '') {
  return String(text || '').length < 80;
}

module.exports = {
  isHighStakes,
  addHumanJudgmentNote,
  preventOverAnalysis
};
