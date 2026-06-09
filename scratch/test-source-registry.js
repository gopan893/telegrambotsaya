'use strict';

const research = require('../src/research');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { workspaceId: 'test' };

  // register source
  const source = await research.sourceRegistry.registerResearchSource({ title: 'OpenAI API Docs', type: 'official_doc', trustLevel: 'high', freshness: 'high', urlOrPath: 'https://platform.openai.com/docs' }, svc);
  assert(source && source.id, 'registerResearchSource returns id');
  assert(source.trustLevel === 'high', 'source trustLevel preserved');

  // validate source
  assert(research.sourceRegistry.validateResearchSource(source), 'validateResearchSource valid');
  assert(!research.sourceRegistry.validateResearchSource({ title: 'X', type: 'invalid' }), 'validateResearchSource invalid');
  assert(!research.sourceRegistry.validateResearchSource({ title: 'Valid', type: 'repo', trustLevel: 'invalid' }), 'validateResearchSource bad trust');

  // list sources
  const sources = await research.sourceRegistry.listResearchSources({}, svc);
  assert(sources.length >= 1, 'listResearchSources returns sources');

  // filter by trust
  const high = await research.sourceRegistry.listResearchSources({ trustLevel: 'high' }, svc);
  assert(high.length >= 1, 'listResearchSources filter trustLevel');

  // citation block
  const citation = research.sourceRegistry.buildSourceCitationBlock([source]);
  assert(citation.includes(source.title), 'buildSourceCitationBlock includes title');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
