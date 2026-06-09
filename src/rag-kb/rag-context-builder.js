'use strict';

function buildContext(results, options = {}) {
  const maxTokens = options.maxTokens || 2000;
  const includeScores = options.includeScores !== false;
  const sections = [];
  let totalTokens = 0;
  for (const r of results) {
    const header = includeScores ? `[Source: ${r.docId || 'unknown'} | Score: ${(r.score || 0).toFixed(3)}]` : `[Source: ${r.docId || 'unknown'}]`;
    const content = r.content || r.text || '';
    const estimatedTokens = content.split(/\s+/).length + header.split(/\s+/).length;
    if (totalTokens + estimatedTokens > maxTokens) break;
    sections.push(`${header}\n${content}`);
    totalTokens += estimatedTokens;
  }
  return {
    context: sections.join('\n\n'),
    sourceCount: sections.length,
    totalTokens,
    truncated: results.length > sections.length
  };
}

function buildStructuredContext(results, options = {}) {
  const maxSources = options.maxSources || 5;
  const topResults = results.slice(0, maxSources);
  return {
    sources: topResults.map(r => ({
      id: r.docId,
      score: r.score,
      excerpt: (r.content || '').slice(0, 500)
    })),
    count: topResults.length,
    totalAvailable: results.length
  };
}

module.exports = { buildContext, buildStructuredContext };
