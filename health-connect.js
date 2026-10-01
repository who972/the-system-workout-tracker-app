/* Android's origin-restricted message transport; ordinary browsers keep manual entry. */
(() => {
  const transport = window.SystemHealthNative;
  if (!transport || typeof transport.postMessage !== 'function') return;
  const pending = new Map();
  let sequence = 0;
  transport.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.result?.error) request.reject(new Error(message.result.error));
    else request.resolve(message.result);
  };
  function call(method) {
    return new Promise((resolve, reject) => {
      const id = String(++sequence);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('health-connect-timeout'));
      }, ['requestStepPermission', 'requestPermissions'].includes(method) ? 120000 : 30000);
      pending.set(id, { resolve, reject, timer });
      try { transport.postMessage(JSON.stringify({ id, method })); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  }
  window.AndroidHealthConnect = {
    requestStepPermission: async () => (await call('requestStepPermission'))?.granted === true,
    getTodaySteps: () => call('getTodaySteps'),
    getStatus: () => call('getStatus'),
    requestPermissions: () => call('requestPermissions'),
    readHealthData: () => call('readHealthData'),
    openSettings: () => call('openSettings')
  };
})();

/* Shared interpretation keeps denied access, empty reads and real zeroes distinct. */
window.SystemHealthMetricRows = (data = {}) => {
  const number = (n, unit) => typeof n === 'number' && Number.isFinite(n) ? `${Math.round(n).toLocaleString()} ${unit}` : 'No records found';
  const rows = [
    ['Steps', 'steps', number(data.steps, 'steps')],
    ['Active calories', 'activeCalories', number(data.activeCalories, 'kcal')],
    ['Total calories', 'totalCalories', number(data.totalCalories, 'kcal')],
    ['Distance', 'distanceMeters', number(data.distanceMeters, 'm')],
    ['Heart rate', 'heartRate', number(data.heartRate?.average, 'bpm')],
    ['Exercise sessions', 'exerciseSessions', Array.isArray(data.exerciseSessions) && data.exerciseSessions.length ? String(data.exerciseSessions.length) : 'No records found'],
    ['Sleep sessions', 'sleepSessions', Array.isArray(data.sleepSessions) && data.sleepSessions.length ? String(data.sleepSessions.length) : 'No records found']
  ];
  return rows.map(([label,key,value]) => ({label,key,
    value:data.errors?.[key] === 'permission-required' ? 'Permission needed' : data.errors?.[key] ? 'Read failed' : value,
    state:data.errors?.[key] === 'permission-required' ? 'permission-needed' : data.errors?.[key] ? 'read-failed' : value === 'No records found' ? 'no-records' : 'value'}));
};

