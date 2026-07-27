'use strict';

const { redactSecrets, DEFAULT_CONSTRAINTS } = require('./coding-utils');

const PROMPT_TEMPLATES = {
  default: `You are an expert Node.js developer. Implement the following change according to strict project constraints.

PROJECT CONSTRAINTS:
- Runtime: ${DEFAULT_CONSTRAINTS.runtime}
- Module System: ${DEFAULT_CONSTRAINTS.moduleSystem}
- Framework: ${DEFAULT_CONSTRAINTS.framework}
- Dashboard: ${DEFAULT_CONSTRAINTS.dashboard}
- Storage: ${DEFAULT_CONSTRAINTS.storage}
- TypeScript: NOT allowed
- React/Next/Vue: NOT allowed
- Large Refactor: NOT allowed
- Preserve ALL existing commands and features
- External writes require evaluation gate + approval

TASK:
{title}

REQUEST SUMMARY:
{summary}

AFFECTED AREAS:
{affectedAreas}

FILES TO MODIFY:
{proposedFiles}

IMPLEMENTATION STEPS:
{implementationSteps}

COMPATIBILITY CHECKLIST:
{compatibilityChecklist}

TESTS TO RUN:
{tests}

RISK LEVEL: {riskLevel}

RULES:
1. Only modify the proposed files
2. Follow CommonJS (require/module.exports)
3. Do not add TypeScript, React, Next.js, or Vue
4. Do not refactor more than necessary
5. Do not add shell execution or code evaluation
6. Do not expose secrets or tokens
7. Include rollback instructions
8. Provide clear commit message
9. Output the complete changed files with explanations`,

  hotfix: `You are an expert Node.js developer fixing a bug.

PROJECT CONSTRAINTS:
- Runtime: Node.js 20, CommonJS
- Framework: Express webhook
- No TypeScript, React, Next, Vue
- Preserve all existing commands

BUG DESCRIPTION:
{title}

REQUEST SUMMARY:
{summary}

AFFECTED AREAS:
{affectedAreas}

FILES TO MODIFY:
{proposedFiles}

IMPLEMENTATION STEPS:
{implementationSteps}

TESTS:
{tests}

RULES:
1. Minimal change to fix the bug
2. CommonJS only
3. Do not break existing features
4. Include rollback instructions
5. Provide commit message`,

  phase: `You are an expert AI architect implementing a new phase for a Telegram AI bot project.

PROJECT CONSTRAINTS:
- Runtime: Node.js 20, CommonJS
- Framework: Express webhook
- Dashboard: Vanilla HTML/CSS/JS (PWA)
- Storage: PostgreSQL/Redis with JSON fallback
- No TypeScript, React, Next, Vue
- No large refactor
- Preserve ALL existing commands and features
- External writes require evaluation gate + approval

PHASE DESCRIPTION:
{title}

REQUEST SUMMARY:
{summary}

SCOPE:
{affectedAreas}

FILES TO CREATE/MODIFY:
{proposedFiles}

IMPLEMENTATION STEPS:
{implementationSteps}

COMPATIBILITY CHECKLIST:
{compatibilityChecklist}

TEST PLAN:
{tests}

RULES:
1. Follow project constraints strictly
2. Use CommonJS (require/module.exports)
3. Vanilla JS for dashboard, no frameworks
4. Preserve backward compatibility
5. No shell execution or arbitrary code execution
6. No direct external writes without approval gate
7. Include rollback plan
8. Provide clear commit message
9. Make testable, modular changes`
};

