'use strict';

const utils = require('./research-utils');

function detectMissingSourceTypes(task = {}, sources = []) {
  const types = new Set(utils.safeArray(sources).map((source) => source.type));
  return utils.safeArray(task.sourceRequirements?.requiredTypes)
    .filter((type) => !types.has(type))
    .map((type) => `Missing required source type: ${type}`);
}

function detectUnsupportedClaims(summary = {}, evidence = []) {
  const text = typeof summary === 'string' ? summary : `${summary.answerSummary || ''} ${summary.recommendation || ''}`;
  if (!text) return [];
  const claims = text.split(/(?<=[.!?])\s+/).filter((line) => line.length > 30);
  return claims
    .filter((claim) => !utils.safeArray(evidence).some((item) => utils.textScore(claim, `${item.claim} ${item.supportSummary}`) > 0.18))
    .slice(0, 8)
    .map((claim) => `Unsupported or weakly supported claim: ${utils.compactText(claim, 120)}`);
}

function detectResearchGaps(task = {}, evidence = [], services = {}) {
  const sources = task.sources || [];
  const gaps = [
    ...detectMissingSourceTypes(task, sources),
    ...utils.safeArray(task.evidencePack?.missing)
  ];
  if (!sources.some((source) => source.type === 'project_doc')) gaps.push('No project documentation source found.');
  if (task.sourceRequirements?.externalSearchNeeded && !sources.some((source) => source.type === 'web')) {
    gaps.push('No verified live web source; current provider behavior remains unknown.');
  }
  if (!utils.safeArray(evidence).length) gaps.push('No evidence pack available.');
  if (utils.safeArray(evidence).some((item) => item.confidence < 0.5)) gaps.push('Some evidence has low confidence.');
  return [...new Set(gaps)].slice(0, 20);
}

function suggestNextResearchSteps(task = {}, gaps = [], services = {}) {
  const steps = [];
  if (gaps.some((gap) => /web|official|provider/i.test(gap))) steps.push('Verify with official provider docs using a configured read-only search connector.');
  if (gaps.some((gap) => /project documentation|source type/i.test(gap))) steps.push('Review AGENTS.md, README, architecture map, command docs, and integration contract.');
  if (task.scope === 'deployment') steps.push('Check Render deploy logs manually before making a repair/rollback proposal.');
  if (task.scope === 'security') steps.push('Run safety gate and redact any secret-like input before storage.');
  if (!steps.length) steps.push('Collect one more independent source before treating the recommendation as high confidence.');
  return steps.slice(0, 6);
}

module.exports = {
  detectMissingSourceTypes,
  detectResearchGaps,
  detectUnsupportedClaims,
  suggestNextResearchSteps
};

