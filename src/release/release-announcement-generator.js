'use strict';

const utils = require('./release-utils');

const ReleaseAnnouncementGenerator = {
  generateReleaseAnnouncement(releaseId, services = {}) {
    const release = { id: releaseId, version: 'v1.0.0' };
    return {
      title: 'Stable AI OS v1.0.0 — Production Release',
      message: [
        `Stable AI OS v1.0.0 has been released.`,
        `Release ID: ${releaseId}`,
        `Version: ${release.version}`,
        `Highlights:`,
        `- Production-ready release candidate pipeline with stabilization audit`,
        `- Universal Telegram Control Layer with natural language routing`,
        `- Unified Governance Policy Engine with capability control and approval safety`,
        `- Security Hardening Center with red-team audit and prompt injection defense`,
        `- Privacy Data Retention & Export Control with strict redaction`,
        `- Continuous Improvement & Learning Engine`,
        `- Life OS personal productivity system`,
        `- Dashboard with 40+ tabs, PWA, mobile dark UI`,
        `- Executor approval boundary with Evaluation v2`,
        `See docs/ for full documentation.`
      ].join('\n'),
      createdAt: utils.formatTimestamp()
    };
  }
};

module.exports = ReleaseAnnouncementGenerator;
