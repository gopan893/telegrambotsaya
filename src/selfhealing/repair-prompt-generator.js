'use strict';

const utils = require('./selfhealing-utils');

function generateCodexRepairPrompt(repairPlan) {
  return [
    '## Task',
    repairPlan.title,
    '',
    '## Problem',
    repairPlan.problemSummary,
    '',
    '## Root Cause',
    repairPlan.suspectedRootCause,
    '',
    '## Affected Areas',
    (repairPlan.affectedAreas || []).join(', '),
    '',
    '## Constraints',
    '- CommonJS Node.js 20',
    '- Vanilla HTML/CSS/JS dashboard',
    '- No TypeScript/React/Next/Vue',
    '- No large refactor',
    '- Keep existing features',
    '- No secrets exposed',
    '',
    '## Files to Audit',
    (repairPlan.filesLikelyAffected || []).join('\n'),
    '',
    '## Requirements',
    (repairPlan.repairSteps || []).map((s, i) => (i + 1) + '. ' + s).join('\n'),
    '',
    '## Tests to Run',
    (repairPlan.testsToRun || []).join('\n'),
    '',
    '## Risk Level',
    repairPlan.riskLevel || 'medium',
    '',
    '## Approval Required',
    repairPlan.requiresApproval ? 'Yes' : 'No',
    '',
    '## Rollback Note',
    'If this repair causes regression, revert changes and re-run all tests.',
    ''
  ].join('\n');
}

function generateHermesRepairPrompt(repairPlan) {
  return [
    'HERMES REPAIR REQUEST',
    '====================',
    '',
    'Context: ' + repairPlan.title,
    '',
    'Problem: ' + repairPlan.problemSummary,
    '',
    'Root cause hypothesis: ' + repairPlan.suspectedRootCause,
    '',
    'Minimal patch strategy:',
    (repairPlan.repairSteps || []).map(s => '  - ' + s).join('\n'),
    '',
    'Affected files:',
    (repairPlan.filesLikelyAffected || []).map(f => '  - ' + f).join('\n'),
    '',
    'Constraints:',
    '  - CommonJS, Node 20',
    '  - Vanilla JS only, no TypeScript',
    '  - No React/Next/Vue',
    '  - No secret exposure',
    '  - Approval-first for critical changes',
    '',
    'Manual test:',
    (repairPlan.testsToRun || []).map(t => '  - ' + t).join('\n'),
    '',
    'Risk: ' + repairPlan.riskLevel,
    'Approval: ' + (repairPlan.requiresApproval ? 'REQUIRED' : 'Not required'),
    '',
    'Do NOT auto-execute. Create proposal if change needed.',
    ''
  ].join('\n');
}

function generateCompactRepairPrompt(repairPlan) {
  return [
    'Fix: ' + repairPlan.title,
    '',
    repairPlan.problemSummary,
    '',
    'Root cause: ' + repairPlan.suspectedRootCause,
    '',
    'Files:',
    (repairPlan.filesLikelyAffected || []).map(f => '  ' + f).join('\n'),
    '',
    'Steps:',
    (repairPlan.repairSteps || []).map(s => '  ' + s).join('\n'),
    '',
    'Tests:',
    (repairPlan.testsToRun || []).join(', '),
    '',
    'Risk: ' + repairPlan.riskLevel,
    ''
  ].join('\n');
}

function generateP0OnlyRepairPrompt(repairPlan) {
  return [
    'P0 HOTFIX: ' + repairPlan.title,
    '',
    repairPlan.problemSummary,
    '',
    'Critical files:',
    (repairPlan.filesLikelyAffected || []).slice(0, 4).map(f => '  ' + f).join('\n'),
    '',
    'Required fix:',
    (repairPlan.repairSteps || []).slice(0, 3).map(s => '  ' + s).join('\n'),
    '',
    'Verify: ' + (repairPlan.testsToRun || []).slice(0, 2).join(', '),
    ''
  ].join('\n');
}

function createRepairPromptGenerator() {
  return {
    generateCodexRepairPrompt,
    generateHermesRepairPrompt,
    generateCompactRepairPrompt,
    generateP0OnlyRepairPrompt
  };
}

module.exports = { createRepairPromptGenerator };