function generateCodexPrompt(changePlan, testPlan, riskReview, services = {}) {
  if (!changePlan) return 'Error: No change plan provided.';

  const template = PROMPT_TEMPLATES[changePlan.category] || PROMPT_TEMPLATES.default;

  let prompt = template
    .replace(/{title}/g, redactSecrets(changePlan.title || 'Untitled'))
    .replace(/{summary}/g, redactSecrets(changePlan.requestSummary || ''))
    .replace(/{affectedAreas}/g, formatList(changePlan.affectedAreas))
    .replace(/{proposedFiles}/g, formatList(changePlan.proposedFiles))
    .replace(/{implementationSteps}/g, formatNumbered(changePlan.implementationSteps))
    .replace(/{compatibilityChecklist}/g, formatList(changePlan.compatibilityChecklist))
    .replace(/{tests}/g, formatTests(testPlan))
    .replace(/{riskLevel}/g, changePlan.riskLevel || 'low');

  // Add risk review section if available
  if (riskReview) {
    prompt += '\n\nRISK REVIEW:\n';
    if (riskReview.overallRisk) {
      prompt += `Overall Risk: ${riskReview.overallRisk}\n`;
    }
    if (riskReview.reviews) {
      for (const review of riskReview.reviews) {
        prompt += `- ${review.agent}: ${review.severity}\n`;
        for (const issue of (review.issues || [])) {
          prompt += `  * ${issue}\n`;
        }
      }
    }
  }

  // Add constraints section
  if (changePlan.constraints) {
    prompt += '\n\nPROJECT CONSTRAINTS:\n';
    for (const [k, v] of Object.entries(changePlan.constraints)) {
      if (typeof v === 'boolean') {
        prompt += `- ${k}: ${v ? 'Yes' : 'No'}\n`;
      } else {
        prompt += `- ${k}: ${v}\n`;
      }
    }
  }

  // Add missing repo config warning
  if (changePlan.missingRepoConfig && changePlan.missingRepoConfig.length > 0) {
    prompt += '\n\nNOTE: Missing repo config: ' + changePlan.missingRepoConfig.join(', ') + '\n';
  }

  return redactSecrets(prompt);
}

function generateHotfixPrompt(input = {}, services = {}) {
  const plan = {
    category: 'bug_fix',
    title: input.title || 'Hotfix',
    requestSummary: input.summary || input.description || '',
    affectedAreas: input.affectedAreas || ['src'],
    proposedFiles: input.proposedFiles || [],
    implementationSteps: input.steps || [],
    compatibilityChecklist: [],
    riskLevel: 'medium'
  };
  return generateCodexPrompt(plan, null, null, services);
}

function generatePhasePrompt(input = {}, services = {}) {
  const plan = {
    category: 'phase_prompt',
    title: input.title || 'New Phase',
    requestSummary: input.summary || input.description || '',
    affectedAreas: input.affectedAreas || ['src', 'docs', 'scratch'],
    proposedFiles: input.proposedFiles || [],
    implementationSteps: input.steps || [],
    compatibilityChecklist: input.compatibilityChecklist || [],
    riskLevel: 'medium'
  };
  return generateCodexPrompt(plan, null, null, services);
}

function generateCompactPrompt(input = {}, services = {}) {
  const title = redactSecrets(input.title || 'Coding task');
  const summary = redactSecrets(input.summary || '');
  const files = formatList(input.proposedFiles || []);
  const steps = formatNumbered(input.steps || []);

  return redactSecrets(`Implement: ${title}

${summary}

Files:
${files}

Steps:
${steps}

Constraints: Node.js 20, CommonJS, Express, vanilla dashboard, no TS/React/Next/Vue. Preserve all commands. No external writes without approval.`);
}

function formatList(arr) {
  if (!arr || arr.length === 0) return '- None specified';
  return arr.map(item => `- ${item}`).join('\n');
}

function formatNumbered(arr) {
  if (!arr || arr.length === 0) return '1. No steps specified';
  return arr.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

function formatTests(testPlan) {
  if (!testPlan) return '- Run node --check telebot.js\n- Run relevant smoke tests';
  const parts = [];
  if (testPlan.smokeCommands && testPlan.smokeCommands.length > 0) {
    parts.push('Smoke tests:\n' + testPlan.smokeCommands.map(c => `- ${c}`).join('\n'));
  }
  if (testPlan.regressionTests && testPlan.regressionTests.length > 0) {
    parts.push('Regression tests:\n' + testPlan.regressionTests.map(t => `- ${t.name}: ${t.command} => ${t.expected}`).join('\n'));
  }
  return parts.length > 0 ? parts.join('\n') : '- Run node --check telebot.js';
}

module.exports = {
  generateCodexPrompt,
  generateHotfixPrompt,
  generatePhasePrompt,
  generateCompactPrompt
};
