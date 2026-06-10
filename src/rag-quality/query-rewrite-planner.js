'use strict';

const { extractKeyPhrases, estimateIntent } = require('../rag-kb/rag-query-analyzer');

const REWRITE_STRATEGIES = {
  expansion: 'expansion',
  refinement: 'refinement',
  disambiguation: 'disambiguation',
  specification: 'specification',
  reformulation: 'reformulation'
};

function planQueryRewrite(query, context) {
  if (!query || typeof query !== 'string') {
    return { original: query, rewritten: query, strategy: 'none', reasons: ['invalid_query'] };
  }

  const trimmed = query.trim();
  const analysis = analyzeQueryForRewrite(trimmed, context);
  const strategy = selectStrategy(analysis);
  const rewritten = applyStrategy(trimmed, strategy, analysis, context);

  return {
    original: trimmed,
    rewritten,
    strategy: strategy.name,
    keyPhrases: analysis.keyPhrases,
    intent: analysis.intent,
    reasons: strategy.reasons,
    addedTerms: strategy.addedTerms || [],
    removedTerms: strategy.removedTerms || []
  };
}

function analyzeQueryForRewrite(query, context) {
  const terms = query.toLowerCase().split(/\s+/);
  const keyPhrases = extractKeyPhrases(query);
  const intent = estimateIntent(query);

  return {
    terms,
    keyPhrases,
    intent,
    termCount: terms.length,
    hasCodeIndicators: /\b(code|function|api|endpoint|method|class|import|export|module)\b/i.test(query),
    hasQuestionWords: /\b(what|why|how|when|where|who|which)\b/i.test(query),
    isShort: terms.length <= 3,
    contextTags: context?.tags || [],
    contextDomain: context?.domain || 'general'
  };
}

function selectStrategy(analysis) {
  if (analysis.isShort && !analysis.hasQuestionWords) {
    return {
      name: REWRITE_STRATEGIES.expansion,
      reasons: ['short_query_needs_expansion'],
      addedTerms: []
    };
  }
  if (analysis.termCount > 10) {
    return {
      name: REWRITE_STRATEGIES.refinement,
      reasons: ['long_query_needs_refinement'],
      removedTerms: []
    };
  }
  if (analysis.hasCodeIndicators) {
    return {
      name: REWRITE_STRATEGIES.specification,
      reasons: ['code_query_needs_specification'],
      addedTerms: []
    };
  }
  if (analysis.isShort) {
    return {
      name: REWRITE_STRATEGIES.disambiguation,
      reasons: ['ambiguous_short_query'],
      addedTerms: []
    };
  }
  return {
    name: REWRITE_STRATEGIES.reformulation,
    reasons: ['standard_reformulation'],
    addedTerms: []
  };
}

function applyStrategy(query, strategy, analysis, context) {
  switch (strategy.name) {
    case REWRITE_STRATEGIES.expansion:
      return expandQuery(query, analysis, context, strategy);
    case REWRITE_STRATEGIES.refinement:
      return refineQuery(query, analysis, strategy);
    case REWRITE_STRATEGIES.specification:
      return specifyQuery(query, analysis, context, strategy);
    case REWRITE_STRATEGIES.disambiguation:
      return disambiguateQuery(query, analysis, context, strategy);
    case REWRITE_STRATEGIES.reformulation:
      return reformulateQuery(query, analysis, strategy);
    default:
      return query;
  }
}

function expandQuery(query, analysis, context, strategy) {
  let expanded = query;
  const additions = [];
  if (context?.domain && context.domain !== 'general') {
    additions.push(context.domain);
  }
  if (analysis.hasCodeIndicators) {
    additions.push('implementation');
  }
  if (context?.tags && context.tags.length > 0) {
    additions.push(context.tags[0]);
  }
  if (additions.length > 0) {
    expanded = `${expanded} ${additions.join(' ')}`;
    strategy.addedTerms = additions;
  }
  return expanded;
}

function refineQuery(query, analysis, strategy) {
  const keyPhrases = analysis.keyPhrases.slice(0, 5);
  const refined = keyPhrases.join(' ');
  strategy.removedTerms = analysis.terms.filter(t => !keyPhrases.includes(t));
  return refined || query;
}

function specifyQuery(query, analysis, context, strategy) {
  let specified = query;
  const additions = [];
  if (!query.includes('node') && !query.includes('javascript') && !query.includes('js')) {
    additions.push('node.js');
  }
  if (context?.projectName) {
    additions.push(context.projectName);
  }
  if (additions.length > 0) {
    specified = `${specified} ${additions.join(' ')}`;
    strategy.addedTerms = additions;
  }
  return specified;
}

function disambiguateQuery(query, analysis, context, strategy) {
  let disambiguated = query;
  const additions = [];
  if (context?.domain) additions.push(context.domain);
  if (context?.recentTopic) additions.push(context.recentTopic);
  if (additions.length > 0) {
    disambiguated = `${disambiguated} ${additions.join(' ')}`;
    strategy.addedTerms = additions;
  }
  return disambiguated;
}

function reformulateQuery(query, analysis, strategy) {
  const keyPhrases = analysis.keyPhrases;
  if (keyPhrases.length > 0) {
    return keyPhrases.join(' ');
  }
  return query;
}

function rewriteBatch(queries, context) {
  if (!Array.isArray(queries)) return [];
  return queries.map(q => planQueryRewrite(q, context));
}

module.exports = { planQueryRewrite, rewriteBatch, REWRITE_STRATEGIES, analyzeQueryForRewrite };
