'use strict';

const ReleaseCandidateStore = require('./release-candidate-store');
const ReleaseFreezeManager = require('./release-freeze-manager');
const ModuleReadinessChecker = require('./module-readiness-checker');
const ProductionReadinessGate = require('./production-readiness-gate');
const CompatibilityVerifier = require('./compatibility-verifier');
const ReleaseRiskReviewer = require('./release-risk-reviewer');
const ReleaseNotesGenerator = require('./release-notes-generator');
const ChangelogGenerator = require('./changelog-generator');
const EnvironmentChecklistGenerator = require('./environment-checklist-generator');
const OperatorGuideGenerator = require('./operator-guide-generator');
const ReleaseProposalBridge = require('./release-proposal-bridge');
const ReleaseUtils = require('./release-utils');

module.exports = {
  ...ReleaseCandidateStore,
  ...ReleaseFreezeManager,
  ...ModuleReadinessChecker,
  ...ProductionReadinessGate,
  ...CompatibilityVerifier,
  ...ReleaseRiskReviewer,
  ...ReleaseNotesGenerator,
  ...ChangelogGenerator,
  ...EnvironmentChecklistGenerator,
  ...OperatorGuideGenerator,
  ...ReleaseProposalBridge,
  utils: ReleaseUtils
};
