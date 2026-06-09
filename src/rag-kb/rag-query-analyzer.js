'use strict';

function analyzeQuery(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  return {
    original: query,
    terms,
    termCount: terms.length,
    hasQuestionWords: /\b(what|why|how|when|where|who|which|is|are|do|does|can|could|would|should)\b/i.test(query),
    hasCodeIndicators: /\b(code|function|api|endpoint|method|class|import|export|module)\b/i.test(query),
    hasFilterSyntax: /@\w+:\S+/.test(query),
    estimatedIntent: estimateIntent(query)
  };
}

function estimateIntent(query) {
  const q = query.toLowerCase();
  if (/\b(how\s+to|example|tutorial|guide)\b/.test(q)) return 'how_to';
  if (/\b(what\s+is|define|explain|meaning)\b/.test(q)) return 'definition';
  if (/\b(error|bug|fail|issue|problem)\b/.test(q)) return 'troubleshooting';
  if (/\b(compare|vs|versus|difference)\b/.test(q)) return 'comparison';
  if (/\b(list|all|every|show|find)\b/.test(q)) return 'listing';
  if (/\b(code|function|api|snippet|implementation)\b/.test(q)) return 'code';
  return 'general';
}

function extractKeyPhrases(query) {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while']);
  return query.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()) && w.length > 2);
}

module.exports = { analyzeQuery, estimateIntent, extractKeyPhrases };
