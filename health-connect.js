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
  function call(method, args = {}) {
    return new Promise((resolve, reject) => {
      const id = String(++sequence);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('health-connect-timeout'));
      }, ['requestStepPermission', 'requestPermissions'].includes(method) ? 120000 : 30000);
      pending.set(id, { resolve, reject, timer });
      try { transport.postMessage(JSON.stringify({ ...args, id, method })); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  }
  window.AndroidHealthConnect = {
    requestStepPermission: async () => (await call('requestStepPermission'))?.granted === true,
    getTodaySteps: () => call('getTodaySteps'),
    getTodayMetrics: () => call('getTodayMetrics'),
    getStatus: () => call('getStatus'),
    requestPermissions: () => call('requestPermissions'),
    readHealthData: () => call('readHealthData'),
    readHealthHistory: days => call('readHealthHistory', { days }),
    openSettings: () => call('openSettings')
  };
})();

/* One interpretation for the HUD, HEALTH module and permission dialog. */
window.SystemHealthMetricRows = (data = {}) => {
  const number = (n, unit) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? `${Math.round(n).toLocaleString()} ${unit}` : 'No records found';
  const rows = [
    ['Steps', 'steps', number(data.steps, 'steps')],
    ['Active calories', 'activeCalories', number(data.activeCalories, 'kcal')],
    ['Total calories', 'totalCalories', number(data.totalCalories, 'kcal')],
    ['Distance', 'distanceMeters', number(data.distanceMeters, 'm')],
    ['Heart rate', 'heartRate', number(data.heartRate?.average, 'bpm')],
    ['Exercise sessions', 'exerciseSessions', Array.isArray(data.exerciseSessions) && data.exerciseSessions.length ? String(data.exerciseSessions.length) : 'No records found'],
    ['Sleep sessions', 'sleepSessions', Array.isArray(data.sleepSessions) && data.sleepSessions.length ? String(data.sleepSessions.length) : 'No records found'],
    ['Exercise time', 'activeMinutes', number(data.activeMinutes, 'min')]
  ];
  return rows.map(([label,key,value]) => ({label,key,
    value:data.errors?.[key] === 'permission-required' ? 'Permission needed' : data.errors?.[key] ? 'Read failed' : value,
    state:data.errors?.[key] === 'permission-required' ? 'permission-needed' : data.errors?.[key] ? 'read-failed' : value === 'No records found' ? 'no-records' : 'value'}));
};

window.SystemHealthUpdateHUD = (data = {}) => {
  const rows = window.SystemHealthMetricRows(data);
  for (const [id, key] of [['hudSteps', 'steps'], ['hudActive', 'activeCalories']]) {
    const element = document.getElementById(id), row = rows.find(row => row.key === key);
    if (element) {
      element.textContent = row.state === 'value' ? row.value : '--';
      element.title = row.value;
      element.dataset.state = row.state;
    }
  }
};

