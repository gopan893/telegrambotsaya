/* 
   =========================================
   Telegram AI OS Dashboard - API Client
   =========================================
*/

const API_BASE = '/api/dashboard';

const Api = {
  BASE_URL: API_BASE,

  async request(path, method = 'GET', body = null, options = {}) {
    const url = `${this.BASE_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (options.auth !== false) Object.assign(headers, Auth.getAuthHeaders());

    const fetchOptions = {
      method,
      headers
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      
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

      if (response.status === 403) {
        const data = await response.json().catch(() => ({}));
        return { ok: false, status: 403, error: data.error || 'DASHBOARD_DISABLED', data };
      }

      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      console.error(`API Error on ${method} ${path}:`, err);
      return { ok: false, status: 0, error: 'NETWORK_ERROR', message: err.message };
    }
  },

  async apiGet(path, options = {}) {
    return this.request(path, 'GET', null, options);
  },

  async apiPost(path, body, options = {}) {
    return this.request(path, 'POST', body, options);
  },

  async getHealth() {
    return this.apiGet('/health', { auth: false });
  },

  async getSummary() {
    return this.apiGet('/summary');
  },

  async getOps() {
    return this.apiGet('/ops');
  },

  async getStorage() {
    return this.apiGet('/storage');
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

  async getAuditLogs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.set('limit', filters.limit);
    if (filters.action) params.set('action', filters.action);
    if (filters.status) params.set('status', filters.status);
    if (filters.targetType) params.set('targetType', filters.targetType);
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.workspaceId) params.set('workspaceId', filters.workspaceId);
    if (filters.decision) params.set('decision', filters.decision);
    const query = params.toString();
    return this.apiGet(`/audit${query ? `?${query}` : ''}`);
  },

  workspaceQuery(workspaceId) {
    return workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
  },

  async getUserOverview(userId, workspaceId = '') {
    const encoded = encodeURIComponent(userId);
    return this.apiGet(`/user/${encoded}/overview${this.workspaceQuery(workspaceId)}`);
  },

  async getUserMemories(userId, filters = {}) {
    const encoded = encodeURIComponent(userId);
    let query = `?limit=${filters.limit || 20}`;
    if (filters.q) query += `&q=${encodeURIComponent(filters.q)}`;
    if (filters.type) query += `&type=${encodeURIComponent(filters.type)}`;
    if (filters.workspaceId) query += `&workspaceId=${encodeURIComponent(filters.workspaceId)}`;
    return this.apiGet(`/user/${encoded}/memories${query}`);
  },

  async getUserGoals(userId, workspaceId = '') {
    const encoded = encodeURIComponent(userId);
    return this.apiGet(`/user/${encoded}/goals${this.workspaceQuery(workspaceId)}`);
  },

  async getUserWorkflows(userId, workspaceId = '') {
    const encoded = encodeURIComponent(userId);
    return this.apiGet(`/user/${encoded}/workflows${this.workspaceQuery(workspaceId)}`);
  },

  async getUserInsights(userId, workspaceId = '') {
    const encoded = encodeURIComponent(userId);
    return this.apiGet(`/user/${encoded}/insights${this.workspaceQuery(workspaceId)}`);
  },

  async getUserGraph(userId, workspaceId = '') {
    const encoded = encodeURIComponent(userId);
    return this.apiGet(`/user/${encoded}/graph${this.workspaceQuery(workspaceId)}`);
  },

  async listPlans(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.actorId) params.set('actorId', filters.actorId);
    if (filters.workspaceId) params.set('workspaceId', filters.workspaceId);
    if (filters.includeArchived) params.set('includeArchived', 'true');
    if (filters.limit) params.set('limit', filters.limit);
    const query = params.toString();
    return this.apiGet(`/planner${query ? `?${query}` : ''}`);
  },

  async createPlan(payload) {
    return this.apiPost('/planner/create', payload);
  },

  async getPlan(planId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.actorId) params.set('actorId', filters.actorId);
    const query = params.toString();
    return this.apiGet(`/planner/${encodeURIComponent(planId)}${query ? `?${query}` : ''}`);
  },

  async updatePlan(planId, payload) {
    return this.apiPost(`/planner/${encodeURIComponent(planId)}/update`, payload);
  },

  async archivePlan(planId, payload = {}) {
    return this.apiPost(`/planner/${encodeURIComponent(planId)}/archive`, payload);
  },

  async listPlanTasks(planId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.actorId) params.set('actorId', filters.actorId);
    if (filters.includeArchived) params.set('includeArchived', 'true');
    const query = params.toString();
    return this.apiGet(`/planner/${encodeURIComponent(planId)}/tasks${query ? `?${query}` : ''}`);
  },

  async createTask(planId, payload) {
    return this.apiPost(`/planner/${encodeURIComponent(planId)}/tasks/create`, payload);
  },

  async updateTask(taskId, payload) {
    return this.apiPost(`/planner/tasks/${encodeURIComponent(taskId)}/update`, payload);
  },

  async markTaskDone(taskId, payload = {}) {
    return this.apiPost(`/planner/tasks/${encodeURIComponent(taskId)}/done`, payload);
  },

  async markTaskBlocked(taskId, payload = {}) {
    return this.apiPost(`/planner/tasks/${encodeURIComponent(taskId)}/blocked`, payload);
  },

  async archiveTask(taskId, payload = {}) {
    return this.apiPost(`/planner/tasks/${encodeURIComponent(taskId)}/archive`, payload);
  },

  async reorderTasks(payload) {
    return this.apiPost('/planner/tasks/reorder', payload);
  },

  async getNextActions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.actorId) params.set('actorId', filters.actorId);
    if (filters.workspaceId) params.set('workspaceId', filters.workspaceId);
    const query = params.toString();
    return this.apiGet(`/planner/next-actions${query ? `?${query}` : ''}`);
  },

  async generatePlanFromGoal(payload) {
    return this.apiPost('/planner/from-goal', payload);
  },

  async generatePlanFromText(payload) {
    return this.apiPost('/planner/from-text', payload);
  },

  async listExecutionProposals(filters = {}) {
    const params = new URLSearchParams();
    ['userId', 'actorId', 'workspaceId', 'status', 'riskLevel', 'sourceType', 'limit'].forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });
    const query = params.toString();
    return this.apiGet(`/executor${query ? `?${query}` : ''}`);
  },

  async listPendingExecutions(filters = {}) {
    const params = new URLSearchParams();
    ['userId', 'actorId', 'workspaceId', 'limit'].forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });
    const query = params.toString();
    return this.apiGet(`/executor/pending${query ? `?${query}` : ''}`);
  },

  async getExecutionProposal(proposalId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.actorId) params.set('actorId', filters.actorId);
    const query = params.toString();
    return this.apiGet(`/executor/${encodeURIComponent(proposalId)}${query ? `?${query}` : ''}`);
  },

  async createExecutionProposal(payload) {
    return this.apiPost('/executor/propose', payload);
  },

  async proposeExecutionFromTask(payload) {
    return this.apiPost('/executor/propose/from-task', payload);
  },

  async proposeExecutionFromGoal(payload) {
    return this.apiPost('/executor/propose/from-goal', payload);
  },

  async proposeExecutionFromWorkflow(payload) {
    return this.apiPost('/executor/propose/from-workflow', payload);
  },

  async approveExecution(proposalId, payload = {}) {
    return this.apiPost(`/executor/${encodeURIComponent(proposalId)}/approve`, payload);
  },

  async rejectExecution(proposalId, payload = {}) {
    return this.apiPost(`/executor/${encodeURIComponent(proposalId)}/reject`, payload);
  },

  async cancelExecution(proposalId, payload = {}) {
    return this.apiPost(`/executor/${encodeURIComponent(proposalId)}/cancel`, payload);
  },

  async runExecution(proposalId, payload = {}) {
    return this.apiPost(`/executor/${encodeURIComponent(proposalId)}/run`, payload);
  },

  async listExecutionRuns(filters = {}) {
    const params = new URLSearchParams();
    ['userId', 'actorId', 'workspaceId', 'status', 'limit'].forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });
    const query = params.toString();
    return this.apiGet(`/executor/runs${query ? `?${query}` : ''}`);
  },

  async listTools(filters = {}) {
    const params = new URLSearchParams();
    ['category', 'riskLevel', 'source', 'enabled', 'q', 'limit'].forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });
    const query = params.toString();
    return this.apiGet(`/tools${query ? `?${query}` : ''}`);
  },

  async getTool(toolId) {
    return this.apiGet(`/tools/${encodeURIComponent(toolId)}`);
  },

  async enableTool(toolId, payload = {}) {
    return this.apiPost(`/tools/${encodeURIComponent(toolId)}/enable`, payload);
  },

  async disableTool(toolId, payload = {}) {
    return this.apiPost(`/tools/${encodeURIComponent(toolId)}/disable`, payload);
  },

  async previewTool(toolId, payload = {}) {
    return this.apiPost(`/tools/${encodeURIComponent(toolId)}/preview`, payload);
  },

  async runTool(toolId, payload = {}) {
    return this.apiPost(`/tools/${encodeURIComponent(toolId)}/run`, payload);
  },

  async proposeTool(toolId, payload = {}) {
    return this.apiPost(`/tools/${encodeURIComponent(toolId)}/propose`, payload);
  },

  async listToolRuns(filters = {}) {
    const params = new URLSearchParams();
    ['toolId', 'workspaceId', 'status', 'limit'].forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });
    const query = params.toString();
    return this.apiGet(`/tools/runs${query ? `?${query}` : ''}`);
  },

  async listToolAudit(filters = {}) {
    const params = new URLSearchParams();
    ['toolId', 'workspaceId', 'action', 'limit'].forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });
    const query = params.toString();
    return this.apiGet(`/tools/audit${query ? `?${query}` : ''}`);
  },

  async listBackups(filters = {}) {
    const params = new URLSearchParams();
    ['type', 'workspaceId', 'userId', 'status', 'limit'].forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });
    if (filters.includeArchived) params.set('includeArchived', 'true');
    const query = params.toString();
    return this.apiGet(`/backup${query ? `?${query}` : ''}`);
  },

  async createBackup(payload = {}) {
    return this.apiPost('/backup/create', payload);
  },

  async getBackup(backupId) {
    return this.apiGet(`/backup/${encodeURIComponent(backupId)}`);
  },

  async validateBackup(backupId, payload = {}) {
    return this.apiPost(`/backup/${encodeURIComponent(backupId)}/validate`, payload);
  },

  getBackupExportUrl(backupId) {
    return `${this.BASE_URL}/backup/${encodeURIComponent(backupId)}/export`;
  },

  async exportBackup(backupId) {
    return this.apiGet(`/backup/${encodeURIComponent(backupId)}/export`);
  },

  async archiveBackup(backupId, payload = {}) {
    return this.apiPost(`/backup/${encodeURIComponent(backupId)}/archive`, payload);
  },

  async validateImport(payload = {}) {
    return this.apiPost('/import/validate', { payload });
  },

  async previewImport(payload = {}) {
    return this.apiPost('/import/preview', { payload });
  },

  async createRestorePlan(payload = {}) {
    return this.apiPost('/restore/plan', payload);
  },

  async runRestorePlan(restorePlanId, payload = {}) {
    return this.apiPost(`/restore/${encodeURIComponent(restorePlanId)}/run`, payload);
  },

  async getRecoveryStatus() {
    return this.apiGet('/recovery/status');
  },

  async runRecoveryCheck(payload = {}) {
    return this.apiPost('/recovery/check', payload);
  },

  async runIntegrityCheck(payload = {}) {
    return this.apiPost('/integrity/check', payload);
  },

  async getPwaStatus() {
    return this.apiGet('/pwa/status');
  },

  async notePwaCacheClear(payload = {}) {
    return this.apiPost('/pwa/cache-clear-note', payload);
  },

  async listBackupSchedules(filters = {}) {
    const params = new URLSearchParams();
    ['workspaceId', 'userId', 'scope', 'limit'].forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });
    if (filters.includeArchived) params.set('includeArchived', 'true');
    if (filters.requestDue) params.set('requestDue', 'true');
    const query = params.toString();
    return this.apiGet(`/backup/schedules${query ? `?${query}` : ''}`);
  },

  async createBackupSchedule(payload = {}) {
    return this.apiPost('/backup/schedules/create', payload);
  },

  async getBackupSchedule(scheduleId) {
    return this.apiGet(`/backup/schedules/${encodeURIComponent(scheduleId)}`);
  },

  async updateBackupSchedule(scheduleId, payload = {}) {
    return this.apiPost(`/backup/schedules/${encodeURIComponent(scheduleId)}/update`, payload);
  },

  async archiveBackupSchedule(scheduleId, payload = {}) {
    return this.apiPost(`/backup/schedules/${encodeURIComponent(scheduleId)}/archive`, payload);
  },

  async previewBackupSchedule(scheduleId, payload = {}) {
    return this.apiPost(`/backup/schedules/${encodeURIComponent(scheduleId)}/preview`, payload);
  },

  async requestBackupScheduleRun(scheduleId, payload = {}) {
    return this.apiPost(`/backup/schedules/${encodeURIComponent(scheduleId)}/request-run`, payload);
  },

  async listBackupScheduleRuns(filters = {}) {
    const params = new URLSearchParams();
    ['scheduleId', 'workspaceId', 'userId', 'status', 'limit'].forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });
    const query = params.toString();
    return this.apiGet(`/backup/schedule-runs${query ? `?${query}` : ''}`);
  },

  async approveBackupScheduleRun(runId, payload = {}) {
    return this.apiPost(`/backup/schedule-runs/${encodeURIComponent(runId)}/approve`, payload);
  },

  async runApprovedBackupSchedule(runId, payload = {}) {
    return this.apiPost(`/backup/schedule-runs/${encodeURIComponent(runId)}/run`, payload);
  },

  async searchUserGraph(userId, q, workspaceId = '') {
    const encodedUser = encodeURIComponent(userId);
    const encodedQ = encodeURIComponent(q);
    const workspaceQuery = workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return this.apiGet(`/user/${encodedUser}/graph/search?q=${encodedQ}${workspaceQuery}`);
  },

  async getWorkspaces(filters = {}) {
    const params = new URLSearchParams();
    if (filters.actorId) params.set('actorId', filters.actorId);
    if (filters.all) params.set('all', 'true');
    if (filters.includeArchived) params.set('includeArchived', 'true');
    const query = params.toString();
    return this.apiGet(`/workspaces${query ? `?${query}` : ''}`);
  },

  async createWorkspace(payload) {
    return this.apiPost('/workspaces/create', payload);
  },

  async getWorkspace(workspaceId, actorId = '') {
    const query = actorId ? `?actorId=${encodeURIComponent(actorId)}` : '';
    return this.apiGet(`/workspaces/${encodeURIComponent(workspaceId)}${query}`);
  },

  async getWorkspaceMembers(workspaceId, actorId = '') {
    const query = actorId ? `?actorId=${encodeURIComponent(actorId)}` : '';
    return this.apiGet(`/workspaces/${encodeURIComponent(workspaceId)}/members${query}`);
  },

  async addWorkspaceMember(workspaceId, payload) {
    return this.apiPost(`/workspaces/${encodeURIComponent(workspaceId)}/members/add`, payload);
  },

  async updateWorkspaceMemberRole(workspaceId, payload) {
    return this.apiPost(`/workspaces/${encodeURIComponent(workspaceId)}/members/role`, payload);
  },

  async removeWorkspaceMember(workspaceId, payload) {
    return this.apiPost(`/workspaces/${encodeURIComponent(workspaceId)}/members/remove`, payload);
  },

  async archiveWorkspace(workspaceId, payload) {
    return this.apiPost(`/workspaces/${encodeURIComponent(workspaceId)}/archive`, payload);
  },

  async getMyPermissions(workspaceId = '', actorId = '') {
    const params = new URLSearchParams();
    if (workspaceId) params.set('workspaceId', workspaceId);
    if (actorId) params.set('actorId', actorId);
    const query = params.toString();
    return this.apiGet(`/permissions/me${query ? `?${query}` : ''}`);
  },

  async getUsers() {
    return this.apiGet('/users');
  },

  async getUserWorkspaceOverview(userId, workspaceId = '') {
    return this.apiGet(`/users/${encodeURIComponent(userId)}/overview${this.workspaceQuery(workspaceId)}`);
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
  },

  async exportHealthReport() {
    return this.apiPost('/actions/report/export-health');
  },

  async exportUserSummaryReport(userId) {
    return this.apiPost('/actions/report/export-user-summary', { userId });
  },

  async updateMemory(payload) {
    return this.apiPost('/actions/memory/update', payload);
  },

  async archiveMemory(payload) {
    return this.apiPost('/actions/memory/archive', payload);
  },

  async restoreMemory(payload) {
    return this.apiPost('/actions/memory/restore', payload);
  },

  async updateGoal(payload) {
    return this.apiPost('/actions/goal/update', payload);
  },

  async archiveGoal(payload) {
    return this.apiPost('/actions/goal/archive', payload);
  },

  async restoreGoal(payload) {
    return this.apiPost('/actions/goal/restore', payload);
  },

  async addWorkflowStep(payload) {
    return this.apiPost('/actions/workflow/step/add', payload);
  },

  async markWorkflowStepDone(payload) {
    return this.apiPost('/actions/workflow/step/done', payload);
  },

  async reorderWorkflowStep(payload) {
    return this.apiPost('/actions/workflow/step/reorder', payload);
  },

  async archiveWorkflow(payload) {
    return this.apiPost('/actions/workflow/archive', payload);
  },

  async restoreWorkflow(payload) {
    return this.apiPost('/actions/workflow/restore', payload);
  }
};

const apiGet = (path, options) => Api.apiGet(path, options);
const apiPost = (path, body, options) => Api.apiPost(path, body, options);
