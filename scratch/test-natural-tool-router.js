'use strict';

const assert = require('assert');
const naturalToolRouter = require('../src/tools/natural-tool-router');

// Mock services
const mockServices = {
  weatherCalled: null,
  searchCalled: null,
  explainCalled: null,
  messagesSent: [],
  
  getWeather(city) {
    mockServices.weatherCalled = city;
    return Promise.resolve(`Cuaca di ${city} cerah berawan, 22°C.`);
  },
  
  summarizeSearchWithRefs(query, userId, systemPrompt) {
    mockServices.searchCalled = query;
    return Promise.resolve(`Hasil pencarian untuk "${query}": AI sangat berkembang pesat di tahun 2026.`);
  },
  
  getSystemPrompt(userId) {
    return 'Kamu adalah asisten AI.';
  },
  
  safeSendMessage(chatId, text, extra) {
    mockServices.messagesSent.push({ chatId, text, extra });
    return Promise.resolve({ message_id: 999 });
  },
  
  sendChunkedMessage(chatId, text, extra) {
    mockServices.messagesSent.push({ chatId, text, extra });
    return Promise.resolve({ message_id: 999 });
  }
};

async function testIntentDetection() {
  console.log('Testing Natural Intent Detection...');
  
  // Weather queries
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('cuaca di jakarta'), 'WEATHER');
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('suhu udara bandung hari ini'), 'WEATHER');
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('ramalan cuaca tokyo besok'), 'WEATHER');
  
  // Search queries
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('cari berita ai terbaru'), 'WEB_SEARCH');
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('search info terkini tentang groq'), 'WEB_SEARCH');
  
  // Internet explain queries
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('bagaimana bot bisa online?'), 'INTERNET_CAPABILITY_EXPLANATION');
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('cara agar online di render'), 'INTERNET_CAPABILITY_EXPLANATION');
  
  // Simple greetings (should be NONE/false)
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('halo bot'), 'NONE');
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('selamat pagi'), 'NONE');
  
  // Calculator/Math (should be CALCULATE, not SEARCH or WEATHER)
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('hitung 45 * 12'), 'CALCULATE');
  assert.strictEqual(naturalToolRouter.detectNaturalToolIntent('5 + 7 * (12 - 3)'), 'CALCULATE');
  
  console.log('✅ Intent detection test passed.');
}

async function testCityExtraction() {
  console.log('Testing City Extraction...');
  
  assert.strictEqual(naturalToolRouter.extractWeatherCity('cuaca di jakarta'), 'Jakarta');
  assert.strictEqual(naturalToolRouter.extractWeatherCity('bagaimana cuaca kota Tokyo besok?'), 'Tokyo');
  assert.strictEqual(naturalToolRouter.extractWeatherCity('suhu udara di New York hari ini'), 'New York');
  
  console.log('✅ City extraction test passed.');
}

async function testHandlerWeather() {
  console.log('Testing Weather Handler...');
  
  // Force process env key to be present
  process.env.OPENWEATHER_API_KEY = 'mock-key';
  
  mockServices.weatherCalled = null;
  mockServices.messagesSent = [];
  
  const ctx = {
    chatId: '12345',
    userId: '67890',
    userText: 'bagaimana cuaca di Tokyo?',
    msg: { message_id: 100 }
  };
  
  const handled = await naturalToolRouter.handleNaturalToolIntent(ctx, mockServices);
  assert.strictEqual(handled, true);
  assert.strictEqual(mockServices.weatherCalled, 'Tokyo');
  assert.strictEqual(mockServices.messagesSent[0].text, 'Cuaca di Tokyo cerah berawan, 22°C.');
  
  console.log('✅ Weather handler test passed.');
}

async function testHandlerSearch() {
  console.log('Testing Search Handler...');
  
  // Force process env key to be present
  process.env.TAVILY_API_KEY = 'mock-key';
  
  mockServices.searchCalled = null;
  mockServices.messagesSent = [];
  
  const ctx = {
    chatId: '12345',
    userId: '67890',
    userText: 'cari berita AI terbaru di Indonesia',
    msg: { message_id: 101 }
  };
  
  const handled = await naturalToolRouter.handleNaturalToolIntent(ctx, mockServices);
  assert.strictEqual(handled, true);
  // clean query should strip filler words
  assert.strictEqual(mockServices.searchCalled, 'AI Indonesia');
  assert.ok(mockServices.messagesSent[0].text.includes('AI sangat berkembang'));
  
  console.log('✅ Search handler test passed.');
}

async function testHandlerExplain() {
  console.log('Testing Explain Handler...');
  
  mockServices.messagesSent = [];
  
  const ctx = {
    chatId: '12345',
    userId: '67890',
    userText: 'cara agar bot bisa online',
    msg: { message_id: 102 }
  };
  
  const handled = await naturalToolRouter.handleNaturalToolIntent(ctx, mockServices);
  assert.strictEqual(handled, true);
  assert.ok(mockServices.messagesSent[0].text.includes('OpenWeather API'));
  assert.ok(mockServices.messagesSent[0].text.includes('Tavily Search API'));
  
  console.log('✅ Explain handler test passed.');
}

async function runAll() {
  await testIntentDetection();
  await testCityExtraction();
  await testHandlerWeather();
  await testHandlerSearch();
  await testHandlerExplain();
  console.log('🎉 All Natural Tool Router tests passed successfully!');
}

runAll().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
