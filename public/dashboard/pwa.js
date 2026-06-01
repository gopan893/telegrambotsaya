/* 
   =========================================
   Telegram AI OS Dashboard - PWA Helpers
   =========================================
*/

const PWA = {
  deferredInstallPrompt: null,
  registration: null,

  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      PWA.showOfflineStatus('Service worker tidak didukung browser ini.');
      return { ok: false, reason: 'SERVICE_WORKER_UNSUPPORTED' };
    }
    try {
      const registration = await navigator.serviceWorker.register('/dashboard/service-worker.js', {
        scope: '/dashboard'
      });
      PWA.registration = registration;

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            PWA.showUpdateAvailable();
          }
        });
      });

      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'PWA_CACHE_CLEARED') {
          Utils.showToast('Cache dashboard dibersihkan.', 'success');
        }
      });

      return { ok: true, registration };
    } catch (err) {
      PWA.showOfflineStatus(`PWA tidak aktif: ${err.message}`);
      return { ok: false, reason: err.message };
    }
  },

  detectInstallAvailability() {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      PWA.deferredInstallPrompt = event;
      const btn = document.getElementById('btn-pwa-install');
      if (btn) btn.classList.remove('hidden');
      Utils.showToast('Dashboard bisa di-install sebagai app.', 'info');
    });
  },

  async showInstallPrompt() {
    if (!PWA.deferredInstallPrompt) {
      Utils.showToast('Install prompt belum tersedia. Gunakan menu browser > Add to Home screen.', 'warning');
      return { ok: false, reason: 'INSTALL_PROMPT_UNAVAILABLE' };
    }
    PWA.deferredInstallPrompt.prompt();
    const choice = await PWA.deferredInstallPrompt.userChoice;
    PWA.deferredInstallPrompt = null;
    Utils.showToast(choice.outcome === 'accepted' ? 'Install dashboard diterima.' : 'Install dashboard dibatalkan.', choice.outcome === 'accepted' ? 'success' : 'info');
    return { ok: choice.outcome === 'accepted', choice };
  },

  showOfflineStatus(message = '') {
    const badge = document.getElementById('pwa-online-badge');
    if (badge) {
      badge.textContent = navigator.onLine ? 'Online' : 'Offline';
      badge.className = `badge ${navigator.onLine ? 'badge-healthy' : 'badge-warning'}`;
    }
    if (message) Utils.showToast(message, navigator.onLine ? 'info' : 'warning');
  },

  showUpdateAvailable() {
    Utils.showToast('Update dashboard tersedia. Reload untuk memakai versi terbaru.', 'info');
    const badge = document.getElementById('pwa-update-badge');
    if (badge) badge.classList.remove('hidden');
  },

  async clearPwaCache() {
    try {
      await Api.apiPost('/pwa/cache-clear-note', {});
    } catch (_) {}
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_PWA_CACHE' });
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
    Utils.showToast('Cache statis dashboard dibersihkan. API data sensitif memang tidak di-cache.', 'success');
    return { ok: true };
  },

  bindSettingsControls(root = document) {
    const installBtn = root.getElementById ? root.getElementById('btn-pwa-install') : root.querySelector?.('#btn-pwa-install');
    const clearBtn = root.getElementById ? root.getElementById('btn-pwa-clear-cache') : root.querySelector?.('#btn-pwa-clear-cache');
    if (installBtn) installBtn.addEventListener('click', () => PWA.showInstallPrompt());
    if (clearBtn) clearBtn.addEventListener('click', () => PWA.clearPwaCache());
    PWA.showOfflineStatus();
  }
};

window.addEventListener('online', () => PWA.showOfflineStatus('Dashboard kembali online.'));
window.addEventListener('offline', () => PWA.showOfflineStatus('Dashboard offline. API data tidak tersedia sampai koneksi kembali.'));

document.addEventListener('DOMContentLoaded', () => {
  PWA.detectInstallAvailability();
  PWA.registerServiceWorker();
  PWA.showOfflineStatus();
});
