/* 
   =========================================
   Telegram AI OS Dashboard - Auth Module
   =========================================
*/

const Auth = {
  TOKEN_KEY: 'dashboard_admin_token',

  getStoredToken() {
    return localStorage.getItem(this.TOKEN_KEY) || '';
  },

  setStoredToken(token) {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, token.trim());
    } else {
      this.clearStoredToken();
    }
  },

  clearStoredToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  getAuthHeaders() {
    const token = this.getStoredToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  isLoggedIn() {
    return Boolean(this.getStoredToken());
  },

  setLoginButtonState(loading) {
    const btn = document.getElementById('btn-login-submit');
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.textContent = 'Memeriksa token...';
    } else {
      btn.disabled = false;
      btn.textContent = 'Masuk ke Dashboard';
    }
  },

  init(onAuthSuccess, onAuthRequired) {
    const tokenInput = document.getElementById('admin-token');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('btn-logout');

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = tokenInput ? tokenInput.value.trim() : '';
        if (!token) {
          Utils.showToast('Masukkan token terlebih dahulu.', 'warning');
          return;
        }

        this.setLoginButtonState(true);
        this.setStoredToken(token);
        if (tokenInput) tokenInput.value = '';

        // Attempt login verification
        await onAuthSuccess();
        this.setLoginButtonState(false);
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        Utils.confirmAction('Logout', 'Apakah Anda yakin ingin keluar dari dashboard?', () => {
          this.clearStoredToken();
          onAuthRequired();
          Utils.showToast('Logout berhasil', 'info');
        });
      });
    }

    if (this.isLoggedIn()) {
      onAuthSuccess();
    } else {
      onAuthRequired();
    }
  },

  handleUnauthorized(onAuthRequired) {
    this.clearStoredToken();
    onAuthRequired();
    Utils.showToast('Token tidak valid atau salah. Silakan masukkan token yang benar.', 'danger');
  }
};
