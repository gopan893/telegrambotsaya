'use strict';

const securityAuditStore = require('./security-audit-store');
const secretSurfaceScanner = require('./secret-surface-scanner');
const secretFindingClassifier = require('./secret-finding-classifier');
const credentialRotationPlanner = require('./credential-rotation-planner');
const envDriftDetector = require('./env-drift-detector');
const permissionAuditor = require('./permission-auditor');
const capabilityRiskAuditor = require('./capability-risk-auditor');
const approvalBypassAuditor = require('./approval-bypass-auditor');
const redteamSimulator = require('./redteam-simulator');
const promptInjectionTester = require('./prompt-injection-tester');
const securityScorecard = require('./security-scorecard');
const securityReportGenerator = require('./security-report-generator');
const securityProposalBridge = require('./security-proposal-bridge');
const securityUtils = require('./security-utils');

module.exports = {
  securityAuditStore,
  secretSurfaceScanner,
  secretFindingClassifier,
  credentialRotationPlanner,
  envDriftDetector,
  permissionAuditor,
  capabilityRiskAuditor,
  approvalBypassAuditor,
  redteamSimulator,
  promptInjectionTester,
  securityScorecard,
  securityReportGenerator,
  securityProposalBridge,
  securityUtils
};
