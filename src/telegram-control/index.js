'use strict';

const commandRegistry = require('./telegram-command-registry');
const naturalRouter = require('./telegram-natural-router');
const intentClassifier = require('./telegram-intent-classifier');
const permissionGuard = require('./telegram-permission-guard');
const riskClassifier = require('./telegram-risk-classifier');
const responseFormatter = require('./telegram-response-formatter');
const helpMenu = require('./telegram-help-menu');
const proposalRouter = require('./telegram-proposal-router');
const commandAudit = require('./telegram-command-audit');
const rateLimit = require('./telegram-rate-limit');
const sessionContext = require('./telegram-session-context');
const utils = require('./telegram-utils');

module.exports = {
  commandRegistry,
  naturalRouter,
  intentClassifier,
  permissionGuard,
  riskClassifier,
  responseFormatter,
  helpMenu,
  proposalRouter,
  commandAudit,
  rateLimit,
  sessionContext,
  utils,
  version: '1.0.0',
  name: 'telegram-control'
};
