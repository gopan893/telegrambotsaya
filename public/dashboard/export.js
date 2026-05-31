/* Dashboard report export helpers */

const DashboardExport = (() => {
  function downloadJson(filename, data) {
    const payload = JSON.stringify(data || {}, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function buildHealthReport(health = {}, storage = {}) {
    return {
      type: 'dashboard-health-report',
      generatedAt: new Date().toISOString(),
      health,
      storage
    };
  }

  function buildUserSummaryReport(userId, overview = {}) {
    return {
      type: 'dashboard-user-summary-report',
      generatedAt: new Date().toISOString(),
      userId,
      overview
    };
  }

  async function exportHealthReport() {
    const action = await Api.exportHealthReport?.();
    if (action?.ok && action.data?.ok) {
      downloadJson(`dashboard-health-${Date.now()}.json`, action.data.result);
      return action.data.result;
    }
    const [health, storage] = await Promise.all([Api.getHealth(), Api.getStorage?.()]);
    const report = buildHealthReport(health.data || {}, storage?.data || {});
    downloadJson(`dashboard-health-${Date.now()}.json`, report);
    return report;
  }

  async function exportUserSummaryReport(userId) {
    const action = await Api.exportUserSummaryReport?.(userId);
    if (action?.ok && action.data?.ok) {
      downloadJson(`dashboard-user-${userId || 'summary'}-${Date.now()}.json`, action.data.result);
      return action.data.result;
    }
    const overview = userId ? await Api.getUserOverview(userId) : { data: {} };
    const report = buildUserSummaryReport(userId, overview.data || {});
    downloadJson(`dashboard-user-${userId || 'summary'}-${Date.now()}.json`, report);
    return report;
  }

  return {
    downloadJson,
    buildHealthReport,
    buildUserSummaryReport,
    exportHealthReport,
    exportUserSummaryReport
  };
})();

window.DashboardExport = DashboardExport;
