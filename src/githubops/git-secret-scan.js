'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./githubops-utils');
const store = require('./githubops-store');

const SECRET_PATTERNS = [
  { name: 'TELEGRAM_TOKEN', pattern: /TELEGRAM_TOKEN\s*=\s*\S+/i },
  { name: 'GITHUB_TOKEN', pattern: /GITHUB_TOKEN\s*=\s*\S+/i },
  { name: 'DATABASE_URL', pattern: /DATABASE_URL\s*=\s*\S+/i },
  { name: 'REDIS_URL', pattern: /REDIS_URL\s*=\s*\S+/i },
  { name: 'DASHBOARD_ADMIN_TOKEN', pattern: /DASHBOARD_ADMIN_TOKEN\s*=\s*\S+/i },
  { name: 'GOOGLE_CLIENT_SECRET', pattern: /GOOGLE_CLIENT_SECRET\s*=\s*\S+/i },
  { name: 'CLOUDFLARE_API_TOKEN', pattern: /CLOUDFLARE_API_TOKEN\s*=\s*\S+/i },
  { name: 'RENDER_DEPLOY_HOOK', pattern: /RENDER_DEPLOY_HOOK\s*=\s*\S+/i },
  { name: 'ghp_token', pattern: /ghp_[a-zA-Z0-9]{36}/g },
  { name: 'github_pat', pattern: /github_pat_[a-zA-Z0-9_]{36,}/g },
  { name: 'sk_key', pattern: /sk-[a-zA-Z0-9]{20,}/g },
  { name: 'gsk_key', pattern: /gsk_[a-zA-Z0-9]{20,}/g },
  { name: 'tvly_key', pattern: /tvly-[a-zA-Z0-9]{20,}/g },
  { name: 'postgresql_url', pattern: /postgresql:\/\/[^\s]+/g },
  { name: 'rediss_url', pattern: /rediss:\/\/[^\s]+/g }
];

function scanChangedFilesForSecrets(files, services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const findings = [];

  for (const file of files) {
    const fp = path.join(repoRoot, file);
    if (!fs.existsSync(fp)) continue;
    try {
      const content = fs.readFileSync(fp, 'utf8');
      for (const sp of SECRET_PATTERNS) {
        const matches = content.match(sp.pattern);
        if (matches) {
          findings.push({
            file,
            secretType: sp.name,
            count: matches.length,
            redacted: true,
            detail: `Found ${matches.length} match(es) of pattern "${sp.name}" in ${file}`
          });
        }
      }
    } catch (_) {}
  }

  return findings;
}

function scanGitDiffForSecrets(input) {
  const findings = [];
  for (const sp of SECRET_PATTERNS) {
    const matches = input.match(sp.pattern);
    if (matches) {
      findings.push({
        secretType: sp.name,
        count: matches.length,
        redacted: true,
        detail: `Found ${matches.length} match(es) of pattern "${sp.name}" in diff`
      });
    }
  }
  return findings;
}

function redactSecretFindings(findings) {
  return findings.map(f => ({
    file: f.file || '(diff)',
    secretType: f.secretType,
    count: f.count,
    redacted: true,
    detail: f.detail
  }));
}

function blockPushIfSecretsFound(findings) {
  return findings.length > 0;
}

function buildSecretScanReport(findings) {
  const blocked = findings.length > 0;
  const report = {
    ok: !blocked,
    blocked,
    totalFindings: findings.length,
    findings: redactSecretFindings(findings),
    summary: blocked
      ? `⚠️ ${findings.length} potential secret(s) found. Push blocked.`
      : '✅ No secrets detected in changed files.',
    timestamp: utils.now()
  };
  store.setSecretScan(report);
  return report;
}

function runSecretScan(files, diff, services) {
  const findings = [];
  findings.push(...scanChangedFilesForSecrets(files, services));
  if (diff) findings.push(...scanGitDiffForSecrets(diff));
  return buildSecretScanReport(findings);
}

module.exports = {
  scanChangedFilesForSecrets,
  scanGitDiffForSecrets,
  redactSecretFindings,
  blockPushIfSecretsFound,
  buildSecretScanReport,
  runSecretScan
};
