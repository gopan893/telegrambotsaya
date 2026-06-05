/* Real-time monitoring via WebSocket */

const MonitoringWS = (() => {
  let ws = null;
  let reconnectTimer = null;
  let listeners = {};

  function encodeProtocolToken(token) {
    try {
      const raw = window.btoa(unescape(encodeURIComponent(token || '')));
      return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    } catch (_) {
      return '';
    }
  }

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + window.location.host + '/ws';
    try {
      const token = window.Auth?.getStoredToken ? window.Auth.getStoredToken() : '';
      const encoded = encodeProtocolToken(token);
      ws = encoded ? new WebSocket(url, ['dashboard', `dashboard-auth.${encoded}`]) : new WebSocket(url);
      ws.onopen = () => {
        Utils.showToast('Monitoring connected', 'success');
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        subscribe(['health', 'dashboard', 'selfhealing', 'cicd', 'executor', 'release_gate']);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          Object.values(listeners).forEach(fn => { try { fn(data); } catch (_) {} });
        } catch (_) {}
      };
      ws.onclose = () => {
        ws = null;
        Object.values(listeners).forEach(fn => { try { fn({ type: 'connection', status: 'closed' }); } catch (_) {} });
        if (!reconnectTimer) reconnectTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => { ws && ws.close(); };
    } catch (_) {
      if (!reconnectTimer) reconnectTimer = setTimeout(connect, 10000);
    }
  }

  function disconnect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.close(); ws = null; }
  }

  function subscribe(topics) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', topics }));
    }
  }

  function addListener(id, fn) { listeners[id] = fn; }
  function removeListener(id) { delete listeners[id]; }
  function isConnected() { return Boolean(ws && ws.readyState === WebSocket.OPEN); }

  return { connect, disconnect, subscribe, addListener, removeListener, isConnected };
})();

window.MonitoringWS = MonitoringWS;
