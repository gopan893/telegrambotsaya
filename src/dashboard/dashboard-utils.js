'use strict';

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());
}

function isSet(value) {
  return value ? 'set' : 'missing';
}

function getVersion() {
  try {
    return require('../../package.json').version || 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

function getBaseUrl(env = {}) {
  return env.WEBHOOK_URL || env.TELEGRAM_WEBHOOK_URL || (env.RENDER_EXTERNAL_HOSTNAME ? `https://${env.RENDER_EXTERNAL_HOSTNAME}` : '');
}

function buildCommandCatalog() {
  return {
    core: ['/start', '/help', '/ping', '/reset', '/stats'],
    adaptive: ['/mode', '/adaptive status', '/adaptive on', '/adaptive off', '/adaptive reset'],
    'ai-os': ['/aios', '/insights', '/workspace'],
    workspace: ['/whoami', '/workspace', '/workspaces'],
    memory: ['/remember', '/memory', '/forget'],
    goals: ['/goals', '/goaladd', '/goalupdate'],
    workflows: ['/workflows', '/workflowadd', '/workflowstep', '/workflowdone', '/workflowdecision', '/workflowblocker', '/workflownext'],
    collaboration: ['/think', '/strategy', '/reflect', '/learnplan', '/mentalmodel', '/decision', '/blindspot', '/assumptions', '/perspectives', '/insight', '/journal', '/collab'],
    graph: ['/graph', '/graph <konsep>', '/concepts', '/relate', '/graphsearch', '/graphrisks', '/graphdeps', '/graphprune', '/graphstats'],
    ops: ['/ops', '/health', '/diag', '/reliability', '/perf', '/tokens', '/benchmark'],
    tools: ['/hitung', '/jam', '/tanggal', '/cuaca', '/cari', '/lokasi', '/image'],
    dashboard: ['/dashboard', '/dashboardstatus', '/dbstatus', '/redisstatus', '/audit', '/audit recent']
  };
}

function buildDashboardHtml(status = {}, env = {}) {
  const baseUrl = getBaseUrl(env);
  const healthUrl = `${baseUrl || ''}/api/dashboard/health`;
  const enabled = status.enabled ? 'enabled' : 'disabled';
  const token = (status.tokenConfigured ?? status.adminTokenSet) ? 'set' : 'missing';

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Telegram AI OS Dashboard</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f7f7f8; color: #19191b; }
    main { max-width: 760px; margin: 48px auto; padding: 0 20px; }
    section { background: #fff; border: 1px solid #e5e5e8; border-radius: 8px; padding: 24px; }
    code { background: #f1f1f3; padding: 2px 6px; border-radius: 4px; }
    a { color: #155eef; }
    ul { line-height: 1.7; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>Telegram AI OS Dashboard</h1>
      <p>Status dashboard: <strong>${enabled}</strong></p>
      <p>Admin token: <strong>${token}</strong></p>
      <p>Endpoint health publik: <a href="${healthUrl}">${healthUrl}</a></p>
      <p>Endpoint data user membutuhkan header:</p>
      <p><code>Authorization: Bearer &lt;DASHBOARD_ADMIN_TOKEN&gt;</code></p>
      <h2>Endpoint awal</h2>
      <ul>
        <li><code>/api/dashboard/health</code></li>
        <li><code>/api/dashboard/summary</code></li>
        <li><code>/api/dashboard/user/:userId/overview</code></li>
        <li><code>/api/dashboard/user/:userId/graph/search?q=memory</code></li>
        <li><code>/api/dashboard/env-check</code></li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

module.exports = {
  buildCommandCatalog,
  buildDashboardHtml,
  getBaseUrl,
  getVersion,
  isSet,
  isTruthy
};
