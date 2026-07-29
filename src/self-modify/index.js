'use strict';

const selfDevEngine = require('./self-dev-engine');
const sourceExplorer = require('./source-explorer');
const codeGenerator = require('./code-generator');
const gitCommit = require('./git-commit');
const refactorEngine = require('./refactor-engine');
const learningLoop = require('./learning-loop');
const autoDetect = require('./auto-detect');

module.exports = {
  selfDevEngine,
  sourceExplorer,
  codeGenerator,
  gitCommit,
  refactorEngine,
  learningLoop,
  autoDetect,

  registerHandlers(services) {
    // Intentionally light
  }
};
