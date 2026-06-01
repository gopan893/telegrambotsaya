/* 
   =========================================
   Telegram AI OS Dashboard - Backup Downloads
   =========================================
*/

const BackupDownloads = {
  buildSafeFilename(prefix = 'telegram-aios', scope = 'backup', timestamp = new Date()) {
    const cleanPrefix = String(prefix || 'telegram-aios').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'telegram-aios';
    const cleanScope = String(scope || 'backup').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'backup';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp || Date.now());
    const stamp = date.toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
    return `${cleanPrefix}-${cleanScope}-${stamp}.json`;
  },

  downloadTextFile(filename, text, mimeType = 'text/plain') {
    const blob = new Blob([String(text || '')], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true, filename, bytes: blob.size };
  },

  downloadJsonFile(filename, data) {
    return BackupDownloads.downloadTextFile(filename, JSON.stringify(data || {}, null, 2), 'application/json');
  },

  showDownloadProgress(targetId, message = 'Menyiapkan file backup...') {
    const target = document.getElementById(targetId || 'backup-result');
    if (target) target.innerHTML = `<p class="text-muted">${Utils.escapeHtml(message)}</p>`;
  },

  showDownloadResult(targetId, result = {}, manifest = {}) {
    const target = document.getElementById(targetId || 'backup-result');
    if (!target) return;
    const counts = manifest.itemCounts || {};
    target.innerHTML = `
      <div class="kv-list">
        <div class="kv-item"><span class="kv-key">File</span><span class="kv-value">${Utils.escapeHtml(result.filename || '-')}</span></div>
        <div class="kv-item"><span class="kv-key">Size</span><span class="kv-value">${Utils.formatBytes(result.bytes || 0)}</span></div>
        <div class="kv-item"><span class="kv-key">Checksum</span><span class="kv-value">${Utils.escapeHtml(manifest.checksum || '-')}</span></div>
        <div class="kv-item"><span class="kv-key">Created</span><span class="kv-value">${Utils.escapeHtml(manifest.createdAt || '-')}</span></div>
      </div>
      <pre style="white-space:pre-wrap; margin-top:12px;">${Utils.escapeHtml(JSON.stringify(counts, null, 2))}</pre>
    `;
  },

  async copyExportToClipboardIfSmall(data, maxBytes = 80000) {
    const text = JSON.stringify(data || {}, null, 2);
    if (new Blob([text]).size > maxBytes || !navigator.clipboard) return { ok: false, reason: 'TOO_LARGE_OR_CLIPBOARD_UNAVAILABLE' };
    await navigator.clipboard.writeText(text);
    return { ok: true, bytes: new Blob([text]).size };
  }
};
