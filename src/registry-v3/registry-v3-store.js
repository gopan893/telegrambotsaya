/**
 * Registry v3 Store
 * Central storage for registry v3 draft and frozen contracts
 */

class RegistryV3Store {
  constructor() {
    this.draft = null;
    this.frozen = null;
    this.freezeMetadata = null;
    this.versionHistory = [];
  }

  setDraft(draft) {
    this.draft = draft;
  }

  getDraft() {
    return this.draft;
  }

  setFrozen(frozen, metadata) {
    this.frozen = frozen;
    this.freezeMetadata = metadata || {
      frozenAt: new Date().toISOString(),
      frozenBy: 'system',
      contractVersion: '3.0.0',
      status: 'frozen'
    };
  }

  getFrozen() {
    return this.frozen;
  }

  getFreezeMetadata() {
    return this.freezeMetadata;
  }

  isFrozen() {
    return this.frozen !== null;
  }

  addVersionHistory(version) {
    this.versionHistory.push({
      ...version,
      recordedAt: new Date().toISOString()
    });
  }

  getVersionHistory() {
    return this.versionHistory;
  }

  getCurrentVersion() {
    return this.freezeMetadata?.contractVersion || null;
  }

  clear() {
    this.draft = null;
    this.frozen = null;
    this.freezeMetadata = null;
    this.versionHistory = [];
  }

  getStatus() {
    return {
      hasDraft: this.draft !== null,
      isFrozen: this.frozen !== null,
      currentVersion: this.getCurrentVersion(),
      freezeMetadata: this.freezeMetadata,
      versionHistoryCount: this.versionHistory.length
    };
  }
}

module.exports = new RegistryV3Store();
