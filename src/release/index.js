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
const productionReleaseStore = require('./production-release-store');
const ProductionReleaseManager = require('./production-release-manager');
const RolloutReadinessGate = require('./rollout-readiness-gate');
const ReleaseRolloutPlanner = require('./release-rollout-planner');
const GitHubReleaseProposalBuilder = require('./github-release-proposal-builder');
const ProductionDeployProposalBuilder = require('./production-deploy-proposal-builder');
const ReleaseVerificationChecker = require('./release-verification-checker');
const ReleaseAnnouncementGenerator = require('./release-announcement-generator');
const ReleasePostmortemTemplate = require('./release-postmortem-template');

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
  productionReleaseStore,
  ProductionReleaseManager,
  RolloutReadinessGate,
  ReleaseRolloutPlanner,
  GitHubReleaseProposalBuilder,
  ProductionDeployProposalBuilder,
  ReleaseVerificationChecker,
  ReleaseAnnouncementGenerator,
  ReleasePostmortemTemplate,
  utils: ReleaseUtils
};
