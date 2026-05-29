'use strict';

const { startBotServer } = require('./src/bot');

startBotServer().catch((error) => {
  console.error('[startup] Bot failed:', error);
  process.exit(1);
});
