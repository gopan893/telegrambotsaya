'use strict';

const selfDevEngine = require('./self-dev-engine');
const sourceExplorer = require('./source-explorer');
const codeGenerator = require('./code-generator');
const gitCommit = require('./git-commit');

module.exports = {
  selfDevEngine,
  sourceExplorer,
  codeGenerator,
  gitCommit,

  /**
   * 1-tap shortcut: register handler ke legacy-runtime
   * @param {object} services { askAI, safeSendMessage, sendChunkedMessage }
   */
  registerHandlers(services) {
    // Intentionally light — full handler di selfDevEngine
  }
};
