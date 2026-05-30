'use strict';

const assert = require('assert');
const router = require('../src/natural-language/natural-tool-router');

function intent(text) {
  return router.detectNaturalToolIntent(text).intent;
}

function run() {
  const weather = router.detectNaturalToolIntent('Cuaca di Tokyo');
  assert.strictEqual(weather.intent, 'WEATHER');
  assert.strictEqual(weather.city, 'Tokyo');

  const search = router.detectNaturalToolIntent('Cari berita AI terbaru');
  assert.strictEqual(search.intent, 'WEB_SEARCH');
  assert(/berita AI terbaru/i.test(search.query), 'search query should keep berita AI terbaru');

  assert.strictEqual(intent('Supaya bisa online gimana?'), 'INTERNET_CAPABILITY_EXPLANATION');
  assert.strictEqual(intent('Halo'), 'NONE');
  assert.strictEqual(intent('25*4'), 'CALCULATE');
  assert.strictEqual(intent('750jam berapa hari'), 'UNIT_CONVERSION');
  assert.strictEqual(intent('dashboard nya dimana?'), 'DASHBOARD_HELP');

  console.log('Natural tool router tests passed');
}

run();
