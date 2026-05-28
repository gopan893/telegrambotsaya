'use strict';

const assert = require('assert');
const natural = require('../src/natural-language/natural-router');
const semantic = require('../src/intent/semantic-parser');

assert.equal(natural.normalizeInputForRouting('750jam berapa hari?'), '750 jam berapa hari?');
assert.equal(natural.normalizeInputForRouting('2hari'), '2 hari');

const conversion = natural.detectNaturalIntent('750jam berapa hari?');
assert.equal(conversion.intent, 'UNIT_CONVERSION');
assert(conversion.conversion.answer.includes('750 jam = 31 hari 6 jam'));
assert(conversion.conversion.answer.includes('31,25 hari'));

const renderText = natural.detectNaturalIntent('Saya mendapatkan render free tier dengan 750 jam pemakaian');
assert.equal(renderText.intent, 'GENERAL_CHAT');

const health = natural.detectNaturalIntent('Saya merasa pusing');
assert.equal(health.intent, 'HEALTH_ADVICE');
assert(natural.buildHealthAdvice('Saya merasa pusing').includes('Aku bukan dokter'));

const math = natural.detectNaturalIntent('25*4');
assert.equal(math.intent, 'MATH_CALCULATION');
assert.equal(math.expression, '25*4');

const followUp = natural.detectNaturalIntent('Kenapa?');
assert.equal(followUp.intent, 'FOLLOW_UP');

(async () => {
  const parsed = await semantic.parseSemanticIntent('Saya mendapatkan render free tier dengan 750 jam pemakaian', 'u1', {
    askAI: async () => {
      throw new Error('askAI should not be called for duration guard');
    }
  });
  assert.equal(parsed.intent, 'NONE');
  console.log('Natural language router checks passed.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
