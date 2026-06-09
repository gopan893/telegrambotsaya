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

let releaseModule;
try {
  releaseModule = require('./src/release');
  console.log('[release] Release module loaded — v1.0.0-rc.1 ready');
} catch (err) {
  console.warn('[release] Release module not available:', err.message);
}

botModule.startBotServer().catch((error) => {
  console.error('[startup] Bot failed:', error);
  process.exit(1);
});
