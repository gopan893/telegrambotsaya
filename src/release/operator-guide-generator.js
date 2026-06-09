'use strict';

const utils = require('./release-utils');

async function generateAdminOperationGuide(services = {}) {
  return {
    title: 'Admin Operation Guide',
    sections: {
      starting: 'Run "node telebot.js" in production. Ensure all env vars are set.',
      health: 'Check health: GET /health or Telegram /health command.',
      dashboard: 'Access /dashboard with DASHBOARD_ADMIN_TOKEN for full admin panel.',
      monitoring: 'Use Observability tab, /prodhealth, /incidents for production health.',
      backups: 'Use Backup tab or /backupcreate for manual backup. Scheduled backup requires approval.',
      shutdown: 'Send SIGTERM; bot handles cleanup. Hard kill if unresponsive.'
    }
  };
}

async function generateTelegramCommandGuide(services = {}) {
  return {
    title: 'Telegram Command Guide',
    categories: {
      core: '/start, /help, /dashboard, /ping, /stats, /whoami',
      executor: '/pending, /propose, /approve <id>, /runexec <id>, /reject <id>',
      backup: '/backup, /backupcreate, /backups, /restore',
      health: '/health, /prodhealth, /incidents',
      security: '/securitycheck, /secretscan, /securityscore',
      privacy: '/privacy, /datainventory, /exportdata, /deleterequest',
      governance: '/policy, /capability, /simulate',
      deploy: '/deploycheck, /rendercheck, /propose_deploy',
      github: '/githubops, /gitstatus, /propose_push',
      release: '/releasecandidate, /rc, /v1status, /releasefreeze, /readiness, /productionready, /releaseblockers, /releaserisks, /releasenotes, /changelog, /envchecklist, /operatorguide, /propose_release, /propose_release_deploy'
    }
  };
}

async function generateDashboardGuide(services = {}) {
  return {
    title: 'Dashboard Guide',
    tabs: {
      overview: 'System health, storage, uptime, quick actions',
      governance: 'Policy engine, capability registry, simulator, audit',
      security: 'Security scorecard, secret scan, env drift, red-team tests',
      privacy: 'Data inventory, retention policy, export/delete requests',
      'telegram-control': 'Command registry, intent tester, audit log, rate limits',
      deploy: 'Deploy plan, render gate, rollback plan',
      'release-candidate': 'RC status, freeze, readiness, compatibility, risk review, notes, changelog'
    }
  };
}

async function generateApprovalFlowGuide(services = {}) {
  return {
    title: 'Approval Flow Guide',
    flow: [
      'dry-run: Preview what the action would do',
      'Evaluation v2: Validate against safety/quality gates',
      'Executor Proposal: Create proposal from action plan',
      'Approval: Owner/admin reviews and approves',
      'Run: Execute approved proposal via /runexec or dashboard'
    ],
    rules: [
      'Proposal creation does NOT execute action',
      '/approve only approves; does NOT execute',
      '/runexec only runs approved proposals',
      'Auto-approve is blocked for production',
      'All write/external/danger actions must follow this flow'
    ]
  };
}

async function generateIncidentResponseGuide(services = {}) {
  return {
    title: 'Incident Response Guide',
    steps: [
      'Check health: /prodhealth or /health',
      'List incidents: /incidents or Observability tab',
      'Analyze: /analyze_incident <id> for root cause hypothesis',
      'Plan: /responseplan <id> creates response plan',
      'Propose repair: /propose_incident_repair <id> creates repair proposal',
      'Propose rollback: /propose_incident_rollback <id> creates rollback proposal',
      'Approve: /approve <proposalId>',
      'Execute: /runexec <proposalId>',
      'Close: /close_incident <id>'
    ],
    warning: 'Repair/rollback never runs directly. Always requires proposal + approval + run.'
  };
}

async function generateBackupRecoveryGuide(services = {}) {
  return {
    title: 'Backup & Recovery Guide',
    backup: [
      'Manual: /backupcreate or Backup tab -> Create Backup',
      'Scheduled: /backupscheduleadd to create schedule; approval required before run',
      'Download: Backup tab or /backupdownload for download link',
      'Export: /exportsummary for safe summary; dashboard for full JSON'
    ],
    recovery: [
      'Restore: Backup tab -> Upload JSON, preview, confirm "RESTORE"',
      'Disaster recovery: /recovery or Integrity tab for health check',
      'Rollback deploy: Deploy tab or /propose_rollback (proposal-only)'
    ]
  };
}

async function generateSecurityPrivacyGuide(services = {}) {
  return {
    title: 'Security & Privacy Guide',
    security: [
      'Never expose TELEGRAM_TOKEN, DATABASE_URL, API keys, or any secrets',
      'Run /secretscan to check for secret leakage',
      'Run /securityscore to view scorecard',
      'Run /redteam for red-team simulation',
      'All findings are redacted — no raw secrets displayed',
      'Credential rotation is manual checklist only'
    ],
    privacy: [
      'Run /datainventory to see all stored data categories',
      'Use /exportdata to request secure export (secrets redacted)',
      'Use /deleterequest for soft delete requests',
      'Hard delete requires owner + explicit approval',
      'Life OS mood/energy data is owner-only',
      'Privacy audit logs all access and export events'
    ]
  };
}

module.exports = {
  generateAdminOperationGuide,
  generateTelegramCommandGuide,
  generateDashboardGuide,
  generateApprovalFlowGuide,
  generateIncidentResponseGuide,
  generateBackupRecoveryGuide,
  generateSecurityPrivacyGuide
};
