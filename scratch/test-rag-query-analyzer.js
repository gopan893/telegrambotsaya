'use strict';

const { ragQueryAnalyzer } = require('../src/rag-kb');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const howTo = ragQueryAnalyzer.analyzeQuery('how to install a package');
  assert(howTo.terms.length === 5, 'analyzeQuery returns terms');
  assert(howTo.hasQuestionWords === true, 'analyzeQuery detects question words');
  assert(howTo.estimatedIntent === 'how_to', 'analyzeQuery estimates how_to intent');

  const codeQuery = ragQueryAnalyzer.analyzeQuery('write a function in JavaScript');
  assert(codeQuery.hasCodeIndicators === true, 'analyzeQuery detects code indicators');
  assert(codeQuery.estimatedIntent === 'code', 'analyzeQuery estimates code intent');

  const defQuery = ragQueryAnalyzer.analyzeQuery('what is a vector database');
  assert(defQuery.estimatedIntent === 'definition', 'estimateIntent returns definition');

  const troubleQuery = ragQueryAnalyzer.analyzeQuery('fix the error bug in module');
  assert(troubleQuery.estimatedIntent === 'troubleshooting', 'estimateIntent returns troubleshooting');

  const compareQuery = ragQueryAnalyzer.analyzeQuery('compare Postgres vs MySQL');
  assert(compareQuery.estimatedIntent === 'comparison', 'estimateIntent returns comparison');

  const listingQuery = ragQueryAnalyzer.analyzeQuery('list all available commands');
  assert(listingQuery.estimatedIntent === 'listing', 'estimateIntent returns listing');

  const generalQuery = ragQueryAnalyzer.analyzeQuery('I like pizza');
  assert(generalQuery.estimatedIntent === 'general', 'estimateIntent returns general');

  const filterSyntax = ragQueryAnalyzer.analyzeQuery('find @tag:guide stuff');
  assert(filterSyntax.hasFilterSyntax === true, 'analyzeQuery detects filter syntax');

  const phrases = ragQueryAnalyzer.extractKeyPhrases('the quick brown fox jumps over the lazy dog');
  assert(phrases.includes('quick'), 'extractKeyPhrases keeps non-stop words');
  assert(phrases.includes('brown'), 'extractKeyPhrases keeps content words');
  assert(!phrases.includes('the'), 'extractKeyPhrases removes stop words');
  assert(phrases.length >= 4, 'extractKeyPhrases returns meaningful phrases');

  const shortPhrases = ragQueryAnalyzer.extractKeyPhrases('a is of to');
  assert(shortPhrases.length === 0, 'extractKeyPhrases returns empty for only stop/short words');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
