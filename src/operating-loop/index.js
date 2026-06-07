'use strict';

const store = require('./operating-loop-store');
const registry = require('./operating-loop-registry');
const collector = require('./system-state-collector');
const snapshotBuilder = require('./operating-snapshot-builder');
const blockerDetector = require('./blocker-detector');
const synthesizer = require('./next-action-synthesizer');
const policy = require('./operating-loop-policy');
const costGuard = require('./operating-loop-cost-guard');
const evalGate = require('./operating-loop-evaluation-gate');
const proposalBridge = require('./operating-loop-proposal-bridge');
const notifier = require('./operating-loop-notifier');
const reports = require('./operating-loop-report-generator');
const runner = require('./operating-loop-runner');
const utils = require('./operating-loop-utils');

module.exports = {
  ...store,
  ...registry,
  ...collector,
  ...snapshotBuilder,
  ...blockerDetector,
  ...synthesizer,
  ...policy,
  ...costGuard,
  ...evalGate,
  ...proposalBridge,
  ...notifier,
  ...reports,
  ...runner,
  ...utils,

  store,
  registry,
  collector,
  snapshotBuilder,
  blockerDetector,
  synthesizer,
  policy,
  costGuard,
  evalGate,
  proposalBridge,
  notifier,
  reports,
  runner,
  utils
};
