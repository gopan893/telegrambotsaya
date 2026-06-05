'use strict';

process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] Unhandled rejection:', reason);
});

let botModule;
try {
  botModule = require('./src/bot');
} catch (err) {
  console.error('[startup] Module load failed:', err);
  process.exit(1);
}

botModule.startBotServer().catch((error) => {
  console.error('[startup] Bot failed:', error);
  process.exit(1);
});
