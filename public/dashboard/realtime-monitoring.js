/* Real-time monitoring via WebSocket */

const MonitoringWS = (() => {
  let ws = null;
  let reconnectTimer = null;
  let listeners = {};

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + window.location.host + '/ws';
    try {
      ws = new WebSocket(url);
      ws.onopen = () => {
        Utils.showToast('Monitoring connected', 'success');
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          Object.values(listeners).forEach(fn => { try { fn(data); } catch (_) {} });
        } catch (_) {}
      };
      ws.onclose = () => {
        ws = null;
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

  return { connect, disconnect, subscribe, addListener, removeListener };
})();

window.MonitoringWS = MonitoringWS;
