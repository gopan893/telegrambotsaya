'use strict';

const scorer = require('../src/research/source-quality-scorer');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

// score source quality
const highSource = { trustLevel: 'high', freshness: 'high', type: 'official_doc', title: 'Official Docs', notes: 'test' };
const lowSource = { trustLevel: 'low', freshness: 'low', type: 'manual_note', title: 'Random Note' };

const highScore = scorer.scoreSourceQuality(highSource);
const lowScore = scorer.scoreSourceQuality(lowSource);
assert(highScore.overall > lowScore.overall, 'high quality source scores higher than low');
assert(highScore.level === 'high', 'high source gets high level');
assert(lowScore.level === 'low' || lowScore.level === 'unknown', 'low source gets low or unknown level');

// report
const report = scorer.buildSourceQualityReport([highSource, lowSource]);
assert(report.total === 2, 'buildSourceQualityReport total');
assert(report.averageQuality > 0, 'buildSourceQualityReport has average');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
