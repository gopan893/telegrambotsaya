'use strict';

const SECURITY_UTILS = require('./security-utils');

function calculateSecurityScorecard(auditResults) {
  const ar = auditResults || {};

  const secretScore = calculateSecretScore(ar.secretResults);
  const envScore = calculateEnvScore(ar.envResults);
  const permissionScore = calculatePermissionScore(ar.permissionResults);
  const capabilityScore = calculateCapabilityScore(ar.capabilityResults);
  const approvalSafetyScore = calculateApprovalSafetyScore(ar.approvalResults);
  const redTeamScore = calculateRedTeamScore(ar.redTeamResults);

  const scores = [secretScore, envScore, permissionScore, capabilityScore, approvalSafetyScore, redTeamScore];
  const overallScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  const scorecard = {
    id: SECURITY_UTILS.generateId('scorecard'),
    workspaceId: 'default',
    overallScore,
    secretScore,
    envScore,
    permissionScore,
    capabilityScore,
    approvalSafetyScore,
    redTeamScore,
    privacyScore: Math.min(100, permissionScore + 5),
    recommendations: buildRecommendations({ overallScore, secretScore, envScore, permissionScore, capabilityScore, approvalSafetyScore, redTeamScore }),
    createdAt: new Date().toISOString()
  };

  return scorecard;
}

function calculateSecretScore(results) {
  if (!results) return 100;
  const findings = results.findings || results;
  if (!Array.isArray(findings) || findings.length === 0) return 100;
  const criticalPenalty = findings.filter(f => f.severity === 'critical').length * 15;
  const highPenalty = findings.filter(f => f.severity === 'high').length * 8;
  const mediumPenalty = findings.filter(f => f.severity === 'medium').length * 4;
  return Math.max(0, Math.min(100, 100 - criticalPenalty - highPenalty - mediumPenalty));
}

function calculateEnvScore(results) {
  if (!results) return 100;
  const issues = results.issues || results;
  if (!Array.isArray(issues) || issues.length === 0) return 100;
  const criticalPenalty = issues.filter(i => i.severity === 'critical').length * 15;
  const highPenalty = issues.filter(i => i.severity === 'high').length * 8;
  const mediumPenalty = issues.filter(i => i.severity === 'medium').length * 3;
  return Math.max(0, Math.min(100, 100 - criticalPenalty - highPenalty - mediumPenalty));
}

function calculatePermissionScore(results) {
  if (!results) return 100;
  const findings = results.findings || results;
  if (!Array.isArray(findings) || findings.length === 0) return 100;
  const criticalPenalty = findings.filter(f => f.severity === 'critical').length * 20;
  const highPenalty = findings.filter(f => f.severity === 'high').length * 10;
  return Math.max(0, Math.min(100, 100 - criticalPenalty - highPenalty));
}

function calculateCapabilityScore(results) {
  if (!results) return 100;
  const findings = results.findings || results;
  if (!Array.isArray(findings) || findings.length === 0) return 100;
  const highPenalty = findings.filter(f => f.severity === 'high').length * 10;
  const mediumPenalty = findings.filter(f => f.severity === 'medium').length * 5;
  return Math.max(0, Math.min(100, 100 - highPenalty - mediumPenalty));
}

function calculateApprovalSafetyScore(results) {
  if (!results) return 100;
  const findings = results.findings || results;
  if (!Array.isArray(findings) || findings.length === 0) return 100;
  const allBlocked = findings.every(f => f.directExecutionBlocked !== false);
  if (!allBlocked) return 30;
  return 100;
}

function calculateRedTeamScore(results) {
  if (!results) return 100;
  return results.score || (results.passed && results.total ? Math.round((results.passed / results.total) * 100) : 100);
}

function buildRecommendations(scores) {
  const recs = [];
  if (scores.secretScore < 85) recs.push('Improve secret scanning and rotate exposed credentials.');
  if (scores.envScore < 85) recs.push('Fix environment variable issues detected in env drift.');
  if (scores.permissionScore < 90) recs.push('Review and fix permission configurations.');
  if (scores.capabilityScore < 90) recs.push('Review dangerous capability assignments.');
  if (scores.approvalSafetyScore < 100) recs.push('Fix approval bypass paths.');
  if (scores.redTeamScore < 90) recs.push('Address red-team test failures.');
  if (recs.length === 0) recs.push('Security posture is excellent. Continue monitoring.');
  return recs;
}

function buildSecurityScoreExplanation(scorecard) {
  if (!scorecard) return 'No scorecard available.';
  return [
    `*Security Scorecard*`,
    `Overall: ${scorecard.overallScore}/100 (${SECURITY_UTILS.categorizeSeverity(scorecard.overallScore)})`,
    '',
    `Secret Score: ${scorecard.secretScore}/100`,
    `Env Score: ${scorecard.envScore}/100`,
    `Permission Score: ${scorecard.permissionScore}/100`,
    `Capability Score: ${scorecard.capabilityScore}/100`,
    `Approval Safety Score: ${scorecard.approvalSafetyScore}/100`,
    `Red-Team Score: ${scorecard.redTeamScore}/100`,
    '',
    'Recommendations:',
    ...scorecard.recommendations.map(r => `- ${r}`)
  ].join('\n');
}

module.exports = {
  calculateSecurityScorecard,
  calculateSecretScore,
  calculateEnvScore,
  calculatePermissionScore,
  calculateCapabilityScore,
  calculateApprovalSafetyScore,
  calculateRedTeamScore,
  buildSecurityScoreExplanation
};
