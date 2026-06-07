'use strict';

const assert = require('assert');
const scorer = require('../src/research/source-credibility-scorer');

const official = scorer.scoreSourceCredibility({ type: 'web', title: 'Official Render docs', url: 'https://render.com/docs' }, { scope: 'deployment' });
const forum = scorer.scoreSourceCredibility({ type: 'web', title: 'random forum katanya', url: 'https://example.com/forum' }, { scope: 'deployment' });
assert(official > forum, 'official source scores higher than random forum');
assert(scorer.buildSourceCredibilityReport([{ type: 'project_doc', title: 'AGENTS.md' }]).averageCredibility > 70, 'project docs credible');
console.log('test-source-credibility-scorer: ok');

