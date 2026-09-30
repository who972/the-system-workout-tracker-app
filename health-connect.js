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
    panel.style.cssText = 'background:#091723;color:#d9f7ff;border:1px solid #36cddd;width:min(780px,90vw);max-height:85dvh;overflow:auto;padding:18px;';
    panel.innerHTML = '<h3 id="systemHealthConnectTitle" style="margin:0">SYSTEM // HEALTH CONNECT</h3><p data-status></p><p>Galaxy Watch → Samsung Health → Health Connect. Enable sharing in Samsung Health, then allow access here. Read-only; refresh to see synced data.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button data-connect>CONNECT / PERMISSIONS</button><button data-refresh>REFRESH</button><button data-settings>SETTINGS / INSTALL</button><button data-close>CLOSE</button></div><p data-updated></p><div data-values style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px"></div><small>Today’s totals • Sleep sessions: past 24 hours. Missing data means no shared records or permission. Sleep sessions may include awake time; overlapping sources are shown separately.</small>';
    document.body.append(panel);
    const bridge = () => window.AndroidHealthConnect;
    const status = panel.querySelector('[data-status]');
    const values = panel.querySelector('[data-values]');
    let busy = false;
    let generation = 0;
    const reset = () => { values.replaceChildren(); panel.querySelector('[data-updated]').textContent = ''; };
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
        if (state.availability !== 'available' || !state.permissions.length) return;
        const data = await native.readHealthData();
        if (current !== generation) return;
        const number = (n, unit) => typeof n === 'number' && Number.isFinite(n) ? `${Math.round(n).toLocaleString()} ${unit}` : 'No shared data';
        const rows = [
          ['Steps', 'steps', number(data.steps, 'steps')],
          ['Active calories', 'activeCalories', number(data.activeCalories, 'kcal')],
          ['Total calories', 'totalCalories', number(data.totalCalories, 'kcal')],
          ['Distance', 'distanceMeters', number(data.distanceMeters, 'm')],
          ['Heart rate (average)', 'heartRate', number(data.heartRate?.average, 'bpm')],
          ['Exercise sessions', 'exerciseSessions', Array.isArray(data.exerciseSessions) ? String(data.exerciseSessions.length) : 'No shared data'],
          ['Sleep sessions', 'sleepSessions', Array.isArray(data.sleepSessions) ? String(data.sleepSessions.length) : 'No shared data']
        ];
        rows.forEach(([label, key, value]) => {
          const card = document.createElement('div');
          card.style.cssText = 'padding:10px;border:1px solid #285969;';
          const title = document.createElement('strong'); title.textContent = label;
          const detail = document.createElement('p'); detail.textContent = data.errors?.[key] === 'permission-required' ? 'Permission required' : data.errors?.[key] ? 'Could not read — refresh to retry' : value;
          card.append(title, detail); values.append(card);
        });
        for (const key of ['exerciseSessions', 'sleepSessions']) {
          for (const session of data[key] || []) {
            const row = document.createElement('p');
            row.style.gridColumn = '1 / -1';
            row.textContent = `${key === 'sleepSessions' ? 'Sleep' : 'Exercise'}: ${new Date(session.start).toLocaleString()} – ${new Date(session.end).toLocaleString()} • ${session.source}`;
            values.append(row);
          }
        }
        panel.querySelector('[data-updated]').textContent = `Last read: ${new Date(data.syncedAt).toLocaleString()}`;
      } catch (e) {
        if (current === generation) status.textContent = `Connection failed (${e.message}). Check permissions and retry.`;
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
    panel.addEventListener('close', () => { generation++; reset(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && panel.open) refresh();
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