/* Foreground-only Phase 1 panel. Health records stay in memory. */
(() => {
  if (typeof document === 'undefined') return;
  const install = () => {
    const host = document.getElementById('hudHealthTelemetry');
    if (!host) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'openHealthConnect';
    button.textContent = 'HEALTH CONNECT';
    host.append(button);
    const panel = document.createElement('dialog');
    panel.id = 'systemHealthConnectDialog';
    panel.className = 'health-connect-dialog';
    panel.setAttribute('aria-labelledby', 'systemHealthConnectTitle');

    panel.innerHTML = '<header class="health-connect-window-head"><h3 id="systemHealthConnectTitle">SYSTEM // HEALTH CONNECT</h3><button type="button" data-exit aria-label="Exit Health Connect">EXIT ×</button></header><div class="health-connect-window-body"><p data-status></p><p>Galaxy Watch → Samsung Health → Health Connect. Enable sharing and allow read access.</p><div class="health-connect-toolbar"><button data-connect>CONNECT / PERMISSIONS</button><button data-refresh>REFRESH</button><button data-settings>SETTINGS / INSTALL</button><button data-close>CLOSE</button></div><p data-updated></p><div data-values class="health-connect-values"></div><small>Today: local midnight to now • Sleep: past 24 hours. No records? Check Samsung Health sharing.</small></div>';
    document.body.append(panel);
    const bridge = () => window.AndroidHealthConnect;
    const status = panel.querySelector('[data-status]');
    const values = panel.querySelector('[data-values]');
    let busy = false;
    let generation = 0;
    const reset = () => { values.replaceChildren(); panel.querySelector('[data-updated]').textContent = ''; };
    const renderData = data => {
      values.replaceChildren();
        const rows = window.SystemHealthMetricRows(data);
        rows.forEach(({label, key, value, state: metricState}) => {
          const card = document.createElement('div');
          card.className = 'health-metric-card';
          card.dataset.metric = key;
          const title = document.createElement('strong'); title.textContent = label;
          const detail = document.createElement('p'); detail.textContent = value;
          card.dataset.state = metricState;
          card.title = (key === 'sleepSessions' ? 'Past 24 hours' : 'Today: local midnight to now') + (key === 'heartRate' ? ' • Average heart rate' : '') + (Array.isArray(data[key]) ? '\n' + data[key].map(session => `${session.start} – ${session.end} • ${session.source}`).join('\n') : '');
          card.append(title, detail); values.append(card);
        });
        panel.querySelector('[data-updated]').textContent = data.syncedAt ? `Last read: ${new Date(data.syncedAt).toLocaleString()}` : '';
    };
    const refresh = async (request = false) => {
      if (busy) return;
      busy = true;
      const current = generation;
      panel.querySelectorAll('[data-connect],[data-refresh],[data-settings]').forEach(b => b.disabled = true);
      reset();
      try {
        const native = bridge();
        if (!native) { status.textContent = 'Available in the Android app. Manual steps remain available.'; return; }
        status.textContent = 'Checking Health Connect…';
        if (request) await native.requestPermissions();
        const state = await native.getStatus();
        if (current !== generation) return;
        status.textContent = state.availability !== 'available' ? state.availability === 'provider-update-required' ? 'Install or update Health Connect.' : 'Health Connect is unavailable on this device.' : state.connected ? 'Connected • Read-only access' : state.permissions.length ? 'Partially connected • Some permissions are missing' : 'Disconnected • Choose permissions to connect';
        if (state.availability !== 'available') return;
        const data = state.permissions.length ? await native.readHealthData() : {errors:Object.fromEntries(['steps','activeCalories','totalCalories','distanceMeters','heartRate','exerciseSessions','sleepSessions'].map(key=>[key,'permission-required']))};
        if (current !== generation) return;
        renderData(data);
      } catch (e) {
        if (current === generation) {
          status.textContent = 'Health Connect read failed. Refresh to retry; check permissions in Settings.';
          renderData({errors:Object.fromEntries(window.SystemHealthMetricRows().map(({key})=>[key,e.message === 'permission-required' ? 'permission-required' : 'health-read-failed']))});
        }
      } finally {
        busy = false;
        panel.querySelectorAll('button').forEach(b => b.disabled = false);
      }
    };
    const openPanel = () => { if (!panel.open) panel.showModal(); refresh(); };
    button.onclick = openPanel;
    // The existing HEALTH tab also opens this full permissions/data panel.
    document.addEventListener('click', event => {
      if (event.target.closest?.('#healthConnectAction')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPanel();
      }
    }, true);
    panel.querySelector('[data-connect]').onclick = () => refresh(true);
    panel.querySelector('[data-refresh]').onclick = () => refresh();
    panel.querySelector('[data-settings]').onclick = async () => {
      try { await bridge()?.openSettings(); } catch (_) { status.textContent = 'Could not open settings. Open Health Connect from Android Settings.'; }
    };
    panel.querySelector('[data-close]').onclick = () => panel.close();
    panel.querySelector('[data-exit]').onclick = () => panel.close();
    panel.addEventListener('close', () => { generation++; reset(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && panel.open) refresh();
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();

