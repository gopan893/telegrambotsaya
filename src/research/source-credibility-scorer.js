'use strict';

const utils = require('./research-utils');

function scoreSourceCredibility(source = {}, task = {}) {
  let score = 45;
  const text = `${source.type || ''} ${source.title || ''} ${source.url || ''} ${source.docPath || ''}`.toLowerCase();
  if (source.type === 'project_doc' || /agents\.md|readme|docs\//.test(text)) score += 35;
  if (source.type === 'knowledge') score += 20;
  if (/official|docs\.github|render\.com|openai\.com|nodejs\.org|telegram\.org/.test(text)) score += 35;
  if (/blog|forum|reddit|medium|katanya|unknown/.test(text)) score -= 20;
  if (task.scope === 'api_docs' && source.type !== 'web' && !/official|docs/.test(text)) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function scoreSourceFreshness(source = {}, task = {}) {
  const req = task.sourceRequirements?.freshness || task.plan?.freshnessRequirement || 'medium';
  if (req === 'local_repo_truth') return source.type === 'project_doc' ? 92 : 70;
  if (!source.retrievedAt) return 55;
  const ageDays = (Date.now() - Date.parse(source.retrievedAt || 0)) / (24 * 60 * 60 * 1000);
  if (req === 'high') {
    if (ageDays <= 7) return 95;
    if (ageDays <= 45) return 78;
    return 45;
  }
  if (ageDays <= 90) return 85;
  return 60;
}

function scoreSourceRelevance(source = {}, task = {}) {
  return Math.round(utils.textScore(`${task.topic || ''} ${task.question || ''}`, `${source.title || ''} ${source.summary || ''} ${source.safeExcerpt || ''}`) * 100);
}

function detectLowQualitySource(source = {}) {
  const reasons = [];
  const text = `${source.title || ''} ${source.summary || ''} ${source.url || ''}`.toLowerCase();
  if (/katanya|rumor|tidak jelas|unverified/.test(text)) reasons.push('Unverified language detected.');
  if (source.type === 'web' && !source.url) reasons.push('Web source missing URL.');
  if ((source.credibilityScore || 0) < 50) reasons.push('Low credibility score.');
  return { lowQuality: reasons.length > 0, reasons };
}

function buildSourceCredibilityReport(sources = [], task = {}) {
  const scored = utils.safeArray(sources).map((source) => {
    const credibilityScore = source.credibilityScore ?? scoreSourceCredibility(source, task);
    const freshnessScore = scoreSourceFreshness(source, task);
    const relevanceScore = scoreSourceRelevance(source, task);
    const lowQuality = detectLowQualitySource({ ...source, credibilityScore });
    return {
      ...source,
      credibilityScore,
      freshnessScore,
      relevanceScore,
      lowQuality: lowQuality.lowQuality,
      warnings: lowQuality.reasons
    };
  });
  const average = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + (item.credibilityScore || 0), 0) / scored.length)
    : 0;
  return {
    sources: scored,
    averageCredibility: average,
    warnings: scored.flatMap((item) => item.warnings || []).slice(0, 12)
  };
}

module.exports = {
  buildSourceCredibilityReport,
  detectLowQualitySource,
  scoreSourceCredibility,
  scoreSourceFreshness,
  scoreSourceRelevance
};

