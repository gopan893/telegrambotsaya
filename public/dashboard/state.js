/* Dashboard lightweight state store */

const DashboardState = (() => {
  const listeners = new Set();
  const state = {
    activeTab: 'overview',
    currentUserId: localStorage.getItem('last_user_id') || '',
    preferences: loadUserPreferences()
  };

  function notify() {
    const snapshot = getState();
    listeners.forEach(listener => {
      try { listener(snapshot); } catch (_) {}
    });
  }

  function getState() {
    return {
      ...state,
      preferences: { ...(state.preferences || {}) }
    };
  }

  function setState(patch = {}) {
    Object.assign(state, patch || {});
    notify();
    return getState();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function setActiveTab(tab) {
    return setState({ activeTab: String(tab || 'overview') });
  }

  function setCurrentUserId(userId) {
    const clean = String(userId || '').trim();
    if (clean) localStorage.setItem('last_user_id', clean);
    return setState({ currentUserId: clean });
  }

  function saveUserPreferences(preferences = {}) {
    const next = { ...(state.preferences || {}), ...(preferences || {}) };
    state.preferences = next;
    try { localStorage.setItem('dashboard_preferences', JSON.stringify(next)); } catch (_) {}
    notify();
    return next;
  }

  function loadUserPreferences() {
    try {
      const parsed = JSON.parse(localStorage.getItem('dashboard_preferences') || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  return {
    getState,
    setState,
    subscribe,
    setActiveTab,
    setCurrentUserId,
    saveUserPreferences,
    loadUserPreferences
  };
})();

window.DashboardState = DashboardState;
