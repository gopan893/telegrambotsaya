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

  init(onAuthSuccess, onAuthRequired) {
    const tokenInput = document.getElementById('admin-token');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('btn-logout');

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const token = tokenInput.value.trim();
      if (!token) return;

      this.setStoredToken(token);
      tokenInput.value = '';
      
      // Attempt login verification
      onAuthSuccess();
    });

    logoutBtn.addEventListener('click', () => {
      Utils.confirmAction('Logout', 'Apakah Anda yakin ingin keluar dari dashboard?', () => {
        this.clearStoredToken();
        onAuthRequired();
        Utils.showToast('Logout berhasil', 'info');
      });
    });

    if (this.isLoggedIn()) {
      onAuthSuccess();
    } else {
      onAuthRequired();
    }
  },

  handleUnauthorized(onAuthRequired) {
    this.clearStoredToken();
    onAuthRequired();
    Utils.showToast('Token tidak valid atau belum diset di server.', 'danger');
  }
};