/* Foreground reads never request permissions unless CONNECT is tapped. */
(() => {
  if (typeof document === 'undefined') return;
  const install = () => {
    const host = document.getElementById('hudHealthTelemetry');
    if (!host || document.getElementById('systemHealthConnectDialog')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'openHealthConnect'; button.textContent = 'HEALTH CONNECT';
    host.append(button);
    const module = document.createElement('section');
    module.id = 'systemHealthTelemetryPanel'; module.className = 'system-health-telemetry';
    module.innerHTML = '<p data-status>Choose HEALTH CONNECT to read your synced fitness data.</p><p data-updated></p><div data-values class="health-connect-values"></div><button type="button" id="healthConnectAction">HEALTH CONNECT / PERMISSIONS</button><small>Today: local midnight to now • Sleep: past 24 hours. Exercise time is recorded workouts, not all movement.</small>';
    document.body.append(module);
    window.SystemHealthHistoryInstall?.(module);
    const panel = document.createElement('dialog');
    panel.id = 'systemHealthConnectDialog'; panel.className = 'health-connect-dialog';
    panel.setAttribute('aria-labelledby', 'systemHealthConnectTitle');
    panel.innerHTML = '<header class="health-connect-window-head"><h3 id="systemHealthConnectTitle">SYSTEM // HEALTH CONNECT</h3><button type="button" data-exit aria-label="Exit Health Connect">EXIT ×</button></header><div class="health-connect-window-body"><p data-status></p><p>Watch → compatible health app → Health Connect. Enable sharing and allow read access.</p><div class="health-connect-toolbar"><button data-connect>CONNECT / PERMISSIONS</button><button data-refresh>REFRESH</button><button data-settings>SETTINGS / INSTALL</button><button data-close>CLOSE</button></div><p data-updated></p><div data-values class="health-connect-values"></div><small>Today: local midnight to now • Sleep: past 24 hours. No records? Check your health app’s sharing.</small></div>';
    document.body.append(panel);
    const bridge = () => window.AndroidHealthConnect;
    let generation = 0, operation = null, lastReadDay = null;
    const day = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    const empty = error => ({errors:Object.fromEntries(window.SystemHealthMetricRows().map(({key})=>[key,error]))});
    const link = (text, state) => {
      const node = document.getElementById('hudHealthLink');
      if (node) { node.textContent = text; node.dataset.state = state; }
    };
    const status = text => { [module,panel].forEach(root=>root.querySelector('[data-status]').textContent=text); };
    const renderData = data => {
      window.SystemHealthUpdateHUD(data);
      [module, ...(panel.open ? [panel] : [])].forEach(root => {
        const values = root.querySelector('[data-values]'); values.replaceChildren();
        window.SystemHealthMetricRows(data).forEach(({label,key,value,state}) => {
          const card = document.createElement('div'); card.className = 'health-metric-card';
          card.dataset.metric = key; card.dataset.state = state;
          const title = document.createElement('strong'); title.textContent = label;
          const detail = document.createElement('p'); detail.textContent = value;
          card.title = (key === 'sleepSessions' ? 'Past 24 hours' : 'Today: local midnight to now') + (key === 'heartRate' ? ' • Average heart rate' : '');
          card.append(title,detail); values.append(card);
        });
        root.querySelector('[data-updated]').textContent = data.syncedAt ? `Last read: ${new Date(data.syncedAt).toLocaleString()}` : '';
      });
    };
    const setBusy = value => panel.querySelectorAll('[data-connect],[data-refresh],[data-settings]').forEach(b=>b.disabled=value);
    const refresh = async (request = false) => {
      if (operation) return operation.promise;
      if (lastReadDay && lastReadDay !== day()) { renderData({}); lastReadDay = null; }
      const token = {generation}; operation = token; setBusy(true);
      token.promise = (async () => {
        try {
          const native = bridge();
          if (!native?.readHealthData) {
            status('Available in the Android app. Manual steps remain available.');
            link('ANDROID APP','native-required'); renderData({}); return;
          }
          status('Checking Health Connect…'); link('CHECKING','checking');
          if (request) await native.requestPermissions();
          if (token.generation !== generation) return;
          const state = await native.getStatus();
          if (token.generation !== generation) return;
          if (state.availability !== 'available') {
            status(state.availability === 'provider-update-required' ? 'Install or update Health Connect.' : 'Health Connect is unavailable on this device.');
            link(state.availability === 'provider-update-required' ? 'UPDATE NEEDED' : 'UNAVAILABLE',state.availability);
            renderData(empty('health-read-failed')); return;
          }
          const granted = Array.isArray(state.permissions) ? state.permissions : [];
          status(state.connected ? 'Connected • Read-only access' : granted.length ? 'Partially connected • Some permissions are missing' : 'Disconnected • Choose permissions to connect');
          link(state.connected ? 'ONLINE' : granted.length ? 'PARTIAL' : 'PERMISSIONS', state.connected ? 'connected' : granted.length ? 'partial' : 'permission-needed');
          const startedDay = day(), startedZone = new Date().getTimezoneOffset();
          const data = granted.length ? await native.readHealthData() : empty('permission-required');
          if (token.generation !== generation) return;
          if (day() !== startedDay || new Date().getTimezoneOffset() !== startedZone || (data.date && data.date !== startedDay)) {
            status('The local day changed. Refresh for today’s data.'); link('REFRESH NEEDED','stale'); renderData({}); return;
          }
          if (data.error) throw new Error(data.error);
          lastReadDay = startedDay; renderData(data);
          const rows = window.SystemHealthMetricRows(data);
          if (rows.some(row=>row.state === 'permission-needed')) {
            const denied = rows.every(row=>row.state === 'permission-needed');
            link(denied ? 'PERMISSIONS' : 'PARTIAL',denied ? 'permission-needed' : 'partial');
            status(denied ? 'Disconnected • Choose permissions to connect' : 'Partially connected • Some permissions are missing');
          } else if (rows.some(row=>row.state === 'read-failed')) {
            link('READ FAILED','read-failed'); status('Some Health Connect readings failed. Refresh to retry.');
          }
        } catch (e) {
          if (token.generation === generation) {
            status('Health Connect read failed. Refresh to retry; check permissions in Settings.');
            link('READ FAILED','read-failed'); renderData(empty(e.message === 'permission-required' ? 'permission-required' : 'health-read-failed'));
          }
        } finally {
          if (operation === token) { operation = null; setBusy(false); }
        }
      })();
      return token.promise;
    };
    const openPanel = () => {
      if (!panel.open) { generation++; operation = null; setBusy(false); panel.showModal(); }
      refresh();
    };
    window.SystemHealthOpen = openPanel;
    window.SystemHealthRefresh = refresh;
    button.onclick = openPanel;
    module.querySelector('#healthConnectAction').onclick = openPanel;
    document.addEventListener('click', event => {
      if (event.target.closest?.('#healthConnectAction')) {
        event.preventDefault(); event.stopImmediatePropagation(); openPanel();
      }
    }, true);
    panel.querySelector('[data-connect]').onclick = () => refresh(true);
    panel.querySelector('[data-refresh]').onclick = () => refresh();
    panel.querySelector('[data-settings]').onclick = async () => {
      try { if (!bridge()) return status('Open Health Connect from Android Settings.'); await bridge().openSettings(); }
      catch (_) { status('Could not open settings. Open Health Connect from Android Settings.'); }
    };
    panel.querySelector('[data-close]').onclick = () => panel.close();
    panel.querySelector('[data-exit]').onclick = () => panel.close();
    panel.addEventListener('close', () => {
      generation++; operation = null; setBusy(false);
      panel.querySelector('[data-values]').replaceChildren(); panel.querySelector('[data-updated]').textContent = '';
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        generation++; operation = null; setBusy(false);
        if (lastReadDay && lastReadDay !== day()) { renderData({}); link('REFRESH NEEDED','stale'); }
      } else refresh();
    });
    // One automatic foreground read updates the HUD without opening permission UI.
    refresh();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
