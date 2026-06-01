/* 
   =========================================
   Telegram AI OS Dashboard - Import UX
   =========================================
*/

const BackupImportUI = {
  maxBytes: 2 * 1024 * 1024,

  parseJsonSafely(text = '') {
    try {
      const payload = JSON.parse(String(text || '{}'));
      const bytes = new Blob([JSON.stringify(payload)]).size;
      if (bytes > BackupImportUI.maxBytes) return { ok: false, reason: 'IMPORT_FILE_TOO_LARGE', bytes };
      return { ok: true, payload, bytes };
    } catch (err) {
      return { ok: false, reason: 'INVALID_JSON', error: err.message };
    }
  },

  summarizePayload(payload = {}) {
    const snapshot = payload.snapshot || payload;
    const manifest = payload.manifest || {};
    const data = snapshot.data || {};
    return {
      type: payload.exportType || (snapshot.backupVersion ? 'snapshot' : 'unknown'),
      version: snapshot.backupVersion || manifest.version || '-',
      workspaceId: manifest.workspaceId || snapshot.scope?.workspaceId || '-',
      userId: manifest.userId || snapshot.scope?.userId || '-',
      dataTypes: Object.keys(data),
      itemCounts: Object.fromEntries(Object.entries(data).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0)
      ]))
    };
  },

  renderPreview(preview = {}) {
    const diff = preview.diff || {};
    const rows = Object.entries(diff).map(([key, item]) => `
      <tr>
        <td><code>${Utils.escapeHtml(key)}</code></td>
        <td>${Number(item.incoming || 0)}</td>
        <td>${Number(item.existing || 0)}</td>
        <td>${Utils.escapeHtml(item.mode || 'merge_upsert')}</td>
      </tr>
    `).join('');
    return `
      <div class="alert alert-info">Import hanya divalidasi/preview dulu. Restore tetap perlu plan dan konfirmasi <code>RESTORE</code>.</div>
      <div class="table-responsive">
        <table>
          <thead><tr><th>Data</th><th>Incoming</th><th>Existing</th><th>Mode</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="text-center text-muted">Tidak ada diff.</td></tr>'}</tbody>
        </table>
      </div>
      <pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(preview, null, 2))}</pre>
    `;
  },

  bindImportDropZone(options = {}) {
    const dropZone = document.getElementById(options.dropZoneId || 'import-drop-zone');
    const textarea = document.getElementById(options.textareaId || 'import-json');
    const output = document.getElementById(options.outputId || 'backup-result');
    if (!dropZone || !textarea) return;

    const loadFile = async (file) => {
      if (!file) return;
      if (file.size > BackupImportUI.maxBytes) {
        Utils.showToast('File import terlalu besar.', 'danger');
        return;
      }
      const text = await file.text();
      textarea.value = text;
      const parsed = BackupImportUI.parseJsonSafely(text);
      if (parsed.ok && output) {
        const summary = BackupImportUI.summarizePayload(parsed.payload);
        output.innerHTML = `<pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(summary, null, 2))}</pre>`;
      }
    };

    dropZone.addEventListener('dragover', event => {
      event.preventDefault();
      dropZone.classList.add('is-dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragover'));
    dropZone.addEventListener('drop', event => {
      event.preventDefault();
      dropZone.classList.remove('is-dragover');
      loadFile(event.dataTransfer?.files?.[0]);
    });

    const fileInput = document.getElementById(options.fileInputId || 'import-file');
    if (fileInput) fileInput.addEventListener('change', event => loadFile(event.target.files?.[0]));
  }
};
