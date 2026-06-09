'use strict';

function scoreSourceQuality(source, services = {}) {
  const freshness = scoreFreshness(source, services);
  const authority = scoreAuthority(source, services);
  const relevance = scoreRelevance(source, source.query || '', services);
  const overall = Math.round((freshness * 0.3 + authority * 0.4 + relevance * 0.3) * 100) / 100;
  return { overall, freshness, authority, relevance, level: qualityLevel(overall) };
}

function scoreFreshness(source, services = {}) {
  const map = { high: 1.0, medium: 0.7, low: 0.4, unknown: 0.2 };
  return map[source.freshness] || 0.2;
}

function scoreAuthority(source, services = {}) {
  const map = { high: 1.0, medium: 0.7, low: 0.4, unknown: 0.2 };
  const trust = map[source.trustLevel] || 0.2;
  const typeBoost = { official_doc: 0.2, paper: 0.15, repo: 0.1, project_doc: 0.05, manual_note: 0, web_summary: -0.05 };
  return Math.max(0, Math.min(1, trust + (typeBoost[source.type] || 0)));
}

function scoreRelevance(source, query = '', services = {}) {
  if (!query) return 0.5;
  const q = String(query).toLowerCase();
  const title = String(source.title || '').toLowerCase();
  const notes = String(source.notes || '').toLowerCase();
  const terms = q.split(/\s+/).filter(t => t.length > 2);
  if (!terms.length) return 0.5;
  const matches = terms.filter(t => title.includes(t) || notes.includes(t)).length;
  return Math.min(1, matches / terms.length + 0.3);
}

function buildSourceQualityReport(sources = [], services = {}) {
  if (!sources.length) return { total: 0, averageQuality: 0, levels: {}, report: 'Tidak ada sumber untuk dinilai.' };
  const scored = sources.map(s => ({ source: s, score: scoreSourceQuality(s, services) }));
  const avg = scored.reduce((sum, s) => sum + s.score.overall, 0) / scored.length;
  const levels = {};
  scored.forEach(s => { levels[s.score.level] = (levels[s.score.level] || 0) + 1; });
  return {
    total: scored.length,
    averageQuality: Math.round(avg * 100) / 100,
    levels,
    scored: scored.map(s => ({ id: s.source.id, title: s.source.title, quality: s.score.overall, level: s.score.level })),
    report: `Rata-rata kualitas sumber: ${(avg * 100).toFixed(0)}% (${scored.length} sumber). ${Object.entries(levels).map(([k, v]) => `${k}: ${v}`).join(', ')}`
  };
}

function qualityLevel(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.25) return 'low';
  return 'unknown';
}

module.exports = { scoreSourceQuality, scoreFreshness, scoreAuthority, scoreRelevance, buildSourceQualityReport };
