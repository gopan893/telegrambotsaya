'use strict';

function truncateContent(content, maxLength = 500) {
  if (!content) return '';
  return content.length > maxLength ? content.slice(0, maxLength) + '...' : content;
}

function formatSearchResults(results) {
  return results.map((r, i) => `${i + 1}. [${(r.score || 0).toFixed(3)}] ${r.docId || 'unknown'}\n   ${truncateContent(r.content, 200)}`).join('\n');
}

function estimateTokens(text) {
  return text.split(/\s+/).length;
}

function deduplicateResults(results) {
  const seen = new Set();
  return results.filter(r => {
    const key = r.docId || r.content;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { truncateContent, formatSearchResults, estimateTokens, deduplicateResults };
