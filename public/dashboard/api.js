/* 
   =========================================
   Telegram AI OS Dashboard - API Client
   =========================================
*/

const Api = {
  BASE_URL: '/api/dashboard',

  async request(path, method = 'GET', body = null) {
    const url = `${this.BASE_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...Auth.getAuthHeaders()
    };

    const options = {
      method,
      headers
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      // Auto logout if 401 unauthorized is received on non-public endpoints
      if (response.status === 401 && path !== '/health') {
        Auth.handleUnauthorized(() => {
          window.location.hash = '';
          document.getElementById('login-container').classList.remove('hidden');
          document.getElementById('app-container').classList.add('hidden');
        });
        return { ok: false, status: 401, error: 'UNAUTHORIZED' };
      }

      if (response.status === 404) {
        return { ok: false, status: 404, error: 'NOT_FOUND' };
      }

      if (response.status === 429) {
        return { ok: false, status: 429, error: 'RATE_LIMITED' };
      }

      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      console.error(`API Error on ${method} ${path}:`, err);
      return { ok: false, status: 0, error: 'NETWORK_ERROR', message: err.message };
    }
  },

  async apiGet(path) {
    return this.request(path, 'GET');
  },

  async apiPost(path, body) {
    return this.request(path, 'POST', body);
  },

  async getHealth() {
    return this.apiGet('/health');
  },

  async getSummary() {
    return this.apiGet('/summary');
  },

  async getOps() {
    return this.apiGet('/ops');
  },

  async getReliability() {
    return this.apiGet('/reliability');
  },

  async getBenchmarks() {
    return this.apiGet('/benchmarks');
  },

  async getIncidents() {
    return this.apiGet('/incidents');
  },

  async getCommands() {
    return this.apiGet('/commands');
  },

  async getEnvCheck() {
    return this.apiGet('/env-check');
  },

  async getUserOverview(userId) {
    const encoded = encodeURIComponent(userId);
    return this.apiGet(`/user/${encoded}/overview`);
  },

  async getUserMemories(userId, filters = {}) {
    const encoded = encodeURIComponent(userId);
    let query = `?limit=${filters.limit || 20}`;
    if (filters.q) query += `&q=${encodeURIComponent(filters.q)}`;
    if (filters.type) query += `&type=${encodeURIComponent(filters.type)}`;
    return this.apiGet(`/user/${encoded}/memories${query}`);
  },

  async getUserGoals(userId) {
    const encoded = encodeURIComponent(userId);
    return this.apiGet(`/user/${encoded}/goals`);
  },

  async getUserWorkflows(userId) {
    const encoded = encodeURIComponent(userId);
    return this.apiGet(`/user/${encoded}/workflows`);
  },

  async getUserInsights(userId) {
    const encoded = encodeURIComponent(userId);
    return this.apiGet(`/user/${encoded}/insights`);
  },

  async getUserGraph(userId) {
    const encoded = encodeURIComponent(userId);
    return this.apiGet(`/user/${encoded}/graph`);
  },

  async searchUserGraph(userId, q) {
    const encodedUser = encodeURIComponent(userId);
    const encodedQ = encodeURIComponent(q);
    return this.apiGet(`/user/${encodedUser}/graph/search?q=${encodedQ}`);
  },

  async runDiagnostics() {
    return this.apiPost('/actions/diagnostics/run');
  },

  async runBenchmarkLight() {
    return this.apiPost('/actions/benchmark/run-light');
  },

  async pruneTelemetry() {
    return this.apiPost('/actions/telemetry/prune');
  },

  async refreshOpsSnapshot() {
    return this.apiPost('/actions/ops/refresh');
  }
};
