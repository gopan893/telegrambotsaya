'use strict';

const costUsageStore = require('./cost-usage-store');
const tokenEstimator = require('./token-estimator');
const costEstimator = require('./cost-estimator');
const modelCostRegistry = require('./model-cost-registry');
const modelSelectionPolicy = require('./model-selection-policy');
const budgetPolicy = require('./budget-policy');
const budgetGuard = require('./budget-guard');
const usageAggregator = require('./usage-aggregator');
const costAlerts = require('./cost-alerts');
const promptCompressionAdvisor = require('./prompt-compression-advisor');
const costUtils = require('./cost-utils');

let knowledgeBridge = null;
try { knowledgeBridge = require('../knowledge/project-knowledge-ingestor'); } catch (_) { knowledgeBridge = null; }

module.exports = {
  costUsageStore,
  tokenEstimator,
  costEstimator,
  modelCostRegistry,
  modelSelectionPolicy,
  budgetPolicy,
  budgetGuard,
  usageAggregator,
  costAlerts,
  promptCompressionAdvisor,
  costUtils,
  knowledgeBridge
};
