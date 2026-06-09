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
const RcStabilizationAuditor = require('./rc-stabilization-auditor');
const RcBlockerClassifier = require('./rc-blocker-classifier');
const RcRegressionChecker = require('./rc-regression-checker');
const RcFixPolicy = require('./rc-fix-policy');
const RcStabilizationReportGenerator = require('./rc-stabilization-report-generator');

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
  RcStabilizationAuditor,
  RcBlockerClassifier,
  RcRegressionChecker,
  RcFixPolicy,
  RcStabilizationReportGenerator,
  utils: ReleaseUtils
};
