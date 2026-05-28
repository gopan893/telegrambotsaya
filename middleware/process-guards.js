'use strict';

function installProcessGuards({ logger, shutdown }) {
  process.on('unhandledRejection', (err) => {
    logger.error('UnhandledRejection:', err?.stack || err?.message || err);
  });

  process.on('uncaughtException', async (err) => {
    logger.error('UncaughtException:', err?.stack || err?.message || err);
    if (typeof shutdown === 'function') {
      await shutdown('uncaughtException').catch((error) => {
        logger.error('Shutdown after uncaughtException failed:', error?.message || error);
      });
    }
  });
}

module.exports = {
  installProcessGuards
};
