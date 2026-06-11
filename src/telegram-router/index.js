'use strict';

const telegramIntentClassifier = require('./telegram-intent-classifier');
const telegramDomainRouter = require('./telegram-domain-router');
const telegramContextBuilder = require('./telegram-context-builder');
const telegramAgentSelector = require('./telegram-agent-selector');
const telegramRiskDetector = require('./telegram-risk-detector');
const telegramPrivacyFilter = require('./telegram-privacy-filter');
const telegramRouterExplainer = require('./telegram-router-explainer');
const telegramRouterRegressionGuard = require('./telegram-router-regression-guard');
const telegramRouterUtils = require('./telegram-router-utils');

module.exports = {
  telegramIntentClassifier,
  telegramDomainRouter,
  telegramContextBuilder,
  telegramAgentSelector,
  telegramRiskDetector,
  telegramPrivacyFilter,
  telegramRouterExplainer,
  telegramRouterRegressionGuard,
  telegramRouterUtils,
  version: '1.0.0',
  name: 'telegram-router'
};
